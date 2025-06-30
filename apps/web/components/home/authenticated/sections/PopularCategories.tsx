"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '~/lib/supabaseClient';
import { useAuth } from '~/lib/auth';

interface Category {
  name: string;
  slug: string;
  count: number;
}

interface PopularCategoriesProps {
  categories?: Category[];
}

const DEFAULT_CATEGORIES: Category[] = [
  { name: 'Fresh & Perishable', slug: 'fresh-perishable', count: 15 },
  { name: 'Frozen Foods', slug: 'frozen-foods', count: 12 },
  { name: 'Bakery & Bread', slug: 'bakery-bread', count: 8 },
  { name: 'Beverages', slug: 'beverages', count: 10 },
  { name: 'Pantry Staples', slug: 'pantry-staples', count: 14 },
  { name: 'Snacks', slug: 'snacks', count: 7 },
];

export default function PopularCategories({ categories: propCategories }: PopularCategoriesProps) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>(propCategories || DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (propCategories) {
      setCategories(propCategories);
      setLoading(false);
      return;
    }
    
    fetchPopularCategories();
  }, [propCategories, user]);

  const fetchPopularCategories = async () => {
    try {
      setLoading(true);
      
      if (!user) {
        // For non-authenticated users, use default categories
        setCategories(DEFAULT_CATEGORIES);
        setLoading(false);
        return;
      }
      
      // Get user's basket items to find popular categories
      const { data: basketItems, error: basketError } = await supabase
        .from('basket_items')
        .select(`
          product_id,
          products:products(
            product_categories(
              category:categories(
                id,
                name,
                slug
              )
            )
          )
        `)
        .in('basket_id', function(builder) {
          builder.select('basket_id')
            .from('basket_users')
            .eq('user_id', user.id);
        });
      
      if (basketError) throw basketError;
      
      // Get user's tracked products to find popular categories
      const { data: trackedProducts, error: trackingError } = await supabase
        .from('product_trackings')
        .select(`
          product_id,
          products:products(
            product_categories(
              category:categories(
                id,
                name,
                slug
              )
            )
          )
        `)
        .eq('user_id', user.id);
      
      if (trackingError) throw trackingError;
      
      // Combine and count categories
      const categoryCounts: Record<string, { name: string; slug: string; count: number }> = {};
      
      // Process basket items
      if (basketItems) {
        basketItems.forEach(item => {
          const productCategories = item.products?.product_categories || [];
          productCategories.forEach(pc => {
            const category = pc.category;
            if (category) {
              if (!categoryCounts[category.id]) {
                categoryCounts[category.id] = {
                  name: category.name,
                  slug: category.slug,
                  count: 0
                };
              }
              categoryCounts[category.id].count += 1;
            }
          });
        });
      }
      
      // Process tracked products
      if (trackedProducts) {
        trackedProducts.forEach(item => {
          const productCategories = item.products?.product_categories || [];
          productCategories.forEach(pc => {
            const category = pc.category;
            if (category) {
              if (!categoryCounts[category.id]) {
                categoryCounts[category.id] = {
                  name: category.name,
                  slug: category.slug,
                  count: 0
                };
              }
              categoryCounts[category.id].count += 1;
            }
          });
        });
      }
      
      // Convert to array and sort by count
      let sortedCategories = Object.values(categoryCounts)
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);
      
      // If no categories found, use defaults
      if (sortedCategories.length === 0) {
        sortedCategories = DEFAULT_CATEGORIES;
      }
      
      setCategories(sortedCategories);
    } catch (error) {
      console.error('Error fetching popular categories:', error);
      setCategories(DEFAULT_CATEGORIES);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text)' }}>
        Your Popular Categories
      </h2>
      {loading ? (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {categories.map((category) => (
            <Link
              key={category.name}
              href={`/categories/${category.slug}`}
              className="flex flex-col items-center p-4 rounded-lg hover-primary-bg transition-colors border border-gray-200 dark:border-gray-700"
            >
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-primary">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                </svg>
              </div>
              <span className="text-sm font-medium text-center" style={{ color: 'var(--text)' }}>
                {category.name}
              </span>
              <span
                className="text-xs px-2 py-1 rounded-full mt-1"
                style={{ background: 'var(--primary)', color: 'var(--dark-text)' }}
              >
                {category.count} items
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
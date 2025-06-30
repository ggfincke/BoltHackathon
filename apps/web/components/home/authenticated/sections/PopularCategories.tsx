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
  { name: 'Fresh & Perishable', slug: 'fresh-perishable', count: 0 },
  { name: 'Frozen Foods', slug: 'frozen-foods', count: 0 },
  { name: 'Bakery & Bread', slug: 'bakery-bread', count: 0 },
  { name: 'Beverages', slug: 'beverages', count: 0 },
  { name: 'Pantry Staples', slug: 'pantry-staples', count: 0 },
  { name: 'Snacks', slug: 'snacks', count: 0 },
];

// ensure returned array always has exactly five categories
const ensureFiveCategories = (base: Category[]): Category[] => {
  if (base.length >= 5) return base.slice(0, 5);

  const existingSlugs = new Set(base.map((c) => c.slug));
  const fillers = DEFAULT_CATEGORIES
    .filter((c) => !existingSlugs.has(c.slug))
    .slice(0, 5 - base.length)
    // counts for filler categories are zero (no pill)
    .map((c) => ({ ...c, count: 0 }));

  return [...base, ...fillers];
};

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
      
      // 1st: find all basket IDs the user has access to
      const {
        data: basketUserRows,
        error: basketUsersError
      } = await supabase
        .from('basket_users')
        .select('basket_id')
        .eq('user_id', user.id);

      if (basketUsersError) throw basketUsersError;

      const basketIds = (basketUserRows || [])
        .map((row) => row.basket_id)
        .filter((id): id is string => Boolean(id));

      // Explicitly type to avoid implicit any lint errors
      let basketItems: Array<{
        product_id: string;
        products?: {
          product_categories?: Array<{
            category?: { id: string; name: string; slug: string };
          }>;
        };
      }> | null = null;

      if (basketIds.length > 0) {
        const { data, error } = await supabase
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
          .in('basket_id', basketIds);

        if (error) throw error;
        basketItems = data;
      }
      else {
        basketItems = [];
      }
      
      // Product tracking has been disabled - focusing only on basket items
      
      // Combine and count categories
      const categoryCounts: Record<string, { name: string; slug: string; count: number }> = {};
      
      // Process basket items
      if (basketItems) {
        basketItems.forEach((item) => {
          const productCategories = item.products?.product_categories || [];
          productCategories.forEach((pc) => {
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
      
      // Product tracking disabled - only counting basket item categories
      
      // Convert to array and sort by count, but don't slice yet – we will ensure exactly six later.
      const sortedCategories = Object.values(categoryCounts).sort((a, b) => b.count - a.count);

      // Fill with defaults if needed so we always have five categories.
      const finalCategories = ensureFiveCategories(sortedCategories.length === 0 ? [] : sortedCategories);

      setCategories(finalCategories);

    } catch (error) {
      console.error('Error fetching popular categories:', error);
      setCategories(DEFAULT_CATEGORIES);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface rounded-lg shadow-sm p-4">
      <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>
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
                className={`text-xs px-2 py-1 rounded-full mt-1 ${category.count > 0 ? 'opacity-100' : 'opacity-0'}`}
                style={{ background: 'var(--primary)', color: 'var(--dark-text)' }}
              >
                {category.count > 0 ? `${category.count} items` : '0 items'}
              </span>

            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
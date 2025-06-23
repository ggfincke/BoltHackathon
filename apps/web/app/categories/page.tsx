'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import CategoryCard from '~/components/shared/CategoryCard';
import { supabase } from '~/lib/supabaseClient';
import { Database } from '~/lib/database.types';

type Category = Database['public']['Tables']['categories']['Row'];

export default function CategoriesPage() {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    const fetchCategories = async () => {
      setLoading(true);
      try {
        // Fetch grocery categories directly (skipping the home -> grocery store -> groceries path)
        // Look for "Groceries" category first
        const { data: groceriesCategory } = await supabase
          .from('categories')
          .select('id, name, slug')
          .eq('name', 'Groceries')
          .eq('is_active', true)
          .single();
        
        if (groceriesCategory) {
          // If we found Groceries, get its subcategories
          const { data, error } = await supabase
            .from('categories')
            .select('*')
            .eq('parent_id', groceriesCategory.id)
            .eq('is_active', true)
            .order('name');
          
          if (error) throw error;
          setCategories(data || []);
        } else {
          // Fallback: just get top-level categories
          const { data, error } = await supabase
            .from('categories')
            .select('*')
            .is('parent_id', null)
            .eq('is_active', true)
            .order('name');
          
          if (error) throw error;
          setCategories(data || []);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
        // Fallback to empty categories
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };
    
    fetchCategories();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Grocery Categories</h1>
      
      {categories.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {/* Add Best Deals as the first category */}
          <Link 
            href="/best-deals"
            className="bg-surface p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow flex flex-col items-center text-center"
          >
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-primary">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold">Best Deals</h2>
            <p className="text-gray-600 dark:text-gray-400 mt-2 line-clamp-2">
              Find the biggest savings across retailers
            </p>
          </Link>
          
          {/* Display regular categories */}
          {categories.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>
      ) : (
        <div className="bg-surface p-8 rounded-lg shadow-sm text-center">
          <h2 className="text-xl font-semibold mb-2">No categories found</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Check back later for new categories.
          </p>
        </div>
      )}
    </div>
  );
}
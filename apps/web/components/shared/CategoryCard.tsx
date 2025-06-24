import React from 'react';
import Link from 'next/link';
import { Database } from '~/lib/database.types';

type Category = Database['public']['Tables']['categories']['Row'];

interface CategoryCardProps {
  category: Category;
  productCount?: number;
}

export default function CategoryCard({ category, productCount }: CategoryCardProps) {
  return (
    <Link 
      href={`/categories/${category.slug}`}
      className="block"
    >
      <div className="bg-surface p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow flex flex-col items-center text-center">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 text-primary">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
          </svg>
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">{category.name}</h3>
          {category.description && (
            <p className="text-muted mt-2 text-sm line-clamp-2">
              {category.description}
            </p>
          )}
          {productCount !== undefined && (
            <span className="category-count">
              {productCount} products
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
"use client";

import Link from 'next/link';

interface Category {
  name: string;
  count: number;
}

interface PopularCategoriesProps {
  categories?: Category[];
}

const DEFAULT_CATEGORIES: Category[] = [
  { name: 'Beverages', count: 15 },
  { name: 'Snacks', count: 12 },
  { name: 'Dairy', count: 8 },
  { name: 'Produce', count: 6 },
  { name: 'Frozen Foods', count: 10 },
  { name: 'Bakery', count: 7 },
];

export default function PopularCategories({ categories = DEFAULT_CATEGORIES }: PopularCategoriesProps) {
  return (
    <div className="bg-surface rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text)' }}>
        Your Popular Categories
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {categories.map((category) => (
          <Link
            key={category.name}
            href={`/categories/${category.name.toLowerCase()}`}
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
    </div>
  );
}
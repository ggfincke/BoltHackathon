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
];

export default function PopularCategories({ categories = DEFAULT_CATEGORIES }: PopularCategoriesProps) {
  return (
    <div className="bg-surface rounded-lg shadow-sm p-6 flex flex-col h-full">
      <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text)' }}>
        Your Popular Categories
      </h2>
      <div className="flex-1 flex flex-col justify-between">
        {categories.map((category) => (
          <Link
            key={category.name}
            href={`/categories/${category.name.toLowerCase()}`}
            className="flex justify-between items-center p-2 rounded-lg hover-primary-bg transition-colors"
          >
            <span style={{ color: 'var(--text)' }}>{category.name}</span>
            <span
              className="text-xs px-2 py-1 rounded-full"
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
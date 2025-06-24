"use client";

import Link from 'next/link';

interface CategoryGridProps {
  categories?: string[];
}

const DEFAULT_CATEGORIES = [
  'Fresh & Perishable',
  'Frozen Foods',
  'Bakery & Bread',
  'Beverages',
  'Pantry Staples',
  'Snacks',
];

export default function CategoryGrid({ categories = DEFAULT_CATEGORIES }: CategoryGridProps) {
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {categories.map((category) => (
        <Link
          key={category}
          href={`/categories/${category.toLowerCase().replace(' ', '-')}`}
          className="px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200"
          style={{
            background: 'var(--surface)',
            color: 'var(--text)',
            border: '1px solid var(--primary)',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--primary)';
            (e.currentTarget as HTMLElement).style.color = 'var(--dark-text)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = 'var(--surface)';
            (e.currentTarget as HTMLElement).style.color = 'var(--text)';
          }}
        >
          {category}
        </Link>
      ))}
    </div>
  );
} 
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
      <div className="category-card">
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
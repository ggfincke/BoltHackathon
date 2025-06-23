"use client";

import Link from 'next/link';
import { FaArrowRight } from 'react-icons/fa';

interface Basket {
  id: string;
  name: string;
  itemCount: number;
  totalCost: number;
}

interface RecentBasketsProps {
  baskets?: Basket[];
}

const DEFAULT_BASKETS: Basket[] = [
  { id: '1', name: 'Weekly Groceries', itemCount: 12, totalCost: 87.45 },
  { id: '2', name: 'Pantry Essentials', itemCount: 8, totalCost: 42.99 },
  { id: '3', name: 'Snacks & Beverages', itemCount: 5, totalCost: 23.75 },
];

export default function RecentBaskets({ baskets = DEFAULT_BASKETS }: RecentBasketsProps) {
  return (
    <div className="bg-surface rounded-lg shadow-sm p-6 flex flex-col h-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
          Your Recent Baskets
        </h2>
        <Link
          href="/baskets"
          className="text-sm flex items-center"
          style={{ color: 'var(--primary)' }}
        >
          View All <FaArrowRight className="ml-1" />
        </Link>
      </div>

      <div className="flex-1 flex flex-col justify-between space-y-4">
        {baskets.map((basket) => (
          <Link key={basket.id} href={`/basket/${basket.id}`} className="block">
            <div className="basket-item-hover border border-gray-200 dark:border-gray-700 rounded-lg p-4 transition-colors">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-medium text-sm" style={{ color: 'var(--text)' }}>
                  {basket.name}
                </h3>
                <span
                  className="text-sm font-bold"
                  style={{ color: 'var(--primary)' }}
                >
                  ${basket.totalCost.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs opacity-70" style={{ color: 'var(--text)' }}>
                  {basket.itemCount} items
                </span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--primary)', color: 'var(--dark-text)' }}
                >
                  View Details
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
} 
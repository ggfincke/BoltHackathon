"use client";

import Link from 'next/link';
import { FaShoppingBasket, FaSearch, FaTag, FaArrowRight } from 'react-icons/fa';

export default function QuickActions() {
  return (
    <div className="bg-surface rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-bold mb-6" style={{ color: 'var(--text)' }}>
        Quick Actions
      </h2>
      <div className="space-y-4">
        <Link
          href="/baskets"
          className="flex items-center justify-between p-4 rounded-lg hover-primary-bg transition-colors w-full"
        >
          <div className="flex items-center">
            <FaShoppingBasket className="mr-3 text-lg" style={{ color: 'var(--secondary)' }} />
            <span style={{ color: 'var(--text)' }}>Create New Basket</span>
          </div>
          <FaArrowRight style={{ color: 'var(--text)' }} />
        </Link>
        <Link
          href="/search"
          className="flex items-center justify-between p-4 rounded-lg hover-primary-bg transition-colors w-full"
        >
          <div className="flex items-center">
            <FaSearch className="mr-3 text-lg" style={{ color: 'var(--primary)' }} />
            <span style={{ color: 'var(--text)' }}>Search Products</span>
          </div>
          <FaArrowRight style={{ color: 'var(--text)' }} />
        </Link>
        <Link
          href="/best-deals"
          className="flex items-center justify-between p-4 rounded-lg hover-primary-bg transition-colors w-full"
        >
          <div className="flex items-center">
            <FaTag className="mr-3 text-lg" style={{ color: 'var(--accent)' }} />
            <span style={{ color: 'var(--text)' }}>Show Best Deals</span>
          </div>
          <FaArrowRight style={{ color: 'var(--text)' }} />
        </Link>
      </div>
    </div>
  );
} 
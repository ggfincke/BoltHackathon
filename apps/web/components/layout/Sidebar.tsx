'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '~/lib/auth';
import { usePathname } from 'next/navigation';
import { HomeIcon, CategoriesIcon, BasketsIcon } from '../ui/Icons';

interface SidebarProps {
  variant?: 'home' | 'categories' | 'product' | 'basket';
}

export default function Sidebar({ variant = 'home' }: SidebarProps) {
  const { user } = useAuth();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const categories = [
    { name: 'Fresh & Perishable', slug: 'fresh-perishable' },
    { name: 'Pantry Staples', slug: 'pantry-staples' },
    { name: 'Dairy', slug: 'dairy' },
    { name: 'Meat & Seafood', slug: 'meat-seafood' },
    { name: 'Beverages', slug: 'beverages' },
    { name: 'Snacks & Candy', slug: 'snacks-candy' },
    { name: 'Frozen Foods', slug: 'frozen-foods' },
    { name: 'Bakery', slug: 'bakery' },
  ];

  const isActiveLink = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname.startsWith(href);
  };

  return (
    <aside 
      className={`fixed left-0 top-16 h-[calc(100vh-4rem)] bg-surface border-r border-gray-200 dark:border-gray-700 transition-all duration-300 z-30 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className="flex flex-col h-full">
        {/* Collapse Toggle */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full flex items-center justify-center p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className={`h-5 w-5 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Home Section */}
          <div className="p-4">
            <Link
              href="/"
              className={`flex items-center gap-3 p-3 rounded-md transition-colors ${
                isActiveLink('/') 
                  ? 'bg-primary text-buttonText' 
                  : 'hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <HomeIcon className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span className="font-medium">Home</span>}
            </Link>
          </div>

          {/* Categories Section */}
          <div className="px-4 pb-4">
            <div className="mb-3">
              <Link
                href="/categories"
                className={`flex items-center gap-3 p-3 rounded-md transition-colors ${
                  isActiveLink('/categories') 
                    ? 'bg-primary text-buttonText' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <CategoriesIcon className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span className="font-medium">Categories</span>}
              </Link>
            </div>

            {!isCollapsed && (
              <div className="ml-4 space-y-1">
                {categories.map((category) => (
                  <Link
                    key={category.slug}
                    href={`/categories/${category.slug}`}
                    className="block p-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    {category.name}
                  </Link>
                ))}
                <Link
                  href="/categories"
                  className="block p-2 text-sm text-primary hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                >
                  View All Categories →
                </Link>
              </div>
            )}
          </div>

          {/* Basket Quick Actions */}
          <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="mb-3">
              <div className="flex items-center gap-3 p-3">
                <BasketsIcon className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span className="font-medium">Basket Quick Actions</span>}
              </div>
            </div>

            {!isCollapsed && (
              <div className="ml-4 space-y-2">
                {!user ? (
                  <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-md">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Sign in to manage your baskets
                    </p>
                    <Link
                      href="/auth/login"
                      className="text-sm text-primary hover:underline"
                    >
                      Sign In / Sign Up
                    </Link>
                  </div>
                ) : (
                  <>
                    <Link
                      href="/baskets"
                      className="flex items-center gap-2 p-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <span>➕</span>
                      Create New Basket
                    </Link>
                    <Link
                      href="/baskets"
                      className="flex items-center gap-2 p-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <span>📋</span>
                      Manage Baskets
                    </Link>
                    
                    {/* Recent Baskets */}
                    <div className="mt-3">
                      <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                        Recent Baskets
                      </h4>
                      <div className="space-y-1">
                        <Link
                          href="/basket/1"
                          className="block p-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className="font-medium">Weekly Groceries</div>
                          <div className="text-xs text-gray-500">12 items • $87.45</div>
                        </Link>
                        <Link
                          href="/basket/2"
                          className="block p-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className="font-medium">Pantry Essentials</div>
                          <div className="text-xs text-gray-500">8 items • $42.99</div>
                        </Link>
                        <Link
                          href="/basket/3"
                          className="block p-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className="font-medium">Snacks & Beverages</div>
                          <div className="text-xs text-gray-500">5 items • $23.75</div>
                        </Link>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
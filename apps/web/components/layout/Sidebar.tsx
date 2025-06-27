'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '~/lib/auth';
import { useAuthModal } from '../shared/AuthModalProvider';
import { usePathname } from 'next/navigation';
import { HomeIcon, CategoriesIcon, BasketsIcon } from '../ui/Icons';
import { supabase } from '~/lib/supabaseClient';

interface SidebarProps {
  variant?: 'home' | 'categories' | 'product' | 'basket';
}

interface RecentBasket {
  id: string;
  name: string;
  item_count: number;
  total_cost: number;
}

export default function Sidebar({ variant = 'home' }: SidebarProps) {
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [recentBaskets, setRecentBaskets] = useState<RecentBasket[]>([]);
  const [loadingBaskets, setLoadingBaskets] = useState(false);
  const [basketUpdateTrigger, setBasketUpdateTrigger] = useState(0);

  const categories = [
    { name: 'Fresh & Perishable', slug: 'fresh-perishable' },
    { name: 'Frozen Foods', slug: 'frozen-foods' },
    { name: 'Bakery & Bread', slug: 'bakery-bread' },
    { name: 'Beverages', slug: 'beverages' },
    { name: 'Pantry Staples', slug: 'pantry-staples' },
    { name: 'Cooking & Baking Supplies', slug: 'cooking-baking-supplies' },
    { name: 'Breakfast & Cereal', slug: 'breakfast-cereal' },
    { name: 'Snacks', slug: 'snacks' },
  ];

  useEffect(() => {
    if (user?.id) {
      fetchRecentBaskets();
    } else {
      setRecentBaskets([]);
    }
  }, [user?.id, basketUpdateTrigger]);

  // Listen for basket updates from other components
  useEffect(() => {
    const handleBasketUpdate = () => {
      setBasketUpdateTrigger(prev => prev + 1);
    };

    // Listen for custom basket update events
    window.addEventListener('basketUpdated', handleBasketUpdate);
    
    return () => {
      window.removeEventListener('basketUpdated', handleBasketUpdate);
    };
  }, []);

  const fetchRecentBaskets = async () => {
    if (!user?.id) return;
    
    try {
      setLoadingBaskets(true);
      
      const { data: basketUsers, error: basketUsersError } = await supabase
        .from('basket_users')
        .select('basket_id, role')
        .eq('user_id', user.id);
      
      if (basketUsersError) throw basketUsersError;
      
      if (!basketUsers || basketUsers.length === 0) {
        setRecentBaskets([]);
        return;
      }
      
      const basketIds = basketUsers
        .map(bu => bu.basket_id)
        .filter((id): id is string => id !== null && id !== undefined);
      
      if (basketIds.length === 0) {
        setRecentBaskets([]);
        return;
      }
      
      const { data, error } = await supabase
        .from('baskets')
        .select(`
          id, 
          name, 
          updated_at,
          basket_items:basket_items(count)
        `)
        .in('id', basketIds)
        .order('updated_at', { ascending: false })
        .limit(3);
      
      if (error) throw error;
      
      if (!data) {
        setRecentBaskets([]);
        return;
      }
      
      const basketsWithDetails = await Promise.all(data.map(async (basket) => {
        const { data: basketItems, error: itemsError } = await supabase
          .from('basket_items')
          .select(`
            quantity,
            price_at_add,
            product_id,
            products:products(
              listings:listings(
                price,
                currency
              )
            )
          `)
          .eq('basket_id', basket.id);
        
        if (itemsError) {
          console.error('Error fetching basket items:', itemsError);
          return {
            id: basket.id,
            name: basket.name,
            item_count: basket.basket_items?.[0]?.count || 0,
            total_cost: 0
          };
        }
        
        let totalCost = 0;
        basketItems?.forEach(item => {
          const currentPrice = item.products?.listings?.[0]?.price;
          
          const price = currentPrice || item.price_at_add || 0;
          
          totalCost += price * (item.quantity || 1);
        });
        
        return {
          id: basket.id,
          name: basket.name,
          item_count: basket.basket_items?.[0]?.count || 0,
          total_cost: totalCost
        };
      }));
      
      setRecentBaskets(basketsWithDetails);
    } catch (error) {
      console.error('Error fetching recent baskets:', error);
      setRecentBaskets([]);
    } finally {
      setLoadingBaskets(false);
    }
  };

  const isActiveLink = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    if (href === '/categories') {
      return pathname === '/categories';
    }
    return pathname.startsWith(href);
  };

  const handleSignInClick = () => {
    openAuthModal('login');
  };

  return (
    <aside 
      className={`fixed left-0 top-16 h-[calc(100vh-4rem)] sidebar transition-all duration-300 z-30 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className="flex flex-col h-full">
        {/* Collapse Toggle */}
        <div className="p-2 sidebar-section">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-full flex items-center justify-center p-1 rounded-md hover-primary-bg transition-colors"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className={`h-4 w-4 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} 
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
          <div className="p-3 sidebar-section">
            <Link
              href="/"
              className={`flex items-center gap-3 p-2 rounded-md transition-colors ${
                isActiveLink('/') 
                  ? 'bg-primary text-buttonText' 
                  : 'hover-primary-bg'
              }`}
            >
              <HomeIcon className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span className="font-medium">Home</span>}
            </Link>
          </div>

          {/* Categories Section */}
          <div className="px-3 pb-3 sidebar-section">
            <div className="mb-2 mt-3">
              <Link
                href="/categories"
                className={`flex items-center gap-3 p-2 rounded-md transition-colors ${
                  isActiveLink('/categories') 
                    ? 'bg-primary text-buttonText' 
                    : 'hover-primary-bg'
                }`}
              >
                <CategoriesIcon className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span className="font-medium">Categories</span>}
              </Link>
            </div>

            {!isCollapsed && (
              <div className="ml-3 space-y-1">
                <Link
                  href="/best-deals"
                  className={`block p-1.5 text-sm rounded-md transition-colors font-medium ${
                    isActiveLink('/best-deals') 
                      ? 'bg-primary text-buttonText' 
                      : 'text-primary hover-primary-bg'
                  }`}
                >
                  Best Deals
                </Link>
                {categories.map((category) => (
                  <Link
                    key={category.slug}
                    href={`/categories/${category.slug}`}
                    className={`block p-1.5 text-sm rounded-md transition-colors ${
                      pathname === `/categories/${category.slug}`
                        ? 'bg-primary text-buttonText font-medium'
                        : 'hover-primary-bg'
                    }`}
                  >
                    {category.name}
                  </Link>
                ))}
                <Link
                  href="/categories"
                  className="block p-1.5 text-sm text-primary hover-primary-bg rounded-md transition-colors"
                >
                  View All Categories →
                </Link>
              </div>
            )}
          </div>

          {/* Basket Quick Actions */}
          <div className="px-3 pb-3 pt-3">
            <div className="mb-2">
              <div className="flex items-center gap-3 p-2">
                <BasketsIcon className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span className="font-medium">Baskets</span>}
              </div>
            </div>

            {!isCollapsed && (
              <div className="ml-3 space-y-1.5">
                {!user ? (
                  <div className="sidebar-notification">
                    <p className="text-sm text-muted mb-2">
                      Sign in to manage your baskets
                    </p>
                    <button
                      onClick={handleSignInClick}
                      className="text-sm text-primary hover:underline"
                    >
                      Sign In / Sign Up
                    </button>
                  </div>
                ) : (
                  <>
                    <Link
                      href="/baskets"
                      className="flex items-center gap-2 p-1.5 text-sm rounded-md hover-primary-bg transition-colors"
                    >
                      <span>➕</span>
                      Create New Basket
                    </Link>
                    <Link
                      href="/baskets"
                      className="flex items-center gap-2 p-1.5 text-sm rounded-md hover-primary-bg transition-colors"
                    >
                      <span>📋</span>
                      Manage Baskets
                    </Link>
                    
                    {/* Recent Baskets */}
                    <div className="mt-2">
                      <h4 className="text-xs font-medium text-secondary mb-1.5 uppercase tracking-wide">
                        Recent Baskets
                      </h4>
                      <div className="space-y-1">
                        {loadingBaskets ? (
                          <div className="p-1.5 text-sm text-secondary">
                            Loading...
                          </div>
                        ) : recentBaskets.length > 0 ? (
                          recentBaskets.map((basket) => (
                            <Link
                              key={basket.id}
                              href={`/basket/${basket.id}`}
                              className="block p-1.5 text-sm rounded-md hover-primary-bg transition-colors"
                            >
                              <div className="font-medium">{basket.name}</div>
                              <div className="text-xs text-gray-500">
                                {basket.item_count} items • ${basket.total_cost.toFixed(2)}
                              </div>
                            </Link>
                          ))
                        ) : (
                          <div className="p-1.5 text-sm text-secondary">
                            No recent baskets
                          </div>
                        )}
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
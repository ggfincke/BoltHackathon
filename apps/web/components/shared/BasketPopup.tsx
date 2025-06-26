'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '~/lib/auth';
import { supabase } from '~/lib/supabaseClient';
import Link from 'next/link';

type BasketItem = {
  id: string;
  product_id: string;
  quantity: number;
  price_at_add: number | null;
  product: {
    id: string;
    name: string;
    slug: string;
    listings?: {
      price: number | null;
      retailer: { name: string };
    }[];
  };
};

type Basket = {
  id: string;
  name: string;
  items: BasketItem[];
};

interface BasketPopupProps {
  onProductAdded?: () => void;
}

export default function BasketPopup({ onProductAdded }: BasketPopupProps) {
  const { user } = useAuth();
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeBasket, setActiveBasket] = useState<Basket | null>(null);
  const [baskets, setBaskets] = useState<Basket[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showBasketSelector, setShowBasketSelector] = useState(false);

  useEffect(() => {
    if (user) {
      fetchBaskets();
    }
  }, [user]);

  useEffect(() => {
    if (onProductAdded) {
      fetchBaskets();
    }
  }, [onProductAdded]);

  const fetchBaskets = async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);

      // Get user's baskets
      const { data: basketUsers, error: basketUsersError } = await supabase
        .from('basket_users')
        .select('basket_id, role')
        .eq('user_id', user.id);

      if (basketUsersError) throw basketUsersError;

      if (!basketUsers || basketUsers.length === 0) {
        setBaskets([]);
        setActiveBasket(null);
        return;
      }

      const basketIds = basketUsers
        .map(bu => bu.basket_id)
        .filter((id): id is string => id !== null);

      // Get basket details with items
      const { data: basketsData, error: basketsError } = await supabase
        .from('baskets')
        .select(`
          id,
          name,
          basket_items:basket_items(
            id,
            product_id,
            quantity,
            price_at_add,
            product:products(
              id,
              name,
              slug,
              listings:listings(
                price,
                retailer:retailers(name)
              )
            )
          )
        `)
        .in('id', basketIds)
        .order('updated_at', { ascending: false });

      if (basketsError) throw basketsError;

      const formattedBaskets = basketsData.map(basket => ({
        id: basket.id,
        name: basket.name,
        items: basket.basket_items || []
      }));

      setBaskets(formattedBaskets);

      // Set active basket (most recently updated or first one)
      if (formattedBaskets.length > 0 && !activeBasket) {
        setActiveBasket(formattedBaskets[0]);
      }

    } catch (error) {
      console.error('Error fetching baskets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getTotalPrice = () => {
    if (!activeBasket) return 0;
    
    return activeBasket.items.reduce((total, item) => {
      const currentPrice = item.product.listings?.[0]?.price;
      const price = currentPrice || item.price_at_add || 0;
      return total + (price * item.quantity);
    }, 0);
  };

  const getTotalItems = () => {
    if (!activeBasket) return 0;
    return activeBasket.items.reduce((total, item) => total + item.quantity, 0);
  };

  const handleBasketSwitch = (basket: Basket) => {
    setActiveBasket(basket);
    setShowBasketSelector(false);
  };

  if (!user || baskets.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Background overlay for proper layering */}
      <div className={`bg-background border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl backdrop-blur-sm transition-all duration-300 ${
        isMinimized ? 'w-64 h-16' : 'w-80 max-h-96'
      }`} style={{ 
        background: 'var(--background)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)'
      }}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.71 9.29M7 13h10M17 13v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6" />
            </svg>
            <div className="flex items-center gap-1">
              <span className="font-medium text-sm">{activeBasket?.name}</span>
              {baskets.length > 1 && (
                <button
                  onClick={() => setShowBasketSelector(!showBasketSelector)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">
              {getTotalItems()} items • ${getTotalPrice().toFixed(2)}
            </span>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded"
            >
              <svg className={`w-4 h-4 transition-transform ${isMinimized ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Basket Selector */}
        {showBasketSelector && !isMinimized && (
          <div className="border-b border-gray-200 dark:border-gray-700 p-2">
            <div className="space-y-1">
              {baskets.map(basket => (
                <button
                  key={basket.id}
                  onClick={() => handleBasketSwitch(basket)}
                  className={`w-full text-left p-2 rounded-md text-sm transition-colors ${
                    activeBasket?.id === basket.id
                      ? 'bg-primary text-buttonText'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{basket.name}</span>
                    <span className="text-xs opacity-70">
                      {basket.items.reduce((total, item) => total + item.quantity, 0)} items
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        {!isMinimized && (
          <div className="p-4">
            {isLoading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : activeBasket && activeBasket.items.length > 0 ? (
              <div className="space-y-3">
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {activeBasket.items.slice(0, 5).map(item => {
                    const currentPrice = item.product.listings?.[0]?.price;
                    const price = currentPrice || item.price_at_add || 0;
                    
                    return (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{item.product.name}</p>
                          <p className="text-xs text-muted">
                            {item.quantity} × ${price.toFixed(2)}
                          </p>
                        </div>
                        <span className="font-medium ml-2">
                          ${(price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                  
                  {activeBasket.items.length > 5 && (
                    <p className="text-xs text-muted text-center">
                      +{activeBasket.items.length - 5} more items
                    </p>
                  )}
                </div>
                
                <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-medium">Total:</span>
                    <span className="font-bold text-lg">${getTotalPrice().toFixed(2)}</span>
                  </div>
                  
                  <Link
                    href={`/basket/${activeBasket.id}`}
                    className="block w-full bg-primary text-buttonText text-center py-2 rounded-md hover:bg-opacity-90 transition-colors font-medium"
                  >
                    View Basket
                  </Link>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <svg className="w-12 h-12 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.71 9.29M7 13h10M17 13v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6" />
                </svg>
                <p className="text-sm text-muted mb-3">Your basket is empty</p>
                <Link
                  href="/categories"
                  className="text-sm text-primary hover:underline"
                >
                  Start shopping
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
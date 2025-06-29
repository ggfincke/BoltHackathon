'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '~/lib/auth';
import { supabase } from '~/lib/supabaseClient';
import Link from 'next/link';

type BasketItem = {
  id: string;
  product_id: string;
  quantity: number;
  price_at_add: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  added_at?: string | null;
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
  const [showBasketSelectorModal, setShowBasketSelectorModal] = useState(false);
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());
  const [debounceTimers, setDebounceTimers] = useState<Map<string, NodeJS.Timeout>>(new Map());

  // Ref to detect clicks outside the popup
  const containerRef = useRef<HTMLDivElement>(null);
  // Ref to keep the latest visibility state of the selector modal
  const showSelectorRef = useRef<boolean>(showBasketSelectorModal);

  // Keep ref up-to-date each render
  showSelectorRef.current = showBasketSelectorModal;

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

    // Add new product optimistically
  const addProductOptimistically = useCallback((
    productId: string, 
    productName: string, 
    price?: number | null,
    retailerName?: string | null,
    imageUrl?: string | null,
    productSlug?: string
  ) => {
    if (!activeBasket) return;

    // Create an item optimistically
    const newItem: BasketItem = {
      // temp id
      id: `temp-${Date.now()}`, 
      product_id: productId,
      quantity: 1,
      price_at_add: price || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      added_at: new Date().toISOString(),
      product: {
        id: productId,
        name: productName,
        slug: productSlug || productName.toLowerCase().replace(/\s+/g, '-'),
        listings: price && retailerName ? [{
          price: price,
          retailer: { name: retailerName }
        }] : []
      }
    };

    // Add to beginning of list (most recent)
    const updatedItems = [newItem, ...activeBasket.items];
    setActiveBasket({ ...activeBasket, items: updatedItems });
    setBaskets(prev => prev.map(basket =>
      basket.id === activeBasket.id ? { ...basket, items: updatedItems } : basket
    ));
  }, [activeBasket]);

  // Listen for basket updates
  useEffect(() => {
    const handleBasketUpdate = (event: any) => {
      // If optimistic add event, handle differently
      if (event.detail?.type === 'optimisticAdd') {
        addProductOptimistically(
          event.detail.productId, 
          event.detail.productName,
          event.detail.price,
          event.detail.retailerName,
          event.detail.imageUrl,
          event.detail.productSlug
        );
        
        // Fetch fresh data after delay to sync w/ db
        setTimeout(() => {
          fetchBaskets(true); // Preserve overlay size
        }, 1000);
      } else {
        // Regular basket update - only fetch if not optimistic mode
        fetchBaskets(true); // Preserve overlay size
      }
    };

    window.addEventListener('basketUpdated', handleBasketUpdate);
    
    return () => {
      // Clean up pending timers
      debounceTimers.forEach(timer => clearTimeout(timer));
      setDebounceTimers(new Map());
      
      window.removeEventListener('basketUpdated', handleBasketUpdate);
    };
  }, [user, addProductOptimistically]); // Add dependencies

  // Close/minimize the popup if a click occurs outside of it
  useEffect(() => {
    const handleClickOutside = (event: Event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        showSelectorRef.current
      ) {
        // Close only the basket selector modal if it is open
        setShowBasketSelectorModal(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  const fetchBaskets = async (preserveOverlaySize = false) => {
    if (!user?.id) return;

    try {
      // Only show loading if not preserving overlay size
      if (!preserveOverlaySize) {
        setIsLoading(true);
      }

      // Get user's baskets (most recent first)
      const { data: basketUsers, error: basketUsersError } = await supabase
        .from('basket_users')
        .select('basket_id, role')
        .eq('user_id', user.id);

      if (basketUsersError) {
        console.error('Error fetching basket users:', basketUsersError);
        throw basketUsersError;
      }

      if (!basketUsers || basketUsers.length === 0) {
        setBaskets([]);
        setActiveBasket(null);
        return;
      }

      const basketIds = basketUsers
        .map(bu => bu.basket_id)
        .filter((id): id is string => id !== null);

      if (basketIds.length === 0) {
        setBaskets([]);
        setActiveBasket(null);
        return;
      }

      // Get baskets first
      const { data: basketsData, error: basketsError } = await supabase
        .from('baskets')
        .select('id, name, updated_at')
        .in('id', basketIds)
        .order('updated_at', { ascending: false });

      if (basketsError) {
        console.error('Error fetching baskets:', basketsError);
        throw basketsError;
      }

      if (!basketsData) {
        setBaskets([]);
        setActiveBasket(null);
        return;
      }

      // Get basket details with items
      const basketsWithItems = await Promise.all(
        basketsData.map(async (basket) => {
          try {
            const { data: basketItemsData, error: itemsError } = await supabase
              .from('basket_items')
              .select(`
                id,
                product_id,
                quantity,
                price_at_add,
                added_at,
                updated_at,
                products:product_id(
                  id,
                  name,
                  slug,
                  listings:listings(
                    price,
                    retailer:retailers(name)
                  )
                )
              `)
              .eq('basket_id', basket.id);

            if (itemsError) {
              console.error('Basket items error for basket', basket.id, ':', itemsError);
              return {
                id: basket.id,
                name: basket.name,
                items: []
              };
            }

            const validItems = (basketItemsData || [])
              .filter(item => item.quantity !== null && item.products)
              .map(item => ({
                ...item,
                quantity: item.quantity as number,
                created_at: item.added_at, 
                product: {
                  ...item.products,
                  listings: (item.products.listings || []).map((listing: any) => ({
                    price: listing.price,
                    retailer: listing.retailer
                  }))
                }
              }))
              .sort((a, b) => {
                // Sort by added_at (initial addition time) descending
                const aTime = new Date(a.created_at || a.added_at || 0).getTime();
                const bTime = new Date(b.created_at || b.added_at || 0).getTime();
                return bTime - aTime;
              });

            return {
              id: basket.id,
              name: basket.name,
              items: validItems
            };
          } catch (error) {
            console.error('Error processing basket', basket.id, ':', error);
            return {
              id: basket.id,
              name: basket.name,
              items: []
            };
          }
        })
      );

      setBaskets(basketsWithItems);

      // Update active basket if exists, otherwise set to first
      if (activeBasket) {
        const updatedActiveBasket = basketsWithItems.find(b => b.id === activeBasket.id);
        if (updatedActiveBasket) {
          setActiveBasket(updatedActiveBasket);
        } else if (basketsWithItems.length > 0) {
          setActiveBasket(basketsWithItems[0]);
        }
      } else if (basketsWithItems.length > 0) {
        setActiveBasket(basketsWithItems[0]);
      }

    } catch (error) {
      console.error('Error fetching baskets:', error);
      // Set empty state on error
      setBaskets([]);
      setActiveBasket(null);
    } finally {
      // Only hide loading if showing it
      if (!preserveOverlaySize) {
        setIsLoading(false);
      }
    }
  };

  const updateItemQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity < 1) {
      await removeItem(itemId);
      return;
    }

    // Optimistic update - update UI
    if (activeBasket) {
      const updatedItems = activeBasket.items.map(item =>
        item.id === itemId ? { ...item, quantity: newQuantity } : item
      ).sort((a, b) => {
        // Keep same sorting - by added_at (initial addition time)
        const aTime = new Date(a.created_at || a.added_at || 0).getTime();
        const bTime = new Date(b.created_at || b.added_at || 0).getTime();
        return bTime - aTime;
      });
      
      setActiveBasket({ ...activeBasket, items: updatedItems });
      
      // Update the baskets array too
      setBaskets(prev => prev.map(basket =>
        basket.id === activeBasket.id ? { ...basket, items: updatedItems } : basket
      ));
    }

    // Clear any existing debounce timer for this item
    const currentTimers = debounceTimers;
    if (currentTimers.has(itemId)) {
      clearTimeout(currentTimers.get(itemId)!);
    }

    // Set up debounced database update
    const newTimer = setTimeout(async () => {
      try {
        setUpdatingItems(prev => new Set(prev).add(itemId));

        const { error } = await supabase
          .from('basket_items')
          .update({ 
            quantity: newQuantity
            // Don't update added_at - only updated_at should change automatically
          })
          .eq('id', itemId);

        if (error) throw error;

      } catch (error) {
        console.error('Error updating item quantity:', error);
        // Revert optimistic update
        fetchBaskets();
      } finally {
        setUpdatingItems(prev => {
          const newSet = new Set(prev);
          newSet.delete(itemId);
          return newSet;
        });
        
        // Clean up
        setDebounceTimers(prev => {
          const newMap = new Map(prev);
          newMap.delete(itemId);
          return newMap;
        });
      }
    }, 500); // 500ms debounce

    // Store timer
    setDebounceTimers(prev => {
      const newMap = new Map(prev);
      newMap.set(itemId, newTimer);
      return newMap;
    });
  };

  const removeItem = async (itemId: string) => {
    // Store item for potential rollback
    const itemToRemove = activeBasket?.items.find(item => item.id === itemId);
    
    // Optimistic update - remove from UI
    if (activeBasket) {
      const updatedItems = activeBasket.items.filter(item => item.id !== itemId);
      setActiveBasket({ ...activeBasket, items: updatedItems });
      
      // Update baskets array too
      setBaskets(prev => prev.map(basket =>
        basket.id === activeBasket.id ? { ...basket, items: updatedItems } : basket
      ));
    }

    try {
      setUpdatingItems(prev => new Set(prev).add(itemId));

      const { error } = await supabase
        .from('basket_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

    } catch (error) {
      console.error('Error removing item:', error);
      // Revert optimistic update
      if (activeBasket && itemToRemove) {
        const revertedItems = [...activeBasket.items, itemToRemove].sort((a, b) => {
          const aTime = new Date(a.created_at || a.added_at || 0).getTime();
          const bTime = new Date(b.created_at || b.added_at || 0).getTime();
          return bTime - aTime;
        });
        setActiveBasket({ ...activeBasket, items: revertedItems });
        setBaskets(prev => prev.map(basket =>
          basket.id === activeBasket.id ? { ...basket, items: revertedItems } : basket
        ));
      }
    } finally {
      setUpdatingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
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
    setShowBasketSelectorModal(false);
  };

  const openBasketSelectorModal = () => {
    setShowBasketSelectorModal(true);
  };

  if (!user || baskets.length === 0) {
    return null;
  }

  return (
    <>
      <div className="fixed bottom-4 right-4 z-50" ref={containerRef}>
        {/* Background overlay for proper layering */}
        <div className={`relative bg-background border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl backdrop-blur-sm transition-all duration-300 ${
          isMinimized ? 'w-72 h-16' : 'w-[28rem] max-h-[36rem]'
        }`} style={{ 
          background: 'var(--background)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)'
        }}>
          {/* Header */}
          <div className="flex items-center p-4 border-b border-gray-200 dark:border-gray-700">
            {/* Trigger (name + arrow) */}
            <button
              className={`flex items-center flex-1 min-w-0 mr-2 gap-2 ${
                baskets.length > 1 ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded px-2 py-1 -mx-2 -my-1 transition-colors' : 'cursor-default'
              }`}
              onClick={baskets.length > 1 ? openBasketSelectorModal : undefined}
              disabled={baskets.length <= 1}
              style={{ background: 'transparent' }}
            >
              {/* Icon & name */}
              <svg className="w-5 h-5 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.71 9.29M7 13h10M17 13v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6" />
              </svg>
              <span
                className={`font-medium text-sm ${
                  isMinimized ? 'text-container-sm' : 'text-container-md'
                } truncate-tooltip flex-1 min-w-0`}
                data-tooltip={activeBasket?.name}
                title={activeBasket?.name}
                style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              > 
                {activeBasket?.name}
              </span>
              {/* Arrow */}
              {baskets.length > 1 && (
                <svg className="w-4 h-4 text-muted flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              )}
            </button>

            {/* Item count and total (NOT part of trigger) */}
            <span className="text-xs text-muted whitespace-nowrap ml-2" style={{ minWidth: '80px', textAlign: 'right' }}>
              {getTotalItems()} items • ${getTotalPrice().toFixed(2)}
            </span>

            {/* Minimize/maximize button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMinimized(!isMinimized);
              }}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded flex-shrink-0 ml-2"
              style={{ width: '28px', height: '28px' }}
            >
              <svg className={`w-4 h-4 transition-transform ${isMinimized ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
          </div>

          {/* Content */}
          {!isMinimized && (
            <div className="p-4">
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : activeBasket && activeBasket.items.length > 0 ? (
                <div className="space-y-3">
                  <div className="max-h-80 overflow-y-auto space-y-3">
                    {activeBasket.items.slice(0, 8).map(item => {
                      const currentPrice = item.product.listings?.[0]?.price;
                      const price = currentPrice || item.price_at_add || 0;
                      const isUpdating = updatingItems.has(item.id);
                      
                      return (
                        <div key={item.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 dark:border-gray-800">
                          <div className="flex-1 min-w-0">
                            <p 
                              className="font-medium text-sm truncate-tooltip"
                              data-tooltip={item.product.name}
                              title={item.product.name}
                            >
                              {item.product.name}
                            </p>
                            <p className="text-xs text-muted">${price.toFixed(2)} each</p>
                          </div>
                          
                          {/* Quantity Controls */}
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                              disabled={isUpdating}
                              className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center text-sm font-medium disabled:opacity-50 transition-colors"
                            >
                              -
                            </button>
                            <span className="text-sm font-medium w-8 text-center">
                              {isUpdating ? '...' : item.quantity}
                            </span>
                            <button
                              onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                              disabled={isUpdating}
                              className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 flex items-center justify-center text-sm font-medium disabled:opacity-50 transition-colors"
                            >
                              +
                            </button>
                          </div>
                          
                          <span className="font-medium text-sm min-w-0">
                            ${(price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                    
                    {activeBasket.items.length > 8 && (
                      <div className="text-center">
                        <p className="text-xs text-muted">
                          +{activeBasket.items.length - 8} more items
                        </p>
                      </div>
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

          {/* Basket Selector Dropdown */}
          {showBasketSelectorModal && (
            <>
              {/* Full screen backdrop - catches all clicks */}
              <div 
                className="fixed inset-0 z-[100]" 
                onClick={() => setShowBasketSelectorModal(false)}
                style={{ 
                  pointerEvents: 'all',
                  background: 'transparent'
                }}
              />
              
              <div 
                className="absolute right-0 bottom-[calc(100%-40px)] w-80 bg-background border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-[101] max-h-96 overflow-hidden backdrop-blur-xl"
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: 'rgba(var(--background-rgb), 0.95)',
                  borderColor: 'var(--surface)',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(var(--background-rgb), 0.05)'
                }}
              >
                {/* Header */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="font-medium text-sm">Switch Basket</h3>
                </div>

                {/* Content */}
                <div className="max-h-80 overflow-y-auto">
                  <div className="p-2">
                    {baskets.map(basket => (
                      <button
                        key={basket.id}
                        onClick={() => handleBasketSwitch(basket)}
                        className={`w-full text-left p-3 rounded-lg transition-colors mb-1 ${
                          activeBasket?.id === basket.id
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                        }`}
                      >
                        <div className="flex justify-between items-start min-w-0 gap-2">
                          <div className="flex-1 min-w-0">
                            <p 
                              className="font-medium text-sm mb-1 truncate-tooltip"
                              data-tooltip={basket.name}
                              title={basket.name}
                            >
                              {basket.name}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted">
                              <span>{basket.items.reduce((total, item) => total + item.quantity, 0)} items</span>
                              <span>•</span>
                              <span>${basket.items.reduce((total, item) => {
                                const price = item.product.listings?.[0]?.price || item.price_at_add || 0;
                                return total + (price * item.quantity);
                              }, 0).toFixed(2)}</span>
                            </div>
                          </div>
                          
                          {activeBasket?.id === basket.id && (
                            <div className="flex-shrink-0">
                              <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="p-2 border-t border-gray-200 dark:border-gray-700">
                    <Link
                      href="/create-basket"
                      className="block w-full text-center py-2 px-3 rounded-lg text-sm text-primary hover:bg-primary/5 transition-colors font-medium"
                      onClick={() => setShowBasketSelectorModal(false)}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Create New Basket
                      </div>
                    </Link>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
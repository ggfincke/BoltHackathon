'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '~/lib/supabaseClient';
import { useAuth } from '~/lib/auth';
import Link from 'next/link';
import { format } from 'date-fns';

type Basket = {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  item_count: number;
  total_cost: number;
};

export default function Baskets() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [baskets, setBaskets] = useState<Basket[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      if (user) {
        fetchBaskets();
      } else {
        setIsLoading(false);
      }
    }
  }, [user, authLoading, router]);

  const fetchBaskets = async () => {
    try {
      setIsLoading(true);
      
      // Check if user exists before making the query
      if (!user?.id) {
        setBaskets([]);
        setIsLoading(false);
        return;
      }
      
      // Get baskets the user has access to
      const { data: basketUsers, error: basketUsersError } = await supabase
        .from('basket_users')
        .select('basket_id, role')
        .eq('user_id', user.id);
      
      if (basketUsersError) throw basketUsersError;
      
      if (!basketUsers || basketUsers.length === 0) {
        setBaskets([]);
        setIsLoading(false);
        return;
      }
      
      // Filter out null basket_ids and ensure we have valid strings
      const basketIds = basketUsers
        .map(bu => bu.basket_id)
        .filter((id): id is string => id !== null && id !== undefined);
      
      if (basketIds.length === 0) {
        setBaskets([]);
        setIsLoading(false);
        return;
      }
      
      // Get basket details with item count and total cost
      const { data, error } = await supabase
        .from('baskets')
        .select(`
          id, 
          name, 
          description, 
          is_public, 
          created_at, 
          updated_at,
          basket_items:basket_items(count)
        `)
        .in('id', basketIds);
      
      if (error) throw error;
      
      if (!data) {
        setBaskets([]);
        setIsLoading(false);
        return;
      }
      
      // Get total cost for each basket
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
        
        if (itemsError) throw itemsError;
        
        // Calculate total cost based on current prices or price_at_add
        let totalCost = 0;
        basketItems?.forEach(item => {
          // Get current price from listings if available
          const currentPrice = item.products?.listings?.[0]?.price;
          
          // Use current price or fallback to price_at_add
          const price = currentPrice || item.price_at_add || 0;
          
          // Multiply by quantity
          totalCost += price * (item.quantity || 1);
        });
        
        return {
          id: basket.id,
          name: basket.name,
          description: basket.description,
          is_public: basket.is_public ?? false, 
          created_at: basket.created_at ?? new Date().toISOString(),
          updated_at: basket.updated_at ?? new Date().toISOString(),
          item_count: basket.basket_items?.[0]?.count || 0,
          total_cost: totalCost
        };
      }));
      
      setBaskets(basketsWithDetails);
    } catch (error) {
      console.error('Error fetching baskets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex justify-center py-12">
          <div className="loading-shimmer h-12 w-12 rounded-full"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <div className="card-enhanced p-8 text-center max-w-md mx-auto">
          <div className="mb-4">
            <svg 
              className="w-16 h-16 mx-auto mb-4" 
              style={{ color: 'var(--text-muted)' }}
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4m-2.4 0L2 1M7 13L5.4 5M7 13l-2.293 2.293A1 1 0 005 17h12M17 13v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6.28" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text)' }}>
            Sign in to view your baskets
          </h2>
          <p className="text-muted mb-6">
            You need to be signed in to create and manage your shopping baskets.
          </p>
          <Link 
            href="/auth/login?redirectedFrom=/baskets"
            className="btn-base inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all hover-lift"
            style={{ 
              background: 'var(--primary)', 
              color: 'var(--dark-text)' 
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            Sign In or Create Account
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2 gradient-text">Your Baskets</h1>
          <p className="text-muted">
            Manage your shopping lists and track the best deals
          </p>
        </div>
        <Link
          href="/create-basket"
          className="btn-base inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all hover-lift"
          style={{ 
            background: 'var(--primary)', 
            color: 'var(--dark-text)' 
          }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create New Basket
        </Link>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card-enhanced p-6">
              <div className="loading-shimmer h-6 w-3/4 mb-3 rounded"></div>
              <div className="loading-shimmer h-4 w-full mb-2 rounded"></div>
              <div className="loading-shimmer h-4 w-2/3 mb-4 rounded"></div>
              <div className="flex justify-between">
                <div className="loading-shimmer h-4 w-16 rounded"></div>
                <div className="loading-shimmer h-4 w-20 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      ) : baskets.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {baskets.map((basket) => (
            <Link
              key={basket.id}
              href={`/basket/${basket.id}`}
              className="group card-enhanced p-6 hover-lift transition-all duration-300"
              style={{ 
                background: 'var(--surface)',
                border: '1px solid var(--border-primary)'
              }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-semibold mb-2 line-clamp-2 group-hover:text-primary transition-colors" style={{ color: 'var(--text)' }}>
                    {basket.name}
                  </h2>
                  {basket.description && (
                    <p className="text-muted line-clamp-2 text-sm leading-relaxed">
                      {basket.description}
                    </p>
                  )}
                </div>
                <div className="ml-4 flex-shrink-0">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--bg-muted)' }}>
                    <svg 
                      className="w-5 h-5" 
                      style={{ color: 'var(--primary)' }}
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4m-2.4 0L2 1M7 13L5.4 5M7 13l-2.293 2.293A1 1 0 005 17h12M17 13v6a2 2 0 01-2 2H9a2 2 0 01-2-2v-6.28" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center pt-4 border-t" style={{ borderColor: 'var(--border-primary)' }}>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <div className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
                      {basket.item_count}
                    </div>
                    <div className="text-xs text-muted">
                      {basket.item_count === 1 ? 'Item' : 'Items'}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold" style={{ color: 'var(--primary)' }}>
                      ${basket.total_cost.toFixed(2)}
                    </div>
                    <div className="text-xs text-muted">Est. Total</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted">Last updated</div>
                  <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                    {format(new Date(basket.updated_at), 'MMM d, yyyy')}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card-enhanced p-12 text-center max-w-lg mx-auto">
          <div className="mb-6">
            <svg 
              className="w-20 h-20 mx-auto mb-4" 
              style={{ color: 'var(--text-muted)' }}
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-3" style={{ color: 'var(--text)' }}>
            No baskets yet
          </h2>
          <p className="text-muted mb-8 leading-relaxed">
            Create your first basket to start tracking products and comparing prices across different retailers.
          </p>
          <Link
            href="/create-basket"
            className="btn-base inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all hover-lift"
            style={{ 
              background: 'var(--primary)', 
              color: 'var(--dark-text)' 
            }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Your First Basket
          </Link>
        </div>
      )}
    </div>
  );
}
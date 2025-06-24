"use client";

import Link from 'next/link';
import { FaArrowRight } from 'react-icons/fa';
import { useState, useEffect } from 'react';
import { useAuth } from '~/lib/auth';
import { supabase } from '~/lib/supabaseClient';

interface Basket {
  id: string;
  name: string;
  itemCount: number;
  totalCost: number;
}

interface RecentBasketsProps {
  baskets?: Basket[];
}

export default function RecentBaskets({ baskets: propBaskets }: RecentBasketsProps) {
  const { user } = useAuth();
  const [baskets, setBaskets] = useState<Basket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchRecentBaskets();
    } else {
      setBaskets([]);
      setLoading(false);
    }
  }, [user?.id]);

  const fetchRecentBaskets = async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      
      // Get baskets the user has access to
      const { data: basketUsers, error: basketUsersError } = await supabase
        .from('basket_users')
        .select('basket_id, role')
        .eq('user_id', user.id);
      
      if (basketUsersError) throw basketUsersError;
      
      if (!basketUsers || basketUsers.length === 0) {
        setBaskets([]);
        return;
      }
      
      // Filter out null basket_ids and ensure we have valid strings
      const basketIds = basketUsers
        .map(bu => bu.basket_id)
        .filter((id): id is string => id !== null && id !== undefined);
      
      if (basketIds.length === 0) {
        setBaskets([]);
        return;
      }
      
      // Get basket details with item count
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
        setBaskets([]);
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
        
        if (itemsError) {
          console.error('Error fetching basket items:', itemsError);
          return {
            id: basket.id,
            name: basket.name,
            itemCount: basket.basket_items?.[0]?.count || 0,
            totalCost: 0
          };
        }
        
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
          itemCount: basket.basket_items?.[0]?.count || 0,
          totalCost: totalCost
        };
      }));
      
      setBaskets(basketsWithDetails);
    } catch (error) {
      console.error('Error fetching recent baskets:', error);
      setBaskets([]);
    } finally {
      setLoading(false);
    }
  };

  // Use prop baskets if provided, otherwise use fetched baskets
  const displayBaskets = propBaskets || baskets;

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
        {loading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : !user ? (
          <div className="text-center py-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Sign in to view your recent baskets
            </p>
            <Link
              href="/auth/login"
              className="text-sm text-primary hover:underline"
            >
              Sign In / Sign Up
            </Link>
          </div>
        ) : displayBaskets.length > 0 ? (
          displayBaskets.map((basket) => (
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
          ))
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              No recent baskets found
            </p>
            <Link
              href="/baskets"
              className="text-sm text-primary hover:underline"
            >
              Create your first basket
            </Link>
          </div>
        )}
      </div>
    </div>
  );
} 
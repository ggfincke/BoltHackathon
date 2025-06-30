"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '~/lib/auth';
import { supabase } from '~/lib/supabaseClient';

interface UserStatsProps {
  trackedItems?: number;
  potentialSavings?: number;
  avgDiscount?: number;
}

export default function UserStats({ 
  trackedItems: propTrackedItems, 
  potentialSavings: propPotentialSavings, 
  avgDiscount: propAvgDiscount 
}: UserStatsProps) {
  const { user } = useAuth();
  const [trackedItems, setTrackedItems] = useState(propTrackedItems || 0);
  const [potentialSavings, setPotentialSavings] = useState(propPotentialSavings || 0);
  const [avgDiscount, setAvgDiscount] = useState(propAvgDiscount || 0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (propTrackedItems !== undefined && propPotentialSavings !== undefined && propAvgDiscount !== undefined) {
      setTrackedItems(propTrackedItems);
      setPotentialSavings(propPotentialSavings);
      setAvgDiscount(propAvgDiscount);
      setLoading(false);
      return;
    }
    
    if (user) {
      fetchUserStats();
    } else {
      // Default values for non-authenticated users
      setTrackedItems(0);
      setPotentialSavings(0);
      setAvgDiscount(0);
      setLoading(false);
    }
  }, [user, propTrackedItems, propPotentialSavings, propAvgDiscount]);

  const fetchUserStats = async () => {
    try {
      setLoading(true);
      
      let totalTrackedItems = 0;
      // Map of product_id to total quantity (from basket items & trackings)
      const productQuantities: Record<string, number> = {};
      
      // Count individual product trackings

      const { data: productTrackings, error: trackingError } = await supabase
        .from('product_trackings')
        .select('id, target_price, product_id')
        .eq('user_id', user!.id);
      
      if (trackingError) throw trackingError;
      
      // Add individual product trackings to the count
      totalTrackedItems += productTrackings?.length || 0;
      
      // Get baskets the user has access to (similar to other components)
      const { data: userBaskets, error: basketUsersError } = await supabase
        .from('basket_users')
        .select('basket_id')
        .eq('user_id', user!.id);
      
      if (basketUsersError) {
        console.error('UserStats - basketUsersError:', basketUsersError);
      } else if (userBaskets && userBaskets.length > 0) {
        // Filter out null basket_ids
        const basketIds = userBaskets
          .map(bu => bu.basket_id)
          .filter((id): id is string => id !== null);
          
        if (basketIds.length > 0) {
          // Get all basket items for these baskets
          const { data: basketItems, error: basketItemsError } = await supabase
            .from('basket_items')
            .select('quantity, product_id')
            .in('basket_id', basketIds);
          
          if (basketItemsError) {
            console.error('UserStats - basketItemsError:', basketItemsError);
          } else {
            // Build a map of product quantities from basket items
            basketItems?.forEach(item => {
              const qty = item.quantity || 1;
              if (productQuantities[item.product_id]) {
                productQuantities[item.product_id] += qty;
              } else {
                productQuantities[item.product_id] = qty;
              }
            });

            // Also add these quantities to the tracked item count
            const basketItemsCount = basketItems?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 0;
            totalTrackedItems += basketItemsCount;
          }
        }
      }
      
      // Include product trackings (quantity 1 each)
      productTrackings?.forEach(pt => {
        if (productQuantities[pt.product_id]) {
          productQuantities[pt.product_id] += 1;
        } else {
          productQuantities[pt.product_id] = 1;
        }
      });

      const productIdsForPricing = Object.keys(productQuantities);

      let totalSavings = 0;
      let totalDiscountPercent = 0;
      let discountCount = 0;

      if (productIdsForPricing.length > 0) {
        const { data: listings, error: listingsError } = await supabase
          .from('listings')
          .select('product_id, price')
          .in('product_id', productIdsForPricing)
          .order('price', { ascending: true });

        if (!listingsError && listings) {
          // Group listings prices per product
          const priceRangeByProduct: Record<string, { min: number; max: number }> = {};

          listings.forEach(listing => {
            if (listing.price === null) return;
            const pid = listing.product_id as string;
            if (!priceRangeByProduct[pid]) {
              priceRangeByProduct[pid] = { min: listing.price, max: listing.price };
            } else {
              const range = priceRangeByProduct[pid];
              if (listing.price < range.min) range.min = listing.price;
              if (listing.price > range.max) range.max = listing.price;
            }
          });

          Object.entries(priceRangeByProduct).forEach(([pid, range]) => {
            const diff = range.max - range.min;
            if (diff > 0) {
              const qty = productQuantities[pid] || 1;
              totalSavings += diff * qty;
              const percent = (diff / range.max) * 100;
              totalDiscountPercent += percent;
              discountCount++;
            }
          });
        }
      }

      setTrackedItems(totalTrackedItems);
      setPotentialSavings(Math.round(totalSavings * 100) / 100);
      setAvgDiscount(discountCount > 0 ? Math.round(totalDiscountPercent / discountCount) : 0);

    } catch (error) {
      console.error('Error fetching user stats:', error);
      // Set default values on error
      setTrackedItems(0);
      setPotentialSavings(0);
      setAvgDiscount(0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface rounded-lg shadow-sm p-6 h-full flex flex-col">
      <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text)' }}>
        Your Stats
      </h2>
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="flex flex-col justify-between flex-1">
          <div
            className="p-4 rounded-lg text-center flex flex-col justify-center min-h-[80px]"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--primary)',
            }}
          >
            <p className="text-2xl font-bold leading-tight" style={{ color: 'var(--primary)' }}>
              {trackedItems}
            </p>
            <p className="text-sm opacity-80 mt-1" style={{ color: 'var(--text)' }}>
              {trackedItems === 1 ? 'Tracked Item' : 'Tracked Items'}
            </p>
          </div>

          <div
            className="p-4 rounded-lg text-center flex flex-col justify-center min-h-[80px]"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--secondary)',
            }}
          >
            <p className="text-2xl font-bold leading-tight" style={{ color: 'var(--secondary)' }}>
              ${potentialSavings.toFixed(2)}
            </p>
            <p className="text-sm opacity-80 mt-1" style={{ color: 'var(--text)' }}>
              Potential Savings
            </p>
          </div>

          <div
            className="p-4 rounded-lg text-center flex flex-col justify-center min-h-[80px]"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--accent)',
            }}
          >
            <p className="text-2xl font-bold leading-tight" style={{ color: 'var(--accent)' }}>
              {avgDiscount}%
            </p>
            <p className="text-sm opacity-80 mt-1" style={{ color: 'var(--text)' }}>
              Avg. Discount
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
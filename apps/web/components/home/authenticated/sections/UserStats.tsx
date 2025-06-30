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
      
      // Count product trackings
      const { data: productTrackings, error: trackingError } = await supabase
        .from('product_trackings')
        .select('id, target_price, product_id')
        .eq('user_id', user!.id);
      
      if (trackingError) throw trackingError;
      
      // Count basket trackings
      const { data: basketTrackings, error: basketError } = await supabase
        .from('basket_trackings')
        .select('id, basket_id')
        .eq('user_id', user!.id);
      
      if (basketError) throw basketError;
      
      // Calculate total tracked items
      const totalTrackedItems = (productTrackings?.length || 0) + (basketTrackings?.length || 0);
      setTrackedItems(totalTrackedItems);
      
      // Calculate potential savings
      if (productTrackings && productTrackings.length > 0) {
        let totalSavings = 0;
        let totalDiscountPercent = 0;
        let discountCount = 0;
        
        // Get current prices for products with target prices
        const productIds = productTrackings
          .filter(pt => pt.target_price !== null)
          .map(pt => pt.product_id);
        
        if (productIds.length > 0) {
          const { data: listings, error: listingsError } = await supabase
            .from('listings')
            .select('product_id, price')
            .in('product_id', productIds)
            .order('price', { ascending: true });
          
          if (!listingsError && listings) {
            // Group listings by product_id to get lowest price per product
            const lowestPriceByProduct: Record<string, number> = {};
            listings.forEach(listing => {
              if (listing.price !== null) {
                if (!lowestPriceByProduct[listing.product_id] || listing.price < lowestPriceByProduct[listing.product_id]) {
                  lowestPriceByProduct[listing.product_id] = listing.price;
                }
              }
            });
            
            // Calculate savings and discounts
            productTrackings
              .filter(pt => pt.target_price !== null)
              .forEach(pt => {
                const currentPrice = lowestPriceByProduct[pt.product_id];
                if (currentPrice && pt.target_price) {
                  if (currentPrice > pt.target_price) {
                    // Potential savings if price drops to target
                    totalSavings += (currentPrice - pt.target_price);
                    
                    // Calculate discount percentage
                    const discountPercent = ((currentPrice - pt.target_price) / currentPrice) * 100;
                    totalDiscountPercent += discountPercent;
                    discountCount++;
                  }
                }
              });
          }
        }
        
        // Set potential savings (rounded to 2 decimal places)
        setPotentialSavings(Math.round(totalSavings * 100) / 100);
        
        // Set average discount percentage (rounded to nearest integer)
        setAvgDiscount(discountCount > 0 ? Math.round(totalDiscountPercent / discountCount) : 0);
      } else {
        setPotentialSavings(0);
        setAvgDiscount(0);
      }
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
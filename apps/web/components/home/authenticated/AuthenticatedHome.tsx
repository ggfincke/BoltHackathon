"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '~/lib/auth';
import WelcomeBanner from './sections/WelcomeBanner';
import UserStats from './sections/UserStats';
import BestDeals from './sections/BestDeals';
import PopularCategories from './sections/PopularCategories';
import RecentBaskets from './sections/RecentBaskets';
import QuickActions from './sections/QuickActions';
import { supabase } from '~/lib/supabaseClient';

export default function AuthenticatedHome() {
  const { user } = useAuth();
  const [userStats, setUserStats] = useState({
    trackedItems: 0,
    potentialSavings: 0,
    avgDiscount: 0
  });
  const [loading, setLoading] = useState(true);
  const username = user?.email?.split('@')[0] || 'there';

  useEffect(() => {
    if (user) {
      fetchUserStats();
    } else {
      setLoading(false);
    }
  }, [user]);

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
      
      // Calculate potential savings
      let potentialSavings = 0;
      let totalDiscountPercent = 0;
      let discountCount = 0;
      
      if (productTrackings && productTrackings.length > 0) {
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
                    potentialSavings += (currentPrice - pt.target_price);
                    
                    // Calculate discount percentage
                    const discountPercent = ((currentPrice - pt.target_price) / currentPrice) * 100;
                    totalDiscountPercent += discountPercent;
                    discountCount++;
                  }
                }
              });
          }
        }
      }
      
      // Set user stats
      setUserStats({
        trackedItems: totalTrackedItems,
        potentialSavings: Math.round(potentialSavings * 100) / 100,
        avgDiscount: discountCount > 0 ? Math.round(totalDiscountPercent / discountCount) : 0
      });
    } catch (error) {
      console.error('Error fetching user stats:', error);
      // Set default values on error
      setUserStats({
        trackedItems: 0,
        potentialSavings: 0,
        avgDiscount: 0
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-0">
      <WelcomeBanner username={username} />
      
      {/* Best Deals - Full Width */}
      <BestDeals />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Left Column - Stats */}
        <div className="lg:col-span-1">
          <UserStats 
            trackedItems={userStats.trackedItems}
            potentialSavings={userStats.potentialSavings}
            avgDiscount={userStats.avgDiscount}
          />
          {/* <QuickActions /> */}
        </div>

        {/* Right Column - Popular Categories & Recent Baskets */}
        <div className="lg:col-span-2">
          <PopularCategories />
          {/* <RecentBaskets /> */}
        </div>
      </div>
    </div>
  );
}
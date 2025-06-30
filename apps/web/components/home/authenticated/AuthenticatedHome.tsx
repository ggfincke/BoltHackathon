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
      
      // Product tracking has been disabled - focusing only on basket notifications
      
      // Count basket trackings
      const { data: basketTrackings, error: basketError } = await supabase
        .from('basket_trackings')
        .select('id, basket_id')
        .eq('user_id', user!.id);
      
      if (basketError) throw basketError;
      
      // Calculate total tracked items (basket trackings only)
      const totalTrackedItems = basketTrackings?.length || 0;
      
      // Calculate potential savings
      let potentialSavings = 0;
      let totalDiscountPercent = 0;
      let discountCount = 0;
      
      // Product tracking disabled - potential savings calculation would come from basket items price differences
      
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
    <div className="space-y-4">
      <WelcomeBanner username={username} />
      
      {/* Best Deals - Full Width */}
      <BestDeals />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        {/* Left Column - Stats */}
        <div className="lg:col-span-1">
          <UserStats />
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
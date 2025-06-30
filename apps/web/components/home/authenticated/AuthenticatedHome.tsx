"use client";

import React from 'react';
import { useAuth } from '~/lib/auth';
import WelcomeBanner from './sections/WelcomeBanner';
import UserStats from './sections/UserStats';
import BestDeals from './sections/BestDeals';
import PopularCategories from './sections/PopularCategories';



export default function AuthenticatedHome() {
  const { user } = useAuth();

  const username = user?.email?.split('@')[0] || 'there';



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
"use client";

import { useAuth } from '~/lib/auth';
import WelcomeBanner from './sections/WelcomeBanner';
import UserStats from './sections/UserStats';
import RecentBaskets from './sections/RecentBaskets';
import PriceAlerts from './sections/PriceAlerts';
import PopularCategories from './sections/PopularCategories';
import QuickActions from './sections/QuickActions';

export default function AuthenticatedHome() {
  const { user } = useAuth();
  const username = user?.email?.split('@')[0] || 'there';

  return (
    <div className="min-h-screen py-6">
      <WelcomeBanner username={username} />

      <div className="container">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-1 flex flex-col">
            <UserStats />
            <RecentBaskets />
          </div>

          {/* Right Column */}
          <div className="lg:col-span-3">
            <PriceAlerts />

            {/* Popular Categories & Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 items-stretch">
              <PopularCategories />
              <QuickActions />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 
"use client";

import { useAuth } from '~/lib/auth';
import WelcomeBanner from './sections/WelcomeBanner';
import UserStats from './sections/UserStats';
import PriceAlerts from './sections/PriceAlerts';
import PopularCategories from './sections/PopularCategories';

export default function AuthenticatedHome() {
  const { user } = useAuth();
  const username = user?.email?.split('@')[0] || 'there';

  return (
    <div className="space-y-0">
      <WelcomeBanner username={username} />
      {/* Price Alerts - Full Width */}
      <PriceAlerts />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Left Column - Stats */}
        <div className="lg:col-span-1">
          <UserStats />
        </div>

        {/* Right Column - Popular Categories */}
        <div className="lg:col-span-2">
          <PopularCategories />
        </div>
      </div>
    </div>
  );
}
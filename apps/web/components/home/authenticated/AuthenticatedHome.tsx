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
    <div className="space-y-6">
      <WelcomeBanner username={username} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Stats */}
        <div className="lg:col-span-1">
          <UserStats />
        </div>

        {/* Right Column - Popular Categories */}
        <div className="lg:col-span-2">
          <PopularCategories />
        </div>
      </div>

      {/* Price Alerts - Full Width */}
      <PriceAlerts />
    </div>
  );
}
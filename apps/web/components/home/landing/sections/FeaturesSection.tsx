"use client";

import Link from 'next/link';
import { FaShoppingBasket, FaRegBell, FaChartLine } from 'react-icons/fa';

export default function FeaturesSection() {
  return (
    <section className="py-16" style={{ background: 'var(--surface)' }}>
      <div className="container">
        <h2
          className="text-4xl font-bold text-center mb-10"
          style={{ color: 'var(--text)' }}
        >
          About TrackBasket
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {/* Price Tracking */}
          <div className="card-enhanced text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-6"
              style={{ background: 'var(--primary)', color: 'var(--dark-text)' }}
            >
              <FaChartLine />
            </div>
            <h3 className="text-2xl font-semibold mb-4" style={{ color: 'var(--text)' }}>
              Price Tracking
            </h3>
            <p className="opacity-80 mb-6" style={{ color: 'var(--text)' }}>
              Monitor price changes across Amazon, Target, and Walmart. Get
              notified when prices drop on items you're watching.
            </p>
            <Link
              href="/search"
              className="btn-base px-6 py-2 text-sm w-full text-center"
              style={{ background: 'var(--primary)', color: 'var(--dark-text)' }}
            >
              Start Tracking
            </Link>
          </div>

          {/* Shopping Baskets */}
          <div className="card-enhanced text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-6"
              style={{ background: 'var(--secondary)', color: 'var(--button-text)' }}
            >
              <FaShoppingBasket />
            </div>
            <h3 className="text-2xl font-semibold mb-4" style={{ color: 'var(--text)' }}>
              Shopping Baskets
            </h3>
            <p className="opacity-80 mb-6" style={{ color: 'var(--text)' }}>
              Create custom shopping baskets to organize products and track
              total costs. Share baskets with family and friends.
            </p>
            <Link
              href="/baskets"
              className="btn-base px-6 py-2 text-sm w-full text-center"
              style={{ background: 'var(--secondary)', color: 'var(--button-text)' }}
            >
              Create Basket
            </Link>
          </div>

          {/* Smart Notifications */}
          <div className="card-enhanced text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-6"
              style={{ background: 'var(--accent)', color: 'var(--button-text)' }}
            >
              <FaRegBell />
            </div>
            <h3 className="text-2xl font-semibold mb-4" style={{ color: 'var(--text)' }}>
              Smart Notifications
            </h3>
            <p className="opacity-80 mb-6" style={{ color: 'var(--text)' }}>
              Customize alerts for price drops, back-in-stock events, and
              product changes. Get notified via email, push, or SMS.
            </p>
            <Link
              href="/settings/notifications"
              className="btn-base px-6 py-2 text-sm w-full text-center"
              style={{ background: 'var(--accent)', color: 'var(--button-text)' }}
            >
              Set Up Alerts
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
} 
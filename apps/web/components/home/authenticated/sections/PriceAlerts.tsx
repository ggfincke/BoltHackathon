"use client";

import Link from 'next/link';
import { FaArrowRight, FaExclamationCircle } from 'react-icons/fa';

interface PriceAlert {
  id: string;
  productName: string;
  retailer: string;
  oldPrice: number;
  newPrice: number;
  percentChange: number;
  imageUrl: string;
}

interface PriceAlertsProps {
  alerts?: PriceAlert[];
}

const DEFAULT_ALERTS: PriceAlert[] = [
  {
    id: '1',
    productName: 'Organic Milk',
    retailer: 'Target',
    oldPrice: 4.99,
    newPrice: 3.49,
    percentChange: -30,
    imageUrl: 'https://images.pexels.com/photos/2510584/pexels-photo-2510584.jpeg?auto=compress&cs=tinysrgb&w=300',
  },
  {
    id: '2',
    productName: 'Cheerios Cereal',
    retailer: 'Walmart',
    oldPrice: 3.99,
    newPrice: 2.99,
    percentChange: -25,
    imageUrl: 'https://images.pexels.com/photos/135525/pexels-photo-135525.jpeg?auto=compress&cs=tinysrgb&w=300',
  },
  {
    id: '3',
    productName: 'Coffee Beans',
    retailer: 'Amazon',
    oldPrice: 12.99,
    newPrice: 15.99,
    percentChange: 23,
    imageUrl: 'https://images.pexels.com/photos/1695052/pexels-photo-1695052.jpeg?auto=compress&cs=tinysrgb&w=300',
  },
  {
    id: '4',
    productName: 'Pasta Sauce',
    retailer: 'Target',
    oldPrice: 3.99,
    newPrice: 2.79,
    percentChange: -30,
    imageUrl: 'https://images.pexels.com/photos/1435904/pexels-photo-1435904.jpeg?auto=compress&cs=tinysrgb&w=300',
  },
  {
    id: '5',
    productName: 'Greek Yogurt',
    retailer: 'Walmart',
    oldPrice: 5.49,
    newPrice: 4.49,
    percentChange: -18,
    imageUrl: 'https://images.pexels.com/photos/1435904/pexels-photo-1435904.jpeg?auto=compress&cs=tinysrgb&w=300',
  },
  {
    id: '6',
    productName: 'Bread Loaf',
    retailer: 'Amazon',
    oldPrice: 2.99,
    newPrice: 3.49,
    percentChange: 17,
    imageUrl: 'https://images.pexels.com/photos/209206/pexels-photo-209206.jpeg?auto=compress&cs=tinysrgb&w=300',
  },
  {
    id: '7',
    productName: 'Chicken Breast',
    retailer: 'Target',
    oldPrice: 8.99,
    newPrice: 6.99,
    percentChange: -22,
    imageUrl: 'https://images.pexels.com/photos/616401/pexels-photo-616401.jpeg?auto=compress&cs=tinysrgb&w=300',
  },
  {
    id: '8',
    productName: 'Olive Oil',
    retailer: 'Walmart',
    oldPrice: 7.99,
    newPrice: 6.49,
    percentChange: -19,
    imageUrl: 'https://images.pexels.com/photos/33783/olive-oil-salad-dressing-cooking-olive.jpg?auto=compress&cs=tinysrgb&w=300',
  },
];

export default function PriceAlerts({ alerts = DEFAULT_ALERTS }: PriceAlertsProps) {
  return (
    <div className="bg-surface rounded-lg shadow-sm p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
          Recent Price Changes
        </h2>
        <Link
          href="/best-deals"
          className="text-sm flex items-center"
          style={{ color: 'var(--primary)' }}
        >
          Show Best Deals <FaArrowRight className="ml-1" />
        </Link>
      </div>

      {alerts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {alerts.slice(0, 8).map((alert) => (
            <div
              key={alert.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden h-32 flex"
            >
              <div className="w-20 flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={alert.imageUrl}
                  alt={alert.productName}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 p-2 min-w-0 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-1">
                    <h3
                      className="font-medium text-xs line-clamp-2 pr-1"
                      style={{ color: 'var(--text)' }}
                    >
                      {alert.productName}
                    </h3>
                    <div
                      className={`text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                        alert.percentChange < 0
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                          : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}
                    >
                      {alert.percentChange < 0 ? '↓' : '↑'}{' '}
                      {Math.abs(alert.percentChange)}%
                    </div>
                  </div>
                  <p className="text-xs opacity-70 mb-1" style={{ color: 'var(--text)' }}>
                    {alert.retailer}
                  </p>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1">
                    <span
                      className="text-xs line-through opacity-70"
                      style={{ color: 'var(--text)' }}
                    >
                      ${alert.oldPrice.toFixed(2)}
                    </span>
                    <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                      ${alert.newPrice.toFixed(2)}
                    </span>
                  </div>
                  <Link
                    href={`/product/${alert.id}`}
                    className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: 'var(--primary)', color: 'var(--dark-text)' }}
                  >
                    View
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
          <FaExclamationCircle
            className="mx-auto text-4xl mb-3 opacity-50"
            style={{ color: 'var(--text)' }}
          />
          <p className="mb-4" style={{ color: 'var(--text)' }}>
            No recent price changes
          </p>
          <Link
            href="/search"
            className="btn-base"
            style={{ background: 'var(--primary)', color: 'var(--dark-text)' }}
          >
            Find Products to Track
          </Link>
        </div>
      )}
    </div>
  );
} 
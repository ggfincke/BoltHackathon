"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FaArrowRight, FaExclamationCircle } from 'react-icons/fa';
import { supabase } from '~/lib/supabaseClient';

interface BestDeal {
  id: string;
  productName: string;
  productSlug: string;
  retailer: string;
  oldPrice: number;
  newPrice: number;
  percentChange: number;
  imageUrl: string;
}

interface BestDealsProps {
  deals?: BestDeal[];
}

export default function BestDeals({ deals: propDeals }: BestDealsProps) {
  const [deals, setDeals] = useState<BestDeal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (propDeals) {
      setDeals(propDeals);
      setLoading(false);
      return;
    }
    
    fetchBestDeals();
  }, [propDeals]);

  const fetchBestDeals = async () => {
    try {
      setLoading(true);
      
      // Find products with significant price differences between retailers
      const { data: priceGapDeals, error: priceGapError } = await supabase
        .rpc('get_price_gap_deals', { min_percent_diff: 15, limit_count: 8 });
      
      if (priceGapError) {
        console.error('Error fetching price gap deals:', priceGapError);
        // Fallback to price history deals if retailer comparison fails
      }
      
      // Find products with price changes over time
      const { data: priceHistoryDeals, error: historyError } = await supabase
        .rpc('get_price_history_deals', { min_percent_change: 10, limit_count: 8 });
      
      if (historyError) {
        console.error('Error fetching price history deals:', historyError);
      }
      
      // Combine and format deals
      let combinedDeals: BestDeal[] = [];
      
      // Process price gap deals (between retailers)
      if (priceGapDeals && priceGapDeals.length > 0) {
        const formattedGapDeals = priceGapDeals.map(deal => ({
          id: deal.product_id,
          productName: deal.product_name,
          productSlug: deal.product_slug,
          retailer: deal.best_retailer_name,
          oldPrice: deal.worst_price,
          newPrice: deal.best_price,
          percentChange: Math.round((deal.worst_price - deal.best_price) / deal.worst_price * 100),
          imageUrl: deal.image_url || 'https://images.pexels.com/photos/1435904/pexels-photo-1435904.jpeg?auto=compress&cs=tinysrgb&w=300'
        }));
        combinedDeals = [...combinedDeals, ...formattedGapDeals];
      }
      
      // Process price history deals (price changes over time)
      if (priceHistoryDeals && priceHistoryDeals.length > 0) {
        const formattedHistoryDeals = priceHistoryDeals.map(deal => ({
          id: deal.product_id,
          productName: deal.product_name,
          productSlug: deal.product_slug,
          retailer: deal.retailer_name,
          oldPrice: deal.old_price,
          newPrice: deal.current_price,
          percentChange: Math.round((deal.old_price - deal.current_price) / deal.old_price * 100),
          imageUrl: deal.image_url || 'https://images.pexels.com/photos/1435904/pexels-photo-1435904.jpeg?auto=compress&cs=tinysrgb&w=300'
        }));
        combinedDeals = [...combinedDeals, ...formattedHistoryDeals];
      }
      
      // If we don't have enough deals, add some fallback deals
      if (combinedDeals.length < 8) {
        const { data: fallbackProducts, error: fallbackError } = await supabase
          .from('products')
          .select(`
            id, 
            name,
            slug,
            listings(
              id,
              price,
              retailer:retailers(name),
              image_url
            )
          `)
          .limit(8 - combinedDeals.length);
        
        if (!fallbackError && fallbackProducts) {
          const fallbackDeals = fallbackProducts
            .filter(product => product.listings && product.listings.length >= 2)
            .map(product => {
              // Sort listings by price
              const sortedListings = [...product.listings].sort((a, b) => 
                (a.price || 999) - (b.price || 999)
              );
              
              const bestListing = sortedListings[0];
              const worstListing = sortedListings[sortedListings.length - 1];
              
              // Only include if there's a price difference
              if (!bestListing?.price || !worstListing?.price || bestListing.price === worstListing.price) {
                return null;
              }
              
              // Calculate percent change
              const percentChange = Math.round((worstListing.price - bestListing.price) / worstListing.price * 100);
              
              // Only include significant differences
              if (percentChange < 5) return null;
              
              return {
                id: product.id,
                productName: product.name,
                productSlug: product.slug,
                retailer: bestListing.retailer.name,
                oldPrice: worstListing.price,
                newPrice: bestListing.price,
                percentChange,
                imageUrl: bestListing.image_url || 'https://images.pexels.com/photos/1435904/pexels-photo-1435904.jpeg?auto=compress&cs=tinysrgb&w=300'
              };
            })
            .filter(Boolean) as BestDeal[];
          
          combinedDeals = [...combinedDeals, ...fallbackDeals];
        }
      }
      
      // If we still don't have deals, use default ones
      if (combinedDeals.length === 0) {
        combinedDeals = DEFAULT_DEALS;
      }
      
      // Sort by percent change (highest savings first)
      combinedDeals.sort((a, b) => Math.abs(b.percentChange) - Math.abs(a.percentChange));
      
      // Take top 8
      setDeals(combinedDeals.slice(0, 8));
    } catch (error) {
      console.error('Error fetching best deals:', error);
      setDeals(DEFAULT_DEALS);
    } finally {
      setLoading(false);
    }
  };

  // Default deals as fallback
  const DEFAULT_DEALS: BestDeal[] = [
    {
      id: '1',
      productName: 'Organic Milk',
      productSlug: 'organic-milk',
      retailer: 'Target',
      oldPrice: 4.99,
      newPrice: 3.49,
      percentChange: -30,
      imageUrl: 'https://images.pexels.com/photos/2510584/pexels-photo-2510584.jpeg?auto=compress&cs=tinysrgb&w=300',
    },
    {
      id: '2',
      productName: 'Cheerios Cereal',
      productSlug: 'cheerios-cereal',
      retailer: 'Walmart',
      oldPrice: 3.99,
      newPrice: 2.99,
      percentChange: -25,
      imageUrl: 'https://images.pexels.com/photos/135525/pexels-photo-135525.jpeg?auto=compress&cs=tinysrgb&w=300',
    },
    {
      id: '3',
      productName: 'Pasta Sauce',
      productSlug: 'pasta-sauce',
      retailer: 'Target',
      oldPrice: 3.99,
      newPrice: 2.79,
      percentChange: -30,
      imageUrl: 'https://images.pexels.com/photos/1435904/pexels-photo-1435904.jpeg?auto=compress&cs=tinysrgb&w=300',
    },
    {
      id: '4',
      productName: 'Greek Yogurt',
      productSlug: 'greek-yogurt',
      retailer: 'Walmart',
      oldPrice: 5.49,
      newPrice: 4.49,
      percentChange: -18,
      imageUrl: 'https://images.pexels.com/photos/1435904/pexels-photo-1435904.jpeg?auto=compress&cs=tinysrgb&w=300',
    },
    {
      id: '5',
      productName: 'Chicken Breast',
      productSlug: 'chicken-breast',
      retailer: 'Target',
      oldPrice: 8.99,
      newPrice: 6.99,
      percentChange: -22,
      imageUrl: 'https://images.pexels.com/photos/616401/pexels-photo-616401.jpeg?auto=compress&cs=tinysrgb&w=300',
    },
    {
      id: '6',
      productName: 'Olive Oil',
      productSlug: 'olive-oil',
      retailer: 'Walmart',
      oldPrice: 7.99,
      newPrice: 6.49,
      percentChange: -19,
      imageUrl: 'https://images.pexels.com/photos/33783/olive-oil-salad-dressing-cooking-olive.jpg?auto=compress&cs=tinysrgb&w=300',
    },
    {
      id: '7',
      productName: 'Frozen Pizza',
      productSlug: 'frozen-pizza',
      retailer: 'Walmart',
      oldPrice: 6.49,
      newPrice: 4.99,
      percentChange: -23,
      imageUrl: 'https://images.pexels.com/photos/825661/pexels-photo-825661.jpeg?auto=compress&cs=tinysrgb&w=300',
    },
    {
      id: '8',
      productName: 'Orange Juice',
      productSlug: 'orange-juice',
      retailer: 'Target',
      oldPrice: 4.19,
      newPrice: 3.29,
      percentChange: -21,
      imageUrl: 'https://images.pexels.com/photos/96974/pexels-photo-96974.jpeg?auto=compress&cs=tinysrgb&w=300',
    },
  ];

  return (
    <div className="bg-surface rounded-lg shadow-sm p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold" style={{ color: 'var(--text)' }}>
          Best Deals
        </h2>
        <Link
          href="/best-deals"
          className="text-sm flex items-center"
          style={{ color: 'var(--primary)' }}
        >
          View All Deals <FaArrowRight className="ml-1" />
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : deals.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {deals.map((deal) => (
            <div
              key={deal.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden h-32 flex"
            >
              <div className="w-20 flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={deal.imageUrl}
                  alt={deal.productName}
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
                      {deal.productName}
                    </h3>
                    <div
                      className={`text-xs font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                        deal.percentChange < 0
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                      }`}
                    >
                      {deal.percentChange < 0 ? '↓' : '↑'}{' '}
                      {Math.abs(deal.percentChange)}%
                    </div>
                  </div>
                  <p className="text-xs opacity-70 mb-1" style={{ color: 'var(--text)' }}>
                    {deal.retailer}
                  </p>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1">
                    <span
                      className="text-xs line-through opacity-70"
                      style={{ color: 'var(--text)' }}
                    >
                      ${deal.oldPrice.toFixed(2)}
                    </span>
                    <span className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                      ${deal.newPrice.toFixed(2)}
                    </span>
                  </div>
                  <Link
                    href={`/product/${deal.productSlug}`}
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
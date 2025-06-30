"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FaArrowRight, FaExclamationCircle } from 'react-icons/fa';
import { supabase } from '~/lib/supabaseClient';
import { BestDeal, MOCK_DEALS } from './mockDeals';

interface BestDealsProps {
  deals?: BestDeal[];
}

export default function BestDeals({ deals: propDeals }: BestDealsProps) {
  const [deals, setDeals] = useState<BestDeal[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Configuration constants
  const MAX_REALISTIC_PERCENT_DIFF = 75;
  const MIN_PRICE_GAP_PERCENT = 15;
  const MIN_PRICE_HISTORY_PERCENT = 10;
  const DEALS_LIMIT = 8;
  const MIN_LISTINGS_REQUIRED = 2;
  const MIN_THRESHOLD_WITH_DEALS = 5; // Reduced to catch smaller but meaningful deals
  const MIN_THRESHOLD_NO_DEALS = 3; // Reduced to catch smaller but meaningful deals
  const FALLBACK_IMAGE_URL = 'https://images.pexels.com/photos/1435904/pexels-photo-1435904.jpeg?auto=compress&cs=tinysrgb&w=300';

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
      
      // console.log('🔍 Starting fetchBestDeals...');
      
      // Holder for product IDs the user is explicitly interested in
      let trackedProductIdSet: Set<string> = new Set();
      
      // Initialize variables for deals
      let priceGapDeals = null;
      let priceHistoryDeals = null;
      
      // Try to fetch price gap deals with error handling
      try {
        const { data, error } = await supabase
          .rpc('get_price_gap_deals', { min_percent_diff: MIN_PRICE_GAP_PERCENT, limit_count: DEALS_LIMIT });
        
        if (error) {
          console.error('Price gap deals function error:', error);
        } else if (data && data.length > 0) {
          // console.log('✅ Price gap deals found:', data.length);
          priceGapDeals = data;
        } else {
          // console.log('❌ No price gap deals found');
        }
      } catch (err) {
        console.error('Price gap deals function call failed:', err);
      }
      
      // Try to fetch price history deals with error handling
      try {
        const { data, error } = await supabase
          .rpc('get_price_history_deals', { min_percent_change: MIN_PRICE_HISTORY_PERCENT, limit_count: DEALS_LIMIT });
        
        if (error) {
          console.error('Price history deals function error:', error);
        } else if (data && data.length > 0) {
          // console.log('✅ Price history deals found:', data.length);
          priceHistoryDeals = data;
        } else {
          // console.log('❌ No price history deals found');
        }
      } catch (err) {
        console.error('Price history deals function call failed:', err);
      }
      
      // Combine and format deals
      let combinedDeals: BestDeal[] = [];
      
      // Process price gap deals (between retailers)
      if (priceGapDeals && priceGapDeals.length > 0) {
        const formattedGapDeals = priceGapDeals
          .map(deal => ({
            id: deal.product_id,
            productName: deal.product_name,
            productSlug: deal.product_slug,
            retailer: deal.best_retailer_name,
            oldPrice: deal.worst_price,
            newPrice: deal.best_price,
            percentChange: Math.round((deal.worst_price - deal.best_price) / deal.worst_price * 100),
            imageUrl: deal.image_url || FALLBACK_IMAGE_URL
          }))
          .filter(deal => {
            // Filter out unrealistic percentage differences
            return deal.percentChange <= MAX_REALISTIC_PERCENT_DIFF;
          });
        // console.log(`🔄 Price gap deals after filtering: ${formattedGapDeals.length}`);
        combinedDeals = [...combinedDeals, ...formattedGapDeals];
      }
      
      // Process price history deals (price changes over time)
      if (priceHistoryDeals && priceHistoryDeals.length > 0) {
        const formattedHistoryDeals = priceHistoryDeals
          .map(deal => ({
            id: deal.product_id,
            productName: deal.product_name,
            productSlug: deal.product_slug,
            retailer: deal.retailer_name,
            oldPrice: deal.old_price,
            newPrice: deal.current_price,
            percentChange: Math.round((deal.old_price - deal.current_price) / deal.old_price * 100),
            imageUrl: deal.image_url || FALLBACK_IMAGE_URL
          }))
          .filter(deal => {
            // Filter out unrealistic percentage differences
            return deal.percentChange <= MAX_REALISTIC_PERCENT_DIFF;
          });
        // console.log(`🔄 Price history deals after filtering: ${formattedHistoryDeals.length}`);
        combinedDeals = [...combinedDeals, ...formattedHistoryDeals];
      }
      
      /* ------------------------------------------------------------------
       * 👤 User-specific deals (tracked products & basket items)
       * ------------------------------------------------------------------*/
      try {
        // Fetch product IDs the user is tracking
        const { data: trackedRows, error: trackedErr } = await supabase
          .from('product_trackings')
          .select('product_id');
        if (trackedErr) {
          console.error('Error fetching product trackings:', trackedErr);
        }

        // Fetch product IDs from the user's basket items (policies ensure user-specific data)
        const { data: basketRows, error: basketErr } = await supabase
          .from('basket_items')
          .select('product_id');
        if (basketErr) {
          console.error('Error fetching basket items:', basketErr);
        }

        // Merge and deduplicate IDs
        const trackedIds = [
          ...(trackedRows?.map((r: { product_id: string }) => r.product_id) ?? []),
          ...(basketRows?.map((r: { product_id: string }) => r.product_id) ?? []),
        ];
        trackedProductIdSet = new Set(trackedIds);

        // console.log(`👀 User-interested product IDs: ${trackedProductIdSet.size}`);

        if (trackedProductIdSet.size > 0) {
          // Fetch those products with their listings
          const { data: trackedProducts, error: trackedProductsErr } = await supabase
            .from('products')
            .select(`
              id,
              name,
              slug,
              listings!inner(
                id,
                price,
                retailer:retailers!inner(name),
                image_url,
                in_stock
              )
            `)
            .in('id', Array.from(trackedProductIdSet));

          // console.log(`📥 Tracked/basket products fetched: ${trackedProducts?.length || 0}`);

          if (!trackedProductsErr && trackedProducts) {
            const trackedDeals = trackedProducts
              .filter((product) => product.listings && product.listings.length >= MIN_LISTINGS_REQUIRED)
              .map((product) => {
                // Filter valid listings (price & retailer name present)
                const validListings = product.listings.filter((listing) =>
                  listing.price && listing.price > 0 && listing.retailer?.name
                );

                if (validListings.length < MIN_LISTINGS_REQUIRED) return null;

                // Sort listings by price ascending
                const sorted = [...validListings].sort((a, b) => (a.price || 999) - (b.price || 999));
                const best = sorted[0];
                const worst = sorted[sorted.length - 1];

                if (!best?.price || !worst?.price) return null;

                const pct = Math.round((worst.price - best.price) / worst.price * 100);

                // Respect same thresholds
                if (pct > MAX_REALISTIC_PERCENT_DIFF || pct < MIN_THRESHOLD_WITH_DEALS) return null;

                return {
                  id: product.id,
                  productName: product.name,
                  productSlug: product.slug,
                  retailer: best.retailer.name,
                  oldPrice: worst.price,
                  newPrice: best.price,
                  percentChange: pct,
                  imageUrl: best.image_url || FALLBACK_IMAGE_URL,
                } as BestDeal;
              })
              .filter(Boolean) as BestDeal[];

            // console.log(`🎯 Tracked/basket deals found: ${trackedDeals.length}`);

            combinedDeals = [...combinedDeals, ...trackedDeals];
          } else if (trackedProductsErr) {
            console.error('Error fetching tracked product details:', trackedProductsErr);
          }
        }
      } catch (err) {
        console.error('Error processing user-specific deals:', err);
      }
      
      // If we don't have enough deals, try to find more from regular product listings
      const needsMoreDeals = combinedDeals.length < DEALS_LIMIT;
      const hasNoDeals = combinedDeals.length === 0;
      
      // console.log(`💡 Combined deals so far: ${combinedDeals.length}, needs more: ${needsMoreDeals}, has no deals: ${hasNoDeals}`);
      
      if (needsMoreDeals) {
        // console.log('🔍 Fetching fallback products...');
        const { data: fallbackProducts, error: fallbackError } = await supabase
          .from('products')
          .select(`
            id, 
            name,
            slug,
            listings!inner(
              id,
              price,
              retailer:retailers!inner(name),
              image_url,
              in_stock
            )
          `);
        
        // console.log(`📦 Fallback products fetched: ${fallbackProducts?.length || 0}, error: ${fallbackError ? 'YES' : 'NO'}`);
        
        if (!fallbackError && fallbackProducts) {
          const productsWithMultipleListings = fallbackProducts
            .filter(product => product.listings && product.listings.length >= MIN_LISTINGS_REQUIRED);
          
          // console.log(`🔢 Products with >= ${MIN_LISTINGS_REQUIRED} listings: ${productsWithMultipleListings.length}`);
          
          const fallbackDeals = productsWithMultipleListings
            .map(product => {
              // Sort listings by price (ascending) and filter for valid items
              // Very permissive filtering - just need price and retailer
              const validListings = product.listings.filter(listing => 
                listing.price && 
                listing.price > 0 && 
                listing.retailer?.name
                // Stock status is not relevant for price comparison deals
              );
              
              // console.log(`📋 Product "${product.name}" - Total listings: ${product.listings.length}, Valid listings: ${validListings.length}`);
              
              if (validListings.length < MIN_LISTINGS_REQUIRED) return null;
              
              const sortedListings = [...validListings].sort((a, b) => 
                (a.price || 999) - (b.price || 999)
              );
              
              const bestListing = sortedListings[0];
              const worstListing = sortedListings[sortedListings.length - 1];
              
              // Additional null checks for TypeScript
              if (!bestListing?.price || !worstListing?.price) return null;
              
              // Calculate percent change
              const percentChange = Math.round((worstListing.price - bestListing.price) / worstListing.price * 100);
              
              // console.log(`💰 "${product.name}" - Best: $${bestListing.price} (${bestListing.retailer.name}), Worst: $${worstListing.price} (${worstListing.retailer.name}), Savings: ${percentChange}%`);
              
              // Filter out unrealistic percentage differences
              if (percentChange > MAX_REALISTIC_PERCENT_DIFF) {
                // console.log(`❌ Filtered out "${product.name}" - percentage too high: ${percentChange}%`);
                return null;
              }
              
              // Use lower threshold when functions fail to ensure we show real data
              const minThreshold = hasNoDeals ? MIN_THRESHOLD_NO_DEALS : MIN_THRESHOLD_WITH_DEALS;
              if (percentChange < minThreshold) {
                // console.log(`❌ Filtered out "${product.name}" - percentage too low: ${percentChange}% (min: ${minThreshold}%)`);
                return null;
              }
              
              // console.log(`✅ "${product.name}" qualifies as a deal!`);
              
              return {
                id: product.id,
                productName: product.name,
                productSlug: product.slug,
                retailer: bestListing.retailer.name,
                oldPrice: worstListing.price,
                newPrice: bestListing.price,
                percentChange,
                imageUrl: bestListing.image_url || FALLBACK_IMAGE_URL
              };
            })
            .filter(Boolean) as BestDeal[];
          
          // console.log(`🎯 Fallback deals found: ${fallbackDeals.length}`);
          
          if (fallbackDeals.length > 0) {
            combinedDeals = [...combinedDeals, ...fallbackDeals];
            // console.log(`📈 Total combined deals after fallback: ${combinedDeals.length}`);
          }
        } else if (fallbackError) {
          console.error('Error fetching fallback products:', fallbackError);
        }
      }
      
      // Final check - only use mock data if absolutely no real data is available
      if (combinedDeals.length === 0) {
        // console.log('⚠️ No real deals found, using mock data');
        combinedDeals = MOCK_DEALS;
      }
      
      // Remove duplicates based on product ID
      const uniqueDeals = combinedDeals.filter((deal, index, self) => 
        index === self.findIndex(d => d.id === deal.id)
      );
      
      // console.log(`🔄 After deduplication: ${uniqueDeals.length} deals`);
      
      // Sort so that user-interested (tracked/basket) deals appear first, then by savings percent
      uniqueDeals.sort((a, b) => {
        const aTracked = trackedProductIdSet.has(a.id);
        const bTracked = trackedProductIdSet.has(b.id);
        if (aTracked && !bTracked) return -1;
        if (bTracked && !aTracked) return 1;
        return Math.abs(b.percentChange) - Math.abs(a.percentChange);
      });
      
      // Take top deals
      const finalDeals = uniqueDeals.slice(0, DEALS_LIMIT);
      
      // console.log(`🏆 Final deals to display: ${finalDeals.length}`);
      // console.log('📊 Final deals:', finalDeals.map(d => `${d.productName} - ${d.percentChange}%`));
      
      setDeals(finalDeals);
    } catch (error) {
      console.error('Critical error in fetchBestDeals:', error);
      setDeals(MOCK_DEALS);
    } finally {
      setLoading(false);
    }
  };



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
                        deal.percentChange > 0
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                      }`}
                    >
                      {deal.percentChange > 0 ? '↓' : '↑'}{' '}
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
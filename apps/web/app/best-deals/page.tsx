'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { FaArrowDown, FaArrowUp, FaFilter } from 'react-icons/fa';
import { supabase } from '~/lib/supabaseClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Deal {
  id: string;
  name: string;
  category: string;
  bestPrice: number;
  bestRetailer: string;
  worstPrice: number;
  worstRetailer: string;
  savings: number; // percentage
  imageUrl: string;
}

type SortBy = 'savings' | 'price' | 'name';

interface Filters {
  minSavings: number;
  retailer: string;
  category: string;
  sortBy: SortBy;
}

// Mock data as fallback
const MOCK_DEALS: Deal[] = [
  {
    id: '1',
    name: 'Organic Milk',
    category: 'Dairy',
    bestPrice: 3.49,
    bestRetailer: 'Target',
    worstPrice: 4.99,
    worstRetailer: 'Amazon',
    savings: 30,
    imageUrl: 'https://images.pexels.com/photos/2510584/pexels-photo-2510584.jpeg?auto=compress&cs=tinysrgb&w=300'
  },
  {
    id: '2',
    name: 'Cheerios Cereal',
    category: 'Breakfast & Cereal',
    bestPrice: 2.99,
    bestRetailer: 'Walmart',
    worstPrice: 3.99,
    worstRetailer: 'Target',
    savings: 25,
    imageUrl: 'https://images.pexels.com/photos/135525/pexels-photo-135525.jpeg?auto=compress&cs=tinysrgb&w=300'
  },
  {
    id: '3',
    name: 'Pasta Sauce',
    category: 'Pantry Staples',
    bestPrice: 2.79,
    bestRetailer: 'Target',
    worstPrice: 3.99,
    worstRetailer: 'Amazon',
    savings: 30,
    imageUrl: 'https://images.pexels.com/photos/1435904/pexels-photo-1435904.jpeg?auto=compress&cs=tinysrgb&w=300'
  },
  {
    id: '4',
    name: 'Greek Yogurt',
    category: 'Dairy',
    bestPrice: 4.49,
    bestRetailer: 'Walmart',
    worstPrice: 5.49,
    worstRetailer: 'Amazon',
    savings: 18,
    imageUrl: 'https://images.pexels.com/photos/1435904/pexels-photo-1435904.jpeg?auto=compress&cs=tinysrgb&w=300'
  },
  {
    id: '5',
    name: 'Chicken Breast',
    category: 'Meat & Seafood',
    bestPrice: 6.99,
    bestRetailer: 'Target',
    worstPrice: 8.99,
    worstRetailer: 'Amazon',
    savings: 22,
    imageUrl: 'https://images.pexels.com/photos/616401/pexels-photo-616401.jpeg?auto=compress&cs=tinysrgb&w=300'
  },
  {
    id: '6',
    name: 'Olive Oil',
    category: 'Pantry Staples',
    bestPrice: 6.49,
    bestRetailer: 'Walmart',
    worstPrice: 7.99,
    worstRetailer: 'Target',
    savings: 19,
    imageUrl: 'https://images.pexels.com/photos/33783/olive-oil-salad-dressing-cooking-olive.jpg?auto=compress&cs=tinysrgb&w=300'
  },
  {
    id: '7',
    name: 'Frozen Pizza',
    category: 'Frozen Foods',
    bestPrice: 4.99,
    bestRetailer: 'Walmart',
    worstPrice: 6.49,
    worstRetailer: 'Amazon',
    savings: 23,
    imageUrl: 'https://images.pexels.com/photos/825661/pexels-photo-825661.jpeg?auto=compress&cs=tinysrgb&w=300'
  },
  {
    id: '8',
    name: 'Orange Juice',
    category: 'Beverages',
    bestPrice: 3.29,
    bestRetailer: 'Target',
    worstPrice: 4.19,
    worstRetailer: 'Amazon',
    savings: 21,
    imageUrl: 'https://images.pexels.com/photos/96974/pexels-photo-96974.jpeg?auto=compress&cs=tinysrgb&w=300'
  },
  {
    id: '9',
    name: 'Potato Chips',
    category: 'Snacks',
    bestPrice: 2.50,
    bestRetailer: 'Walmart',
    worstPrice: 3.29,
    worstRetailer: 'Target',
    savings: 24,
    imageUrl: 'https://images.pexels.com/photos/568805/pexels-photo-568805.jpeg?auto=compress&cs=tinysrgb&w=300'
  },
  {
    id: '10',
    name: 'Ground Coffee',
    category: 'Beverages',
    bestPrice: 7.99,
    bestRetailer: 'Target',
    worstPrice: 9.99,
    worstRetailer: 'Amazon',
    savings: 20,
    imageUrl: 'https://images.pexels.com/photos/1695052/pexels-photo-1695052.jpeg?auto=compress&cs=tinysrgb&w=300'
  },
  {
    id: '11',
    name: 'Bananas',
    category: 'Produce',
    bestPrice: 0.49,
    bestRetailer: 'Walmart',
    worstPrice: 0.59,
    worstRetailer: 'Target',
    savings: 17,
    imageUrl: 'https://images.pexels.com/photos/1093038/pexels-photo-1093038.jpeg?auto=compress&cs=tinysrgb&w=300'
  },
  {
    id: '12',
    name: 'Bread Loaf',
    category: 'Bakery & Bread',
    bestPrice: 2.29,
    bestRetailer: 'Walmart',
    worstPrice: 2.99,
    worstRetailer: 'Amazon',
    savings: 23,
    imageUrl: 'https://images.pexels.com/photos/209206/pexels-photo-209206.jpeg?auto=compress&cs=tinysrgb&w=300'
  }
];

export default function BestDealsPage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [filterOpen, setFilterOpen] = useState<boolean>(false);
  const [filters, setFilters] = useState<Filters>({
    minSavings: 10, // minimum percentage savings
    retailer: 'all',
    category: 'all',
    sortBy: 'savings'
  });

  useEffect(() => {
    fetchBestDeals();
  }, []);

  const fetchBestDeals = async () => {
    try {
      setLoading(true);
      
      // Initialize variables for deals
      let priceGapDeals = null;
      let priceHistoryDeals = null;
      
      // Try to fetch price gap deals with error handling
      try {
        const { data, error } = await supabase
          .rpc('get_price_gap_deals', { min_percent_diff: 15, limit_count: 20 });
        
        if (error) {
          console.error('Price gap deals function error:', error);
        } else if (data && data.length > 0) {
          priceGapDeals = data;
        }
      } catch (err) {
        console.error('Price gap deals function call failed:', err);
      }
      
      // Try to fetch price history deals with error handling
      try {
        const { data, error } = await supabase
          .rpc('get_price_history_deals', { min_percent_change: 10, limit_count: 20 });
        
        if (error) {
          console.error('Price history deals function error:', error);
        } else if (data && data.length > 0) {
          priceHistoryDeals = data;
        }
      } catch (err) {
        console.error('Price history deals function call failed:', err);
      }
      
      // Combine and format deals
      let combinedDeals: Deal[] = [];
      
      // Process price gap deals (between retailers)
      if (priceGapDeals && priceGapDeals.length > 0) {
        const formattedGapDeals = priceGapDeals
          .map(deal => ({
            id: deal.product_id,
            name: deal.product_name,
            category: 'General', // Default category since not provided by RPC
            bestPrice: deal.best_price,
            bestRetailer: deal.best_retailer_name,
            worstPrice: deal.worst_price,
            worstRetailer: deal.worst_retailer_name || 'Other Store',
            savings: Math.round((deal.worst_price - deal.best_price) / deal.worst_price * 100),
            imageUrl: deal.image_url || 'https://images.pexels.com/photos/1435904/pexels-photo-1435904.jpeg?auto=compress&cs=tinysrgb&w=300'
          }))
          .filter(deal => {
            // Filter out unrealistic percentage differences (>100% is unrealistic for most products)
            return deal.savings <= 100 && deal.savings > 0;
          });
        combinedDeals = [...combinedDeals, ...formattedGapDeals];
      }
      
      // Process price history deals (price changes over time)
      if (priceHistoryDeals && priceHistoryDeals.length > 0) {
        const formattedHistoryDeals = priceHistoryDeals
          .map(deal => ({
            id: deal.product_id,
            name: deal.product_name,
            category: 'General', // Default category since not provided by RPC
            bestPrice: deal.current_price,
            bestRetailer: deal.retailer_name,
            worstPrice: deal.old_price,
            worstRetailer: deal.retailer_name + ' (Previous)',
            savings: Math.round((deal.old_price - deal.current_price) / deal.old_price * 100),
            imageUrl: deal.image_url || 'https://images.pexels.com/photos/1435904/pexels-photo-1435904.jpeg?auto=compress&cs=tinysrgb&w=300'
          }))
          .filter(deal => {
            // Filter out unrealistic percentage differences (>100% is unrealistic for most products)
            return deal.savings <= 100 && deal.savings > 0;
          });
        combinedDeals = [...combinedDeals, ...formattedHistoryDeals];
      }
      
      // If we don't have enough deals, try to find more from regular product listings
      const needsMoreDeals = combinedDeals.length < 20;
      const hasNoDeals = combinedDeals.length === 0;
      
      if (needsMoreDeals) {
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
          `)
          .limit(hasNoDeals ? 100 : 50); // Get more products when functions fail
        
        if (!fallbackError && fallbackProducts) {
          const fallbackDeals = fallbackProducts
            .filter(product => product.listings && product.listings.length >= 2)
            .map(product => {
              // Sort listings by price (ascending) and filter for valid, in-stock items
              const validListings = product.listings.filter(listing => 
                listing.price && 
                listing.price > 0 && 
                listing.in_stock !== false &&
                listing.retailer?.name
              );
              if (validListings.length < 2) return null;
              
              const sortedListings = [...validListings].sort((a, b) => 
                (a.price || 999) - (b.price || 999)
              );
              
              const bestListing = sortedListings[0];
              const worstListing = sortedListings[sortedListings.length - 1];
              
              // Additional null checks for TypeScript
              if (!bestListing?.price || !worstListing?.price) return null;
              
              // Calculate percent change
              const savings = Math.round((worstListing.price - bestListing.price) / worstListing.price * 100);
              
              // Filter out unrealistic percentage differences (>100% is unrealistic)
              if (savings > 100) return null;
              
              // Use lower threshold when functions fail to ensure we show real data
              const minThreshold = hasNoDeals ? 5 : 10;
              if (savings < minThreshold) return null;
              
              return {
                id: product.id,
                name: product.name,
                category: 'General', // Default category
                bestPrice: bestListing.price,
                bestRetailer: bestListing.retailer.name,
                worstPrice: worstListing.price,
                worstRetailer: worstListing.retailer.name,
                savings,
                imageUrl: bestListing.image_url || 'https://images.pexels.com/photos/1435904/pexels-photo-1435904.jpeg?auto=compress&cs=tinysrgb&w=300'
              };
            })
            .filter(Boolean) as Deal[];
          
          if (fallbackDeals.length > 0) {
            combinedDeals = [...combinedDeals, ...fallbackDeals];
          }
        } else if (fallbackError) {
          console.error('Error fetching fallback products:', fallbackError);
        }
      }
      
      // Final check - only use mock data if absolutely no real data is available
      if (combinedDeals.length === 0) {
        combinedDeals = MOCK_DEALS;
      }
      
      // Remove duplicates based on product ID
      const uniqueDeals = combinedDeals.filter((deal, index, self) => 
        index === self.findIndex(d => d.id === deal.id)
      );
      
      // Sort by savings (highest savings first)
      uniqueDeals.sort((a, b) => Math.abs(b.savings) - Math.abs(a.savings));
      
      setDeals(uniqueDeals);
    } catch (error) {
      console.error('Critical error in fetchBestDeals:', error);
      setDeals(MOCK_DEALS);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Apply filters to deals
  const filteredDeals = deals.filter(deal => {
    if (deal.savings < filters.minSavings) return false;
    
    if (filters.retailer !== 'all') {
      const retailerMatch = deal.bestRetailer.toLowerCase().includes(filters.retailer.toLowerCase()) ||
                           deal.worstRetailer.toLowerCase().includes(filters.retailer.toLowerCase());
      if (!retailerMatch) return false;
    }
    
    if (filters.category !== 'all') {
      if (deal.category.toLowerCase() !== filters.category.toLowerCase()) return false;
    }
    
    return true;
  });

  // Apply sorting
  const sortedDeals = [...filteredDeals].sort((a, b) => {
    if (filters.sortBy === 'savings') {
      return b.savings - a.savings;
    } else if (filters.sortBy === 'price') {
      return a.bestPrice - b.bestPrice;
    } else if (filters.sortBy === 'name') {
      return a.name.localeCompare(b.name);
    }
    return 0;
  });

  const categories = [
    'all', 'Beverages', 'Breakfast & Cereal', 'Dairy', 'Frozen Foods', 
    'Meat & Seafood', 'Pantry Staples', 'Produce', 'Snacks', 'Bakery & Bread', 'General'
  ];

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Best Deals</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Find the biggest savings across retailers
          </p>
        </div>
        <button 
          onClick={() => setFilterOpen(!filterOpen)}
          className="mt-4 md:mt-0 flex items-center gap-2 px-4 py-2 bg-surface rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <FaFilter /> 
          <span>Filter</span>
        </button>
      </div>
      
      {/* Filters */}
      {filterOpen && (
        <div className="bg-surface p-4 rounded-lg mb-6 border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Minimum Savings</label>
              <select 
                value={filters.minSavings}
                onChange={(e) => handleFilterChange('minSavings', parseInt(e.target.value))}
                className="w-full p-2 rounded-md bg-background border border-gray-300 dark:border-gray-700"
              >
                <option value={5}>5% or more</option>
                <option value={10}>10% or more</option>
                <option value={15}>15% or more</option>
                <option value={20}>20% or more</option>
                <option value={25}>25% or more</option>
                <option value={30}>30% or more</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Retailer</label>
              <select 
                value={filters.retailer}
                onChange={(e) => handleFilterChange('retailer', e.target.value)}
                className="w-full p-2 rounded-md bg-background border border-gray-300 dark:border-gray-700"
              >
                <option value="all">All Retailers</option>
                <option value="amazon">Amazon</option>
                <option value="target">Target</option>
                <option value="walmart">Walmart</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Category</label>
              <select 
                value={filters.category}
                onChange={(e) => handleFilterChange('category', e.target.value)}
                className="w-full p-2 rounded-md bg-background border border-gray-300 dark:border-gray-700"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Sort By</label>
              <select 
                value={filters.sortBy}
                onChange={(e) => handleFilterChange('sortBy', e.target.value as SortBy)}
                className="w-full p-2 rounded-md bg-background border border-gray-300 dark:border-gray-700"
              >
                <option value="savings">Biggest Savings</option>
                <option value="price">Lowest Price</option>
                <option value="name">Product Name</option>
              </select>
            </div>
          </div>
        </div>
      )}
      
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : sortedDeals.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {sortedDeals.map(deal => (
            <div key={deal.id} className="bg-surface rounded-lg overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="h-40 overflow-hidden">
                <img 
                  src={deal.imageUrl} 
                  alt={deal.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium line-clamp-2">{deal.name}</h3>
                  <div className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-1 rounded-full text-xs font-bold">
                    {deal.savings}% OFF
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{deal.category}</p>
                
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center">
                    <FaArrowDown className="text-green-500 mr-1" />
                    <span className="text-sm font-bold">${deal.bestPrice.toFixed(2)}</span>
                  </div>
                  <span className="text-xs">{deal.bestRetailer}</span>
                </div>
                
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center">
                    <FaArrowUp className="text-red-500 mr-1" />
                    <span className="text-sm line-through opacity-70">${deal.worstPrice.toFixed(2)}</span>
                  </div>
                  <span className="text-xs">{deal.worstRetailer}</span>
                </div>
                
                <Link 
                  href={`/product/${deal.id}`}
                  className="block w-full text-center py-2 rounded-md text-buttonText"
                  style={{background: 'var(--primary)'}}
                >
                  View Deal
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-surface p-8 rounded-lg shadow-sm text-center">
          <h2 className="text-xl font-semibold mb-2">No deals found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Try adjusting your filters or check back later for new deals.
          </p>
          <button 
            onClick={() => setFilters({
              minSavings: 10,
              retailer: 'all',
              category: 'all',
              sortBy: 'savings'
            })}
            className="bg-primary text-buttonText px-4 py-2 rounded-md hover:bg-opacity-90 transition-colors"
          >
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );
}
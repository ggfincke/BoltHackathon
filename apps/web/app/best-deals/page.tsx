'use client';

import { useState, useEffect } from 'react';
import { FaFilter } from 'react-icons/fa';
import { fetchBestDeals } from '~/lib/bestDealsFetcher';
import { MOCK_DEALS } from './mockDeals';
import DealGrid from '~/components/product/DealGrid';
import type { Deal } from '~/components/product/DealCard';

type SortBy = 'savings' | 'price' | 'name';

interface Filters {
  minSavings: number;
  retailer: string;
  category: string;
  sortBy: SortBy;
}

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
    fetchDeals();
  }, []);

  const fetchDeals = async () => {
    try {
      setLoading(true);
      const bestDeals = await fetchBestDeals({ resultLimit: 100 });
      const withCategory = bestDeals.map((d) => ({ ...d, category: 'General' })) as Deal[];
      setDeals(withCategory);
    } catch (e) {
      console.error('Failed to fetch deals:', e);
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
      ) : (
        <DealGrid 
          deals={sortedDeals}
          emptyMessage="No deals found. Try adjusting your filters or check back later for new deals."
        />
      )}
    </div>
  );
}
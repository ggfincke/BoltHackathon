'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '~/lib/supabaseClient';
import { FaArrowDown, FaArrowUp, FaFilter } from 'react-icons/fa';

export default function BestDealsPage() {
  const [loading, setLoading] = useState(true);
  const [deals, setDeals] = useState([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    minSavings: 10, // minimum percentage savings
    retailer: 'all',
    category: 'all',
    sortBy: 'savings' // savings, price, name
  });

  useEffect(() => {
    fetchBestDeals();
  }, [filters]);

  const fetchBestDeals = async () => {
    setLoading(true);
    try {
      // In a real implementation, this would query the database for products with the biggest
      // price differences between retailers or biggest discounts
      // For now, we'll use mock data
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Mock data for best deals
      const mockDeals = [
        {
          id: '1',
          name: 'Organic Milk',
          category: 'Dairy',
          bestPrice: 3.49,
          bestRetailer: 'Target',
          worstPrice: 4.99,
          worstRetailer: 'Amazon',
          savings: 30, // percentage
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
      
      // Apply filters
      let filteredDeals = mockDeals.filter(deal => deal.savings >= filters.minSavings);
      
      if (filters.retailer !== 'all') {
        filteredDeals = filteredDeals.filter(deal => 
          deal.bestRetailer.toLowerCase() === filters.retailer.toLowerCase() ||
          deal.worstRetailer.toLowerCase() === filters.retailer.toLowerCase()
        );
      }
      
      if (filters.category !== 'all') {
        filteredDeals = filteredDeals.filter(deal => 
          deal.category.toLowerCase() === filters.category.toLowerCase()
        );
      }
      
      // Apply sorting
      if (filters.sortBy === 'savings') {
        filteredDeals.sort((a, b) => b.savings - a.savings);
      } else if (filters.sortBy === 'price') {
        filteredDeals.sort((a, b) => a.bestPrice - b.bestPrice);
      } else if (filters.sortBy === 'name') {
        filteredDeals.sort((a, b) => a.name.localeCompare(b.name));
      }
      
      setDeals(filteredDeals);
    } catch (error) {
      console.error('Error fetching best deals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const categories = [
    'all', 'Beverages', 'Breakfast & Cereal', 'Dairy', 'Frozen Foods', 
    'Meat & Seafood', 'Pantry Staples', 'Produce', 'Snacks', 'Bakery & Bread'
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
                onChange={(e) => handleFilterChange('sortBy', e.target.value)}
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
      ) : deals.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {deals.map(deal => (
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
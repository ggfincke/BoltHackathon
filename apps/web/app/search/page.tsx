'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '~/lib/supabaseClient';
import Link from 'next/link';

type Product = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  brand_id?: string;
  brand?: {
    name: string;
  };
  listings?: {
    id: string;
    price: number;
    currency: string;
    in_stock: boolean;
    url: string;
    image_url?: string;
    retailer: {
      name: string;
    };
  }[];
};

type SortOption = 'price_asc' | 'price_desc' | 'name_asc' | 'name_desc';

export default function Search() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('price_asc');
  
  useEffect(() => {
    if (!query) return;
    
    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('products')
          .select(`
            id, 
            name, 
            slug, 
            description,
            brand_id,
            brand:brands(name),
            listings(
              id, 
              price, 
              currency, 
              in_stock, 
              url, 
              image_url,
              retailer:retailers(name)
            )
          `)
          .ilike('name', `%${query}%`)
          .limit(50);
        
        if (error) throw error;
        setProducts(data || []);
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProducts();
  }, [query]);
  
  // Sort products based on selected option
  const sortedProducts = [...products].sort((a, b) => {
    // Get the lowest price listing for each product
    const aPrice = a.listings?.reduce((min, listing) => 
      listing.price < min ? listing.price : min, 
      a.listings?.[0]?.price || Infinity
    );
    
    const bPrice = b.listings?.reduce((min, listing) => 
      listing.price < min ? listing.price : min, 
      b.listings?.[0]?.price || Infinity
    );
    
    switch (sortOption) {
      case 'price_asc':
        return (aPrice || Infinity) - (bPrice || Infinity);
      case 'price_desc':
        return (bPrice || 0) - (aPrice || 0);
      case 'name_asc':
        return a.name.localeCompare(b.name);
      case 'name_desc':
        return b.name.localeCompare(a.name);
      default:
        return 0;
    }
  });
  
  // Get best listing for a product (lowest price in stock)
  const getBestListing = (product: Product) => {
    if (!product.listings?.length) return null;
    
    // First try to find in-stock listings
    const inStockListings = product.listings.filter(l => l.in_stock);
    
    // If there are in-stock listings, return the lowest price one
    if (inStockListings.length > 0) {
      return inStockListings.reduce((best, current) => 
        current.price < best.price ? current : best, 
        inStockListings[0]
      );
    }
    
    // Otherwise return the lowest price listing regardless of stock
    return product.listings.reduce((best, current) => 
      current.price < best.price ? current : best, 
      product.listings[0]
    );
  };
  
  return (
    <div className="container mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">
          {query ? `Search results for "${query}"` : 'Search'}
        </h1>
        
        {/* Search bar */}
        <div className="bg-surface p-4 rounded-lg shadow-sm mb-4">
          <form 
            action="/search" 
            method="get"
            className="flex items-center gap-2"
          >
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Search products..."
              className="flex-1 p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-background"
            />
            <button 
              type="submit"
              className="bg-primary text-buttonText px-4 py-2 rounded-md hover:bg-opacity-90 transition-colors"
            >
              Search
            </button>
          </form>
        </div>
        
        {/* Sort controls */}
        {products.length > 0 && (
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {products.length} results
            </p>
            <div className="flex items-center gap-2">
              <span className="text-sm">Sort by:</span>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as SortOption)}
                className="p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-background text-sm"
              >
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="name_asc">Name: A to Z</option>
                <option value="name_desc">Name: Z to A</option>
              </select>
            </div>
          </div>
        )}
      </div>
      
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : sortedProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {sortedProducts.map((product) => {
            const bestListing = getBestListing(product);
            const imageUrl = bestListing?.image_url || 'https://via.placeholder.com/300x300?text=No+Image';
            
            return (
              <div key={product.id} className="bg-surface rounded-lg shadow-sm overflow-hidden transition-transform hover:scale-[1.02]">
                <div className="aspect-square overflow-hidden bg-gray-100 dark:bg-gray-800">
                  <img 
                    src={imageUrl} 
                    alt={product.name}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-medium text-lg mb-1 line-clamp-2">{product.name}</h3>
                  
                  {product.brand && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {product.brand.name}
                    </p>
                  )}
                  
                  {bestListing ? (
                    <div className="mt-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-lg">
                          ${bestListing.price.toFixed(2)}
                        </span>
                        <span className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                          {bestListing.retailer.name}
                        </span>
                      </div>
                      
                      <div className="mt-3">
                        <a 
                          href={bestListing.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="block w-full bg-primary text-buttonText text-center py-2 rounded-md hover:bg-opacity-90 transition-colors"
                        >
                          View Deal
                        </a>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400 italic mt-2">
                      No listings available
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : query ? (
        <div className="bg-surface p-8 rounded-lg shadow-sm text-center">
          <h2 className="text-xl font-semibold mb-2">No results found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            We couldn't find any products matching "{query}"
          </p>
          <Link 
            href="/"
            className="inline-block bg-primary text-buttonText px-4 py-2 rounded-md hover:bg-opacity-90 transition-colors"
          >
            Browse Categories
          </Link>
        </div>
      ) : (
        <div className="bg-surface p-8 rounded-lg shadow-sm">
          <h2 className="text-xl font-semibold mb-2">Search for products</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Enter a search term above to find products across multiple retailers.
          </p>
        </div>
      )}
    </div>
  );
}
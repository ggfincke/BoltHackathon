'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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
  const router = useRouter();
  const query = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = 20; // 20 products per page (4 rows of 5)
  
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sortOption, setSortOption] = useState<SortOption>('price_asc');
  const [totalCount, setTotalCount] = useState(0);
  
  useEffect(() => {
    if (!query) return;
    
    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        // Calculate pagination offsets
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        
        // Get total count first (for pagination)
        const countQuery = supabase
          .from('products')
          .select('id', { count: 'exact' })
          .ilike('name', `%${query}%`);
          
        const { count, error: countError } = await countQuery;
        
        if (countError) throw countError;
        setTotalCount(count || 0);
        
        // Then get paginated data
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
          .range(from, to);
        
        if (error) throw error;
        setProducts(data || []);
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchProducts();
  }, [query, page, pageSize]);
  
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

    // Filter out listings that don't have a valid numeric price
    const validListings = product.listings.filter(
      (l) => typeof l.price === 'number' && !Number.isNaN(l.price)
    );

    if (validListings.length === 0) return null;

    // First try to find in-stock listings among the valid ones
    const inStockListings = validListings.filter((l) => l.in_stock);

    // If there are in-stock listings, return the lowest-priced one
    if (inStockListings.length > 0) {
      return inStockListings.reduce(
        (best, current) => (current.price < best.price ? current : best),
        inStockListings[0]
      );
    }

    // Otherwise return the overall lowest-priced listing
    return validListings.reduce(
      (best, current) => (current.price < best.price ? current : best),
      validListings[0]
    );
  };
  
  // Handle page change
  const handlePageChange = (newPage: number) => {
    // Create new URL with updated page parameter
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    
    router.push(`/search?${params.toString()}`);
  };
  
  // Calculate total pages for pagination
  const totalPages = Math.ceil(totalCount / pageSize);
  
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
              Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, totalCount)} of {totalCount} results
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
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
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
                  <div className="p-3">
                    <h3 className="font-medium text-sm mb-1 line-clamp-2">{product.name}</h3>
                    
                    {product.brand && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                        {product.brand.name}
                      </p>
                    )}
                    
                    {bestListing ? (
                      <div className="mt-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-base">
                            {bestListing.price != null
                              ? `$${bestListing.price.toFixed(2)}`
                              : 'N/A'}
                          </span>
                          <span className="text-xs bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                            {bestListing.retailer.name}
                          </span>
                        </div>
                        
                        <div className="mt-2">
                          <a 
                            href={bestListing.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="block w-full bg-primary text-buttonText text-center py-1.5 rounded-md hover:bg-opacity-90 transition-colors text-sm"
                          >
                            View Deal
                          </a>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 italic mt-1 text-xs">
                        No listings available
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex justify-center">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="px-3 py-1 rounded-md bg-surface border border-gray-300 dark:border-gray-700 disabled:opacity-50"
                >
                  Previous
                </button>
                
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  // Show pages around current page
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      className={`w-8 h-8 flex items-center justify-center rounded-md ${
                        page === pageNum 
                          ? 'bg-primary text-buttonText' 
                          : 'bg-surface border border-gray-300 dark:border-gray-700'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  className="px-3 py-1 rounded-md bg-surface border border-gray-300 dark:border-gray-700 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
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
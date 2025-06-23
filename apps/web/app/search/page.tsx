'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '~/lib/supabaseClient';
import Link from 'next/link';
import Pagination from '~/components/ui/Pagination';
import ProductGrid from '~/components/product/ProductGrid';

type Product = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  brand_id?: string | null;
  brand?: {
    name: string;
  } | null;
  listings?: {
    id: string;
    price: number | null;
    currency: string | null;
    in_stock: boolean | null;
    url: string;
    image_url?: string | null;
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
        setProducts((data ?? []) as unknown as Product[]);
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
    const aPrice = a.listings?.reduce((min, listing) => {
      if (listing.price === null) return min;
      return min === null || listing.price < min ? listing.price : min;
    }, null as number | null);
    
    const bPrice = b.listings?.reduce((min, listing) => {
      if (listing.price === null) return min;
      return min === null || listing.price < min ? listing.price : min;
    }, null as number | null);
    
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
          <ProductGrid products={sortedProducts} />
          
          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination 
              currentPage={page} 
              totalPages={totalPages} 
              onPageChange={handlePageChange} 
            />
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
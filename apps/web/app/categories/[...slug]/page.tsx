'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '~/lib/supabaseClient';
import { Database } from '~/lib/database.types';
import Breadcrumbs from '~/components/Breadcrumbs';
import ProductGrid from '~/components/ProductGrid';

type Category = Database['public']['Tables']['categories']['Row'];
type Product = {
  id: string;
  name: string;
  slug: string;
  brand?: { name: string } | null;
  listings?: {
    id: string;
    price: number | null;
    currency: string | null;
    in_stock: boolean | null;
    url: string;
    image_url?: string | null;
    retailer: { name: string };
  }[];
};

type SortOption = 'price_asc' | 'price_desc' | 'name_asc' | 'name_desc';

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<Category | null>(null);
  const [subcategories, setSubcategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<{name: string, slug: string}[]>([]);
  const [totalProducts, setTotalProducts] = useState(0);
  const [sortOption, setSortOption] = useState<SortOption>('price_asc');
  
  // Pagination
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = 20; // 20 products per page (4 rows of 5)
  
  // Get slug from params
  const slugArray = Array.isArray(params.slug) ? params.slug : [params.slug];
  const currentSlug = slugArray[slugArray.length - 1] as string;

  useEffect(() => {
    const fetchCategoryData = async () => {
      setLoading(true);
      try {
        // Fetch current category
        const { data: categoryData, error: categoryError } = await supabase
          .from('categories')
          .select('*')
          .eq('slug', currentSlug)
          .eq('is_active', true)
          .single();

        if (categoryError) throw categoryError;
        setCategory(categoryData);

        // Fetch subcategories
        const { data: subcategoriesData, error: subcategoriesError } = await supabase
          .from('categories')
          .select('*')
          .eq('parent_id', categoryData.id)
          .eq('is_active', true)
          .order('name');

        if (subcategoriesError) throw subcategoriesError;
        setSubcategories(subcategoriesData || []);

        // If no subcategories, fetch products
        if (!subcategoriesData?.length) {
          // First get product IDs from the junction table
          const { data: productCategoryData, error: productCategoryError } = await supabase
            .from('product_categories')
            .select('product_id')
            .eq('category_id', categoryData.id);
            
          if (productCategoryError) throw productCategoryError;
          
          // Extract product IDs from the junction table results
          const productIds = productCategoryData.map(item => item.product_id);
          
          // Get total count for pagination
          setTotalProducts(productIds.length);
          
                      // Only proceed if we have product IDs
            if (productIds.length > 0) {
              console.log(`Found ${productIds.length} products in category`);
              
              // Calculate pagination - get the specific IDs for this page
              const from = (page - 1) * pageSize;
              const to = from + pageSize - 1;
              const pageProductIds = productIds.slice(from, Math.min(to + 1, productIds.length));
              
              console.log(`Fetching ${pageProductIds.length} products for page ${page}`);
              
              // Chunk the page product IDs to avoid URL length limits (max 50 IDs per request)
              const chunkSize = 50;
              const productChunks = [];
              for (let i = 0; i < pageProductIds.length; i += chunkSize) {
                productChunks.push(pageProductIds.slice(i, i + chunkSize));
              }
              
              // Fetch products in chunks and combine results
              const allProducts = [];
              for (const chunk of productChunks) {
                try {
                  const { data: productsData, error: productsError } = await supabase
                    .from('products')

                    // TODO: add image_url later once there are entries; for some reason compiler doesn't like it 
                    .select(`
                      id, 
                      name, 
                      slug, 
                      brand:brands(name),
                      listings(
                        id, 
                        price, 
                        currency, 
                        in_stock, 
                        url,
                        retailer:retailers(name)
                      )
                    `)
                    .in('id', chunk)
                    .eq('is_active', true);

                  if (productsError) {
                    console.error('Error fetching product chunk:', productsError);
                    throw productsError;
                  }
                  
                  if (productsData) {
                    allProducts.push(...productsData);
                  }
                } catch (chunkError) {
                  console.error('Error in product chunk fetch:', chunkError);
                  // Continue with other chunks even if one fails
                }
              }
              
              console.log(`Successfully loaded ${allProducts.length} products`);
              setProducts(allProducts);
            } else {
              setProducts([]);
            }
        }

        // Build breadcrumbs
        await buildBreadcrumbs(categoryData);
      } catch (error) {
        console.error('Error fetching category data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (currentSlug) {
      fetchCategoryData();
    }
  }, [currentSlug, page]);

  // Build breadcrumb trail by traversing parent categories
  const buildBreadcrumbs = async (currentCategory: Category) => {
    const breadcrumbsArray = [{ name: currentCategory.name, slug: currentCategory.slug }];
    let parentId = currentCategory.parent_id;
    
    while (parentId) {
      const { data: parent } = await supabase
        .from('categories')
        .select('id, name, slug, parent_id')
        .eq('id', parentId)
        .single();
      
      if (parent) {
        breadcrumbsArray.unshift({ name: parent.name, slug: parent.slug });
        parentId = parent.parent_id;
      } else {
        break;
      }
    }
    
    // Add home at the beginning
    breadcrumbsArray.unshift({ name: 'Home', slug: '' });
    setBreadcrumbs(breadcrumbsArray);
  };

  // Handle sort change
  const handleSortChange = (option: SortOption) => {
    setSortOption(option);
    
    // Sort products based on selected option
    const sortedProducts = [...products].sort((a, b) => {
      // Get the lowest price listing for each product
      const aPrice = a.listings?.reduce((min, listing) => 
        listing.price !== null && (min === null || listing.price < min) ? listing.price : min, 
        null as number | null
      );
      
      const bPrice = b.listings?.reduce((min, listing) => 
        listing.price !== null && (min === null || listing.price < min) ? listing.price : min, 
        null as number | null
      );
      
      switch (option) {
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
    
    setProducts(sortedProducts);
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    // Create new URL with updated page parameter
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    
    router.push(`/categories/${slugArray.join('/')}?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="container mx-auto py-8">
        <div className="bg-surface p-8 rounded-lg shadow-sm text-center">
          <h2 className="text-xl font-semibold mb-2">Category not found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            The category you're looking for doesn't exist or has been removed.
          </p>
          <Link 
            href="/categories"
            className="inline-block bg-primary text-buttonText px-4 py-2 rounded-md hover:bg-opacity-90 transition-colors"
          >
            Browse Categories
          </Link>
        </div>
      </div>
    );
  }

  // Calculate total pages for pagination
  const totalPages = Math.ceil(totalProducts / pageSize);

  return (
    <div className="container mx-auto py-8">
      {/* Breadcrumbs */}
      <Breadcrumbs items={breadcrumbs} />

      <h1 className="text-3xl font-bold mb-6">{category.name}</h1>
      
      {category.description && (
        <div className="mb-6 text-gray-600 dark:text-gray-400">
          <p>{category.description}</p>
        </div>
      )}

      {/* Subcategories */}
      {subcategories.length > 0 ? (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Browse Categories</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {subcategories.map((subcat) => (
              <Link 
                key={subcat.id} 
                href={`/categories/${subcat.slug}`}
                className="bg-surface p-4 rounded-lg shadow-sm hover:shadow-md transition-shadow flex flex-col items-center text-center"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-primary">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                  </svg>
                </div>
                <h3 className="font-medium text-sm">{subcat.name}</h3>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        // Products grid (leaf category)
        <div>
          {products.length > 0 ? (
            <>
              {/* Sort controls */}
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, totalProducts)} of {totalProducts} products
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-sm">Sort by:</span>
                  <select
                    value={sortOption}
                    onChange={(e) => handleSortChange(e.target.value as SortOption)}
                    className="p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-background text-sm"
                  >
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                    <option value="name_asc">Name: A to Z</option>
                    <option value="name_desc">Name: Z to A</option>
                  </select>
                </div>
              </div>
              
              {/* Products grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {products.map((product) => {
                  const bestListing = product.listings?.reduce((best, current) => {
                    if (!best) return current;
                    if (!current.price) return best;
                    if (!best.price) return current;
                    return current.price < best.price ? current : best;
                  }, null as any);
                  
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
          ) : (
            <div className="bg-surface p-8 rounded-lg shadow-sm text-center">
              <h2 className="text-xl font-semibold mb-2">No products found</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                There are no products in this category yet.
              </p>
              <Link 
                href="/categories"
                className="inline-block bg-primary text-buttonText px-4 py-2 rounded-md hover:bg-opacity-90 transition-colors"
              >
                Browse Categories
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
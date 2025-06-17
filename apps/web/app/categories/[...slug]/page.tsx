'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '~/lib/supabaseClient';
import { Database } from '~/lib/database.types';

type Category = Database['public']['Tables']['categories']['Row'];
type Product = {
  id: string;
  name: string;
  slug: string;
  brand?: { name: string } | null;
  listings?: {
    id: string;
    price: number | null;
    currency: string;
    in_stock: boolean;
    url: string;
    image_url?: string | null;
    retailer: { name: string };
  }[];
};

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<Category | null>(null);
  const [subcategories, setSubcategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<{name: string, slug: string}[]>([]);

  // Get slug from params
  const slugArray = Array.isArray(params.slug) ? params.slug : [params.slug];
  const currentSlug = slugArray[slugArray.length - 1];

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
          const { data: productsData, error: productsError } = await supabase
            .from('products')
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
                image_url,
                retailer:retailers(name)
              )
            `)
            .in('id', (
              supabase
                .from('product_categories')
                .select('product_id')
                .eq('category_id', categoryData.id)
            ))
            .eq('is_active', true)
            .limit(50);

          if (productsError) throw productsError;
          setProducts(productsData || []);
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
  }, [currentSlug]);

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
        (best, current) => (current.price! < best.price! ? current : best),
        inStockListings[0]
      );
    }

    // Otherwise return the overall lowest-priced listing
    return validListings.reduce(
      (best, current) => (current.price! < best.price! ? current : best),
      validListings[0]
    );
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

  return (
    <div className="container mx-auto py-8">
      {/* Breadcrumbs */}
      <nav className="mb-6">
        <ol className="flex flex-wrap items-center text-sm">
          {breadcrumbs.map((crumb, index) => (
            <li key={crumb.slug} className="flex items-center">
              {index > 0 && <span className="mx-2 text-gray-500">/</span>}
              {index === breadcrumbs.length - 1 ? (
                <span className="font-medium">{crumb.name}</span>
              ) : (
                <Link 
                  href={crumb.slug ? `/categories/${crumb.slug}` : '/'}
                  className="text-primary hover:underline"
                >
                  {crumb.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>

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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {subcategories.map((subcat) => (
              <Link 
                key={subcat.id} 
                href={`/categories/${subcat.slug}`}
                className="bg-surface p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow flex flex-col items-center text-center"
              >
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-primary">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
                  </svg>
                </div>
                <h3 className="font-medium text-lg">{subcat.name}</h3>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        // Products grid (leaf category)
        <div>
          {products.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {products.map((product) => {
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
                              {bestListing.price != null
                                ? `$${bestListing.price.toFixed(2)}`
                                : 'N/A'}
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
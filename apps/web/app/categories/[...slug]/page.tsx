'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '~/lib/supabaseClient';
import { Database } from '~/lib/database.types';
import Breadcrumbs from '~/components/layout/Breadcrumbs';
import Pagination from '~/components/ui/Pagination';
import ProductGrid from '~/components/product/ProductGrid';
import BasketPopup from '~/components/shared/BasketPopup';


type Category = Database['public']['Tables']['categories']['Row'];
type Product = {
  id: string;
  name: string;
  slug: string;
  brand?: { name: string } | null;
  listings?: {
    id: string;
    retailer_id: string;
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
  
  // Pagination and sorting from URL params
  const page = parseInt(searchParams.get('page') || '1', 10);
  const sortOption = (searchParams.get('sort') as SortOption) || 'price_asc';
  const pageSize = 20;
  
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
          const { data: productCategoryData, error: productCategoryError } = await supabase
            .from('product_categories')
            .select('product_id')
            .eq('category_id', categoryData.id);
            
          if (productCategoryError) throw productCategoryError;
          
          const productIds = productCategoryData.map(item => item.product_id);
          setTotalProducts(productIds.length);
          
          if (productIds.length > 0) {
            const from = (page - 1) * pageSize;
            const to = from + pageSize - 1;
            const pageProductIds = productIds.slice(from, Math.min(to + 1, productIds.length));
            
            const chunkSize = 50;
            const productChunks = [];
            for (let i = 0; i < pageProductIds.length; i += chunkSize) {
              productChunks.push(pageProductIds.slice(i, i + chunkSize));
            }
            
            const allProducts = [];
            for (const chunk of productChunks) {
              try {
                const { data: productsData, error: productsError } = await supabase
                  .from('products')
                  .select(`
                    id, 
                    name, 
                    slug, 
                    brand:brands(name),
                    listings(
                      id,
                      retailer_id,
                      price, 
                      currency, 
                      in_stock, 
                      url,
                      image_url,
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
              }
            }
            
            // Apply sorting to the products
            const sortedProducts = applySorting(allProducts as unknown as Product[], sortOption);
            setProducts(sortedProducts);
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
  }, [currentSlug, page, sortOption]);

  const applySorting = (products: Product[], option: SortOption): Product[] => {
    return [...products].sort((a, b) => {
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
  };

  const buildBreadcrumbs = async (currentCategory: Category) => {
    // Start with the current category
    const categoryCrumbs: { name: string; slug: string }[] = [
      { name: currentCategory.name, slug: currentCategory.slug },
    ];

    // Traverse up the hierarchy collecting parents, while omitting generic parents
    let parentId = currentCategory.parent_id;
    const GENERIC_PARENT_SLUGS = ['groceries', 'grocery-store'];

    while (parentId) {
      const { data: parent } = await supabase
        .from('categories')
        .select('id, name, slug, parent_id')
        .eq('id', parentId)
        .single();

      if (parent) {
        // Only include parent if it's not a generic grouping category
        if (!GENERIC_PARENT_SLUGS.includes(parent.slug)) {
          categoryCrumbs.unshift({ name: parent.name, slug: parent.slug });
        }
        parentId = parent.parent_id;
      } else {
        break;
      }
    }

    // Prepend fixed breadcrumbs: Home and Categories
    const breadcrumbsArray = [
      { name: 'Home', slug: '' },
      { name: 'Categories', slug: '' }, // Handled specially in Breadcrumbs component
      ...categoryCrumbs,
    ];

    setBreadcrumbs(breadcrumbsArray);
  };

  const handleSortChange = (option: SortOption) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', option);
    params.set('page', '1'); // Reset to first page when sorting changes
    
    router.push(`/categories/${slugArray.join('/')}?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    
    // Preserve current sort option
    if (sortOption !== 'price_asc') {
      params.set('sort', sortOption);
    }
    
    router.push(`/categories/${slugArray.join('/')}?${params.toString()}`);
  };

  const handleProductAdded = () => {
    // This callback is triggered when a product is added to the basket
    // The BasketPopup component will handle its own state updates
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
            The category you&apos;re looking for doesn&apos;t exist or has been removed.
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

  const totalPages = Math.ceil(totalProducts / pageSize);

  return (
    <>
      <div className="container mx-auto py-8">
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
                <ProductGrid 
                  products={products} 
                  onProductAdded={handleProductAdded}
                />
                
                {/* Pagination */}
                {totalPages > 1 && (
                  <Pagination 
                    currentPage={page} 
                    totalPages={totalPages} 
                    onPageChange={handlePageChange} 
                  />
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

      {/* Basket Popup - only shown on product grid pages */}
      <BasketPopup onProductAdded={handleProductAdded} />
    </>
  );
}
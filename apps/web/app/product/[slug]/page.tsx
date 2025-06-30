'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '~/lib/supabaseClient';
import { useAuth } from '~/lib/auth';
import Breadcrumbs from '~/components/layout/Breadcrumbs';
import PriceHistoryChart from '~/components/product/PriceHistoryChart';
import PriceComparisonTable from '~/components/product/PriceComparisonTable';
import ProductTrackingForm from '~/components/product/ProductTrackingForm';
import AddToBasketModal from '~/components/shared/AddToBasketModal';

type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  upc: string | null;
  review_score: number | null;
  review_count: number | null;
  brand: {
    id: string;
    name: string;
  } | null;
  categories: {
    id: string;
    name: string;
    slug: string;
    parent_id?: string | null;
    parent?: {
      id: string;
      name: string;
      slug: string;
    };
  }[];
  listings: {
    id: string;
    retailer_id: string;
    price: number | null;
    sale_price: number | null;
    currency: string | null;
    in_stock: boolean | null;
    availability_status: string | null;
    url: string;
    image_url: string | null;
    retailer: {
      id: string;
      name: string;
    };
  }[];
  price_histories: {
    id: string;
    listing_id: string;
    price: number;
    timestamp: string;
    retailer: {
      id: string;
      name: string;
    };
  }[];
};

type TrackingPreferences = {
  id?: string;
  target_price: number | null;
  notify_on_price_drop: boolean;
  notify_on_availability: boolean;
  notify_on_changes: boolean;
};

export default function ProductPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [trackingPreferences, setTrackingPreferences] = useState<TrackingPreferences>({
    target_price: null,
    notify_on_price_drop: true,
    notify_on_availability: true,
    notify_on_changes: true
  });
  const [isTracking, setIsTracking] = useState(false);
  const [savingTracking, setSavingTracking] = useState(false);
  const [breadcrumbs, setBreadcrumbs] = useState<{name: string, slug: string}[]>([]);
  const [isAddToBasketModalOpen, setIsAddToBasketModalOpen] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('products')
          .select(`
            id, 
            name, 
            slug, 
            description,
            upc,
            review_score,
            review_count,
            brand:brands(id, name),
            categories:product_categories(
              category:categories(
                id, 
                name, 
                slug,
                parent_id
              )
            ),
            listings(
              id,
              retailer_id,
              price,
              sale_price,
              currency,
              in_stock,
              availability_status,
              url,
              image_url,
              retailer:retailers(id, name)
            )
          `)
          .eq('slug', params.slug as string)
          .single();

        if (error) throw error;

        if (data) {
          // Fetch price history for all listings
          const priceHistories = await Promise.all(
            data.listings.map(async (listing) => {
              const { data: historyData, error: historyError } = await supabase
                .from('price_histories')
                .select(`
                  id,
                  listing_id,
                  price,
                  timestamp,
                  retailer:listings(
                    retailer:retailers(id, name)
                  )
                `)
                .eq('listing_id', listing.id)
                .order('timestamp', { ascending: true })
                .limit(100);
              
              if (historyError) {
                console.error('Error fetching price history:', historyError);
                return [];
              }
              
              // historyData can include error types in its union; cast to any[] for safe spreading
              const safeHistory: any[] = (historyData ?? []) as any[];
              
              return safeHistory.map((item: any) => ({
                ...item,
                retailer: item?.retailer?.retailer || { id: '', name: 'Unknown' }
              }));
            })
          );

          // Enhanced category processing with parent categories
          const categoriesWithParents = await Promise.all(
            data.categories.map(async (pc) => {
              const category = pc.category;
              
              // If this category has a parent, fetch it
              if (category.parent_id) {
                const { data: parentData, error: parentError } = await supabase
                  .from('categories')
                  .select('id, name, slug, parent_id')
                  .eq('id', category.parent_id)
                  .single();
                
                if (!parentError && parentData) {
                  return {
                    ...category,
                    parent: parentData
                  };
                }
              }
              
              return category;
            })
          );

          // Format the data
          const formattedProduct = {
            ...data,
            categories: categoriesWithParents,
            price_histories: priceHistories.flat()
          };

          setProduct(formattedProduct);
          
          // Build breadcrumbs with parent categories
          if (formattedProduct.categories && formattedProduct.categories.length > 0) {
            // Use the first category for breadcrumbs and build hierarchy
            const category = formattedProduct.categories[0];
            const breadcrumbItems = [
              { name: 'Home', slug: '' },
              { name: 'Categories', slug: 'categories' }
            ];
            
            // Add parent category if it exists
            if ('parent' in category && category.parent) {
              breadcrumbItems.push({ name: category.parent.name, slug: category.parent.slug });
            }
            
            // Add current category
            breadcrumbItems.push({ name: category.name, slug: category.slug });
            breadcrumbItems.push({ name: formattedProduct.name, slug: '' });
            setBreadcrumbs(breadcrumbItems);
          } else {
            setBreadcrumbs([
              { name: 'Home', slug: '' },
              { name: formattedProduct.name, slug: '' }
            ]);
          }
        }

        // If user is logged in, check if they're already tracking this product
        if (user && data) {
          const { data: trackingData, error: trackingError } = await supabase
            .from('product_trackings')
            .select('*')
            .eq('user_id', user.id)
            .eq('product_id', data.id)
            .single();

          if (!trackingError && trackingData) {
            setIsTracking(true);
            setTrackingPreferences({
              id: trackingData.id,
              target_price: trackingData.target_price,
              notify_on_price_drop: trackingData.notify_on_price_drop ?? false,
              notify_on_availability: trackingData.notify_on_availability ?? false,
              notify_on_changes: trackingData.notify_on_changes ?? false
            });
          }
        }
      } catch (error) {
        console.error('Error fetching product:', error);
      } finally {
        setLoading(false);
      }
    };

    if (params.slug) {
      fetchProduct();
    }
  }, [params.slug, user]);

  const handleTrackingSubmit = async (preferences: TrackingPreferences) => {
    if (!user) {
      router.push('/auth/login');
      return;
    }

    if (!product) return;

    setSavingTracking(true);
    try {
      // Use UPSERT to handle both insert and update cases
      const { error } = await supabase
        .from('product_trackings')
        .upsert({
          user_id: user.id,
          product_id: product.id,
          target_price: preferences.target_price,
          notify_on_price_drop: preferences.notify_on_price_drop,
          notify_on_availability: preferences.notify_on_availability,
          notify_on_changes: preferences.notify_on_changes
        }, {
          onConflict: 'user_id,product_id'
        });

      if (error) throw error;
      setIsTracking(true);
    } catch (error: any) {
      console.error('Error saving tracking preferences:', error);
      console.error('Full error object:', JSON.stringify(error, null, 2));
      console.error('Error details:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
      });
    } finally {
      setSavingTracking(false);
    }
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

  if (!product) {
    return (
      <div className="container mx-auto py-8">
        <div className="bg-surface p-8 rounded-lg shadow-sm text-center">
          <h2 className="text-xl font-semibold mb-2">Product not found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            The product you're looking for doesn't exist or has been removed.
          </p>
          <button
            onClick={() => router.back()}
            className="inline-block bg-primary text-buttonText px-4 py-2 rounded-md hover:bg-opacity-90 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Get best listing (lowest price in stock)
  const getBestListing = () => {
    if (!product.listings?.length) return null;

    // Filter out listings that don't have a valid numeric price
    const validListings = product.listings.filter(
      (l) => typeof l.price === 'number' && l.price !== null
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

  const bestListing = getBestListing();
  const mainImageUrl = bestListing?.image_url || 'https://via.placeholder.com/600x600?text=No+Image';

  return (
    <div className="container mx-auto py-8">
      {/* Breadcrumbs */}
      <Breadcrumbs items={breadcrumbs} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Product Image */}
        <div className="lg:col-span-1 space-y-6">
          <div className="card-enhanced bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-sm hover-lift">
            <img 
              src={mainImageUrl} 
              alt={product.name}
              className="w-full h-auto object-contain aspect-square"
            />
          </div>
          
          {/* Price History Chart - moved under product image */}
          {product.price_histories && product.price_histories.length > 0 && (
            <div className="animate-fade-in-up delay-300">
              <div className="flex items-center mb-4">
                <svg className="w-5 h-5 mr-2" style={{ color: 'var(--secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <h3 className="text-lg font-semibold">Price History</h3>
              </div>
              <div className="card-enhanced bg-surface p-6 rounded-lg shadow-sm">
                <PriceHistoryChart priceHistories={product.price_histories} />
              </div>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card-enhanced bg-surface p-8 rounded-lg shadow-sm animate-fade-in-up">
            <h1 className="text-3xl font-bold mb-4">{product.name}</h1>
            
            <div className="flex flex-wrap gap-2 mb-6">
              {product.categories.map(category => (
                <a 
                  key={category.id}
                  href={`/categories/${category.slug}`}
                  className="px-3 py-1 rounded-full text-sm font-medium transition-all hover-lift"
                  style={{ 
                    background: 'var(--accent)',
                    color: 'var(--light-text)'
                  }}
                >
                  {category.name}
                </a>
              ))}
            </div>
            
            {product.brand && (
              <div className="mb-6 flex items-center">
                <span className="text-muted text-sm font-medium">Brand:</span>
                <span className="ml-2 font-semibold" style={{ color: 'var(--primary)' }}>
                  {product.brand.name}
                </span>
              </div>
            )}
            
            {product.review_score !== null && (
              <div className="mb-6 flex items-center">
                <div className="flex items-center mr-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg 
                      key={i}
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 24 24" 
                      fill={i < Math.round(product.review_score || 0) ? "currentColor" : "none"}
                      stroke="currentColor"
                      className={`w-5 h-5 ${i < Math.round(product.review_score || 0) ? "text-yellow-400" : "text-gray-300"}`}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={i < Math.round(product.review_score || 0) ? 0 : 1.5} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                    </svg>
                  ))}
                </div>
                <span className="text-sm text-muted font-medium">
                  {product.review_score?.toFixed(1)} ({product.review_count} reviews)
                </span>
              </div>
            )}
            
            {product.description && (
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-3">Description</h2>
                <p className="text-secondary leading-relaxed">{product.description}</p>
              </div>
            )}
            
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Best Price Section */}
              {bestListing && (
                <div className="p-6 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                  <div className="flex items-baseline mb-2">
                    <span className="text-4xl font-bold" style={{ color: 'var(--primary)' }}>
                      ${bestListing.price?.toFixed(2)}
                    </span>
                    {bestListing.sale_price && bestListing.price && bestListing.sale_price < bestListing.price && (
                      <span className="ml-3 text-lg text-muted line-through">
                        ${bestListing.price.toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="mb-4 flex items-center">
                    <span className="text-sm text-muted">Best price from</span>
                    <span className="ml-1 font-semibold" style={{ color: 'var(--secondary)' }}>
                      {bestListing.retailer.name}
                    </span>
                    {bestListing.in_stock && (
                      <span className="status-badge success ml-3">
                        In Stock
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={() => setIsAddToBasketModalOpen(true)}
                      className="btn-base px-6 py-3 rounded-lg font-semibold flex items-center justify-center space-x-2 hover-lift"
                      style={{ 
                        background: 'var(--primary)',
                        color: 'var(--dark-text)'
                      }}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      <span>Add to Basket</span>
                    </button>
                    <a 
                      href={bestListing.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="btn-base px-6 py-3 rounded-lg font-semibold flex items-center justify-center space-x-2 hover-lift"
                      style={{ 
                        background: 'var(--secondary)',
                        color: 'var(--light-text)'
                      }}
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      <span>View Best Deal</span>
                    </a>
                  </div>
                </div>
              )}

              {/* Price Comparison Section */}
              <div className="p-6 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
                <div className="flex items-center mb-4">
                  <svg className="w-5 h-5 mr-2" style={{ color: 'var(--primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <h3 className="text-lg font-semibold">All Retailers</h3>
                </div>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {product.listings
                    .filter(listing => listing.price !== null)
                    .sort((a, b) => {
                      // In stock first, then by price
                      if (a.in_stock && !b.in_stock) return -1;
                      if (!a.in_stock && b.in_stock) return 1;
                      return (a.price || 0) - (b.price || 0);
                    })
                    .map((listing, index) => (
                      <div key={listing.id} className={`flex items-center justify-between p-3 rounded-lg ${index === 0 ? 'bg-success-bg border border-primary' : 'bg-hover'}`}>
                        <div className="flex items-center">
                          <div className="text-sm font-medium mr-2">{listing.retailer.name}</div>
                          {index === 0 && (
                            <span className="text-xs px-2 py-1 rounded-full bg-primary text-dark-text font-medium">Best</span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold">${listing.price?.toFixed(2)}</span>
                          <span className={`status-badge ${listing.in_stock ? 'success' : 'error'} text-xs`}>
                            {listing.in_stock ? 'In Stock' : 'Out'}
                          </span>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
            </div>
          </div>
          
          {/* Price Tracking Form */}
          <div className="card-enhanced bg-surface p-8 rounded-lg shadow-sm animate-fade-in-up delay-100">
            <div className="flex items-center mb-6">
              <svg className="w-6 h-6 mr-3" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM9.86 1.86L11 3l-1.14 1.14a4 4 0 000 5.66L11 11l-1.14 1.14a4 4 0 000 5.66L11 19l-1.14 1.14a4 4 0 01-5.66 0L3 19l1.14-1.14a4 4 0 010-5.66L3 11l1.14-1.14a4 4 0 010-5.66L3 3l1.14-1.14a4 4 0 015.66 0z" />
              </svg>
              <h2 className="text-xl font-semibold">Track This Product</h2>
            </div>
            <ProductTrackingForm 
              isTracking={isTracking}
              preferences={trackingPreferences}
              onSubmit={handleTrackingSubmit}
              isLoading={savingTracking}
              isLoggedIn={!!user}
              currentPrice={bestListing?.price || null}
            />
          </div>
        </div>
      </div>

      {/* Add to Basket Modal */}
      <AddToBasketModal
        isOpen={isAddToBasketModalOpen}
        onClose={() => setIsAddToBasketModalOpen(false)}
        productId={product.id}
        productName={product.name}
      />
    </div>
  );
}
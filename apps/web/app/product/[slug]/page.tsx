'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '~/lib/supabaseClient';
import { useAuth } from '~/lib/auth';
import Breadcrumbs from '~/components/Breadcrumbs';
import PriceHistoryChart from '~/components/PriceHistoryChart';
import PriceComparisonTable from '~/components/PriceComparisonTable';
import ProductTrackingForm from '~/components/ProductTrackingForm';
import AddToBasketModal from '~/components/AddToBasketModal';

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
              category:categories(id, name, slug)
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
              
              return historyData.map(item => ({
                ...item,
                retailer: item.retailer?.retailer || { id: '', name: 'Unknown' }
              }));
            })
          );

          // Format the data
          const formattedProduct = {
            ...data,
            categories: data.categories.map(c => c.category),
            price_histories: priceHistories.flat()
          };

          setProduct(formattedProduct);
          
          // Build breadcrumbs
          if (formattedProduct.categories && formattedProduct.categories.length > 0) {
            // Use the first category for breadcrumbs
            const category = formattedProduct.categories[0];
            const breadcrumbItems = [
              { name: 'Home', slug: '' },
              { name: 'Categories', slug: 'categories' },
              { name: category.name, slug: category.slug },
              { name: formattedProduct.name, slug: '' }
            ];
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
              notify_on_price_drop: trackingData.notify_on_price_drop,
              notify_on_availability: trackingData.notify_on_availability,
              notify_on_changes: trackingData.notify_on_changes
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
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-sm">
            <img 
              src={mainImageUrl} 
              alt={product.name}
              className="w-full h-auto object-contain aspect-square"
            />
          </div>
        </div>

        {/* Product Info */}
        <div className="lg:col-span-2">
          <div className="bg-surface p-6 rounded-lg shadow-sm mb-6">
            <h1 className="text-2xl font-bold mb-2">{product.name}</h1>
            
            <div className="flex flex-wrap gap-2 mb-4">
              {product.categories.map(category => (
                <a 
                  key={category.id}
                  href={`/categories/${category.slug}`}
                  className="text-xs bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  {category.name}
                </a>
              ))}
            </div>
            
            {product.brand && (
              <div className="mb-4">
                <span className="text-gray-600 dark:text-gray-400 text-sm">Brand: </span>
                <span className="font-medium">{product.brand.name}</span>
              </div>
            )}
            
            {product.upc && (
              <div className="mb-4">
                <span className="text-gray-600 dark:text-gray-400 text-sm">UPC: </span>
                <span className="font-mono">{product.upc}</span>
              </div>
            )}
            
            {product.review_score !== null && (
              <div className="mb-4 flex items-center">
                <div className="flex items-center mr-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <svg 
                      key={i}
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 24 24" 
                      fill={i < Math.round(product.review_score || 0) ? "currentColor" : "none"}
                      stroke="currentColor"
                      className={`w-4 h-4 ${i < Math.round(product.review_score || 0) ? "text-yellow-400" : "text-gray-300"}`}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={i < Math.round(product.review_score || 0) ? 0 : 1.5} d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                    </svg>
                  ))}
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {product.review_score?.toFixed(1)} ({product.review_count} reviews)
                </span>
              </div>
            )}
            
            {product.description && (
              <div className="mb-4">
                <h2 className="text-lg font-semibold mb-2">Description</h2>
                <p className="text-gray-700 dark:text-gray-300">{product.description}</p>
              </div>
            )}
            
            {bestListing && (
              <div className="mt-4">
                <div className="flex items-baseline">
                  <span className="text-3xl font-bold text-primary">
                    ${bestListing.price?.toFixed(2)}
                  </span>
                  {bestListing.sale_price && bestListing.price && bestListing.sale_price < bestListing.price && (
                    <span className="ml-2 text-gray-500 line-through">
                      ${bestListing.price.toFixed(2)}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-sm">
                  Best price from <span className="font-medium">{bestListing.retailer.name}</span>
                </div>
                <div className="mt-4 flex gap-3">
                  <a 
                    href={bestListing.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-block bg-primary text-buttonText px-6 py-3 rounded-md hover:bg-opacity-90 transition-colors font-medium"
                  >
                    View Best Deal
                  </a>
                  <button
                    onClick={() => setIsAddToBasketModalOpen(true)}
                    className="inline-block bg-surface border border-gray-300 dark:border-gray-700 px-6 py-3 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors font-medium"
                  >
                    Add to Basket
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Price Tracking Form */}
          <div className="bg-surface p-6 rounded-lg shadow-sm mb-6">
            <h2 className="text-lg font-semibold mb-4">Track This Product</h2>
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

      {/* Price Comparison Table */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold mb-4">Price Comparison</h2>
        <PriceComparisonTable listings={product.listings} />
      </div>

      {/* Price History Chart */}
      {product.price_histories && product.price_histories.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Price History</h2>
          <div className="bg-surface p-6 rounded-lg shadow-sm">
            <PriceHistoryChart priceHistories={product.price_histories} />
          </div>
        </div>
      )}

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
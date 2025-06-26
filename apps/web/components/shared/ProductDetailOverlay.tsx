'use client';

import { useState, useEffect } from 'react';
import { supabase } from '~/lib/supabaseClient';
import { useAuth } from '~/lib/auth';
import Link from 'next/link';

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
};

interface ProductDetailOverlayProps {
  productId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToBasket: (productId: string) => void;
}

export default function ProductDetailOverlay({ 
  productId, 
  isOpen, 
  onClose, 
  onAddToBasket 
}: ProductDetailOverlayProps) {
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedListing, setSelectedListing] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && productId) {
      fetchProduct();
    }
  }, [isOpen, productId]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const fetchProduct = async () => {
    if (!productId) return;

    try {
      setLoading(true);
      
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
        .eq('id', productId)
        .single();

      if (error) throw error;
      setProduct(data);
      
      // Select the best listing by default
      if (data.listings && data.listings.length > 0) {
        const bestListing = data.listings
          .filter(l => l.price !== null && l.in_stock)
          .sort((a, b) => (a.price || 0) - (b.price || 0))[0];
        
        setSelectedListing(bestListing?.id || data.listings[0].id);
      }
      
    } catch (error) {
      console.error('Error fetching product:', error);
    } finally {
      setLoading(false);
    }
  };

  const getBestListing = () => {
    if (!product?.listings?.length) return null;
    
    const validListings = product.listings.filter(l => l.price !== null);
    if (validListings.length === 0) return null;
    
    const inStockListings = validListings.filter(l => l.in_stock);
    
    if (inStockListings.length > 0) {
      return inStockListings.reduce((best, current) => 
        (current.price! < best.price!) ? current : best
      );
    }
    
    return validListings.reduce((best, current) => 
      (current.price! < best.price!) ? current : best
    );
  };

  const getSelectedListing = () => {
    return product?.listings?.find(l => l.id === selectedListing) || getBestListing();
  };

  const handleAddToBasket = () => {
    if (product) {
      onAddToBasket(product.id);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold">Product Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : product ? (
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Product Image */}
                <div className="space-y-4">
                  <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                    <img
                      src={getSelectedListing()?.image_url || 'https://via.placeholder.com/400x400?text=No+Image'}
                      alt={product.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  
                  {/* Thumbnail listings */}
                  {product.listings.length > 1 && (
                    <div className="grid grid-cols-4 gap-2">
                      {product.listings.slice(0, 4).map(listing => (
                        <button
                          key={listing.id}
                          onClick={() => setSelectedListing(listing.id)}
                          className={`aspect-square bg-gray-100 dark:bg-gray-800 rounded-md overflow-hidden border-2 transition-colors ${
                            selectedListing === listing.id
                              ? 'border-primary'
                              : 'border-transparent hover:border-gray-300'
                          }`}
                        >
                          <img
                            src={listing.image_url || 'https://via.placeholder.com/100x100?text=No+Image'}
                            alt={`${product.name} at ${listing.retailer.name}`}
                            className="w-full h-full object-contain"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="space-y-6">
                  <div>
                    <h1 className="text-2xl font-bold mb-2">{product.name}</h1>
                    
                    {product.brand && (
                      <p className="text-muted mb-2">Brand: {product.brand.name}</p>
                    )}
                    
                    {product.review_score && (
                      <div className="flex items-center gap-2 mb-4">
                        <div className="flex items-center">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <svg
                              key={i}
                              className={`w-4 h-4 ${
                                i < Math.round(product.review_score || 0)
                                  ? 'text-yellow-400 fill-current'
                                  : 'text-gray-300'
                              }`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={i < Math.round(product.review_score || 0) ? 0 : 1.5}
                                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                              />
                            </svg>
                          ))}
                        </div>
                        <span className="text-sm text-muted">
                          {product.review_score.toFixed(1)} ({product.review_count} reviews)
                        </span>
                      </div>
                    )}
                    
                    {product.description && (
                      <div>
                        <h3 className="font-medium mb-2">Description</h3>
                        <p className="text-muted">{product.description}</p>
                      </div>
                    )}
                  </div>

                  {/* Price and Actions */}
                  {getSelectedListing() && (
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <div className="text-2xl font-bold text-primary">
                            ${getSelectedListing()?.price?.toFixed(2)}
                          </div>
                          <div className="text-sm text-muted">
                            at {getSelectedListing()?.retailer.name}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            getSelectedListing()?.in_stock
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {getSelectedListing()?.in_stock ? 'In Stock' : 'Out of Stock'}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-3">
                        <a
                          href={getSelectedListing()?.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 bg-primary text-buttonText text-center py-3 rounded-lg hover:bg-opacity-90 transition-colors font-medium"
                        >
                          View at {getSelectedListing()?.retailer.name}
                        </a>
                        
                        {user && (
                          <button
                            onClick={handleAddToBasket}
                            className="flex-1 bg-secondary text-buttonText py-3 rounded-lg hover:bg-opacity-90 transition-colors font-medium"
                          >
                            Add to Basket
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Price Comparison */}
                  {product.listings.length > 1 && (
                    <div>
                      <h3 className="font-medium mb-3">Price Comparison</h3>
                      <div className="space-y-2">
                        {product.listings
                          .filter(l => l.price !== null)
                          .sort((a, b) => (a.price || 0) - (b.price || 0))
                          .map(listing => (
                            <div
                              key={listing.id}
                              className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
                                selectedListing === listing.id
                                  ? 'border-primary bg-primary/5'
                                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                              }`}
                              onClick={() => setSelectedListing(listing.id)}
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-medium">{listing.retailer.name}</span>
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                  listing.in_stock
                                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                }`}>
                                  {listing.in_stock ? 'In Stock' : 'Out of Stock'}
                                </span>
                              </div>
                              <span className="font-bold">${listing.price?.toFixed(2)}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Additional Actions */}
                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <Link
                      href={`/product/${product.slug}`}
                      className="text-primary hover:underline text-sm"
                    >
                      View full product page →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex justify-center items-center py-12">
              <p className="text-muted">Product not found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
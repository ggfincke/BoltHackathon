import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import ProductDetailOverlay from '../shared/ProductDetailOverlay';
import AddToBasketModal from '../shared/AddToBasketModal';
import { useAuth } from '~/lib/auth';
import { supabase } from '~/lib/supabaseClient';

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

interface ProductCardProps {
  product: Product;
  compact?: boolean;
  onProductAdded?: () => void;
}

export default function ProductCard({ product, compact = false, onProductAdded }: ProductCardProps) {
  const { user } = useAuth();
  const [showProductOverlay, setShowProductOverlay] = useState(false);
  const [showAddToBasketModal, setShowAddToBasketModal] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [addingToBasket, setAddingToBasket] = useState(false);

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

  const handleShowDetails = (e: React.MouseEvent) => {
    e.preventDefault();
    setShowProductOverlay(true);
  };

  const handleAddToBasket = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      setShowAddToBasketModal(true);
      return;
    }

    try {
      setAddingToBasket(true);

      // Dispatch optimistic add event FIRST (before database operation)
      console.log('ProductCard: Dispatching optimistic add event');
      const bestListing = getBestListing(product);
      window.dispatchEvent(new CustomEvent('basketUpdated', {
        detail: {
          type: 'optimisticAdd',
          productId: product.id,
          productName: product.name,
          price: bestListing?.price || null,
          retailerName: bestListing?.retailer?.name || null,
          imageUrl: bestListing?.image_url || null,
          productSlug: product.slug
        }
      }));

      // Get user's most recent basket
      const { data: basketUsers, error: basketUsersError } = await supabase
        .from('basket_users')
        .select('basket_id, role')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (basketUsersError) throw basketUsersError;

      if (!basketUsers || basketUsers.length === 0) {
        // No baskets, open modal to create one
        setShowAddToBasketModal(true);
        return;
      }

      const basketId = basketUsers[0].basket_id;
      if (!basketId) return;

      // Check if product already exists in basket
      const { data: existingItems, error: checkError } = await supabase
        .from('basket_items')
        .select('id, quantity')
        .eq('basket_id', basketId)
        .eq('product_id', product.id);

      if (checkError) throw checkError;

      // Get current price
      const { data: listings, error: listingsError } = await supabase
        .from('listings')
        .select('price')
        .eq('product_id', product.id)
        .order('price', { ascending: true })
        .limit(1);

      if (listingsError) throw listingsError;

      const currentPrice = listings?.[0]?.price || null;

      if (existingItems && existingItems.length > 0) {
        // Update existing item
        const existingItem = existingItems[0];
        const newQuantity = (existingItem.quantity ?? 0) + 1;

        const { error: updateError } = await supabase
          .from('basket_items')
          .update({
            quantity: newQuantity,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingItem.id);

        if (updateError) throw updateError;
      } else {
        // Add new item
        const { error: insertError } = await supabase
          .from('basket_items')
          .insert({
            basket_id: basketId,
            product_id: product.id,
            quantity: 1,
            price_at_add: currentPrice
          });

        if (insertError) throw insertError;
      }

      // Trigger basket update
      if (onProductAdded) {
        onProductAdded();
      }

      console.log('ProductCard: Database operation completed successfully');

    } catch (error) {
      console.error('Error adding to basket:', error);
      // On error, dispatch a regular basketUpdated event to refresh from database
      window.dispatchEvent(new CustomEvent('basketUpdated'));
    } finally {
      setAddingToBasket(false);
    }
  };

  const handleProductAdded = () => {
    setShowAddToBasketModal(false);
    if (onProductAdded) {
      onProductAdded();
    }
  };

  const bestListing = getBestListing(product);
  const imageUrl = bestListing?.image_url || 'https://via.placeholder.com/300x300?text=No+Image';
  
  return (
    <>
      <div 
        className="product-card relative group"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <Link href={`/product/${product.slug}`} className="block">
          <div className="product-image-container relative">
            <Image 
              src={imageUrl} 
              alt={product.name}
              width={300}
              height={300}
              className="w-full h-full object-contain"
            />
            
            {/* Hover Add to Basket Button */}
            {isHovered && bestListing && (
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                <button
                  onClick={handleAddToBasket}
                  disabled={addingToBasket}
                  className="px-4 py-2 rounded-full font-medium transition-colors shadow-lg hover:brightness-90 disabled:opacity-50"
                  style={{ 
                    background: 'var(--primary)', 
                    color: 'var(--dark-text)' 
                  }}
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    {addingToBasket ? 'Adding...' : 'Add to Basket'}
                  </div>
                </button>
              </div>
            )}
          </div>
        </Link>
        <div className={compact ? "p-3" : "p-4"}>
          <Link href={`/product/${product.slug}`} className="block">
            <h3 className={`font-medium ${compact ? "text-sm mb-1" : "text-lg mb-1"} line-clamp-2 hover:text-primary transition-colors`}>
              {product.name}
            </h3>
          </Link>
          
          {product.brand && (
            <p className={`${compact ? "text-xs mb-1" : "text-sm mb-2"} text-muted`}>
              {product.brand.name}
            </p>
          )}
          
          {bestListing ? (
            <div className={compact ? "mt-1" : "mt-2"}>
              <div className="flex justify-between items-center">
                <span className={`font-bold ${compact ? "text-base" : "text-lg"}`}>
                  {bestListing.price != null
                    ? `$${bestListing.price.toFixed(2)}`
                    : 'N/A'}
                </span>
                <span className={`product-retailer-badge ${compact ? "text-xs px-1.5 py-0.5" : "text-xs px-2 py-1"}`}>
                  {bestListing.retailer.name}
                </span>
              </div>
              
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleShowDetails}
                  className={`flex-1 ${compact ? "py-1.5 text-xs" : "py-2 text-sm"} rounded-md hover:opacity-90 transition-colors`}
                  style={{ 
                    background: 'var(--primary)', 
                    color: 'var(--dark-text)' 
                  }}
                >
                  Details
                </button>
                <a 
                  href={bestListing.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={`flex-1 text-center ${compact ? "py-1.5 text-xs" : "py-2 text-sm"} rounded-md hover:opacity-90 transition-colors`}
                  style={{ 
                    background: 'var(--secondary)', 
                    color: 'var(--light-text)' 
                  }}
                >
                  View Deal
                </a>
              </div>
            </div>
          ) : (
            <div className="mt-2">
              <p className={`text-secondary italic ${compact ? "text-xs" : "text-sm"}`}>
                No listings available
              </p>
              <button
                onClick={handleShowDetails}
                className={`block w-full ${compact ? "py-1.5 text-xs mt-2" : "py-2 text-sm mt-3"} rounded-md hover:opacity-90 transition-colors`}
                style={{ 
                  background: 'var(--primary)', 
                  color: 'var(--dark-text)' 
                }}
              >
                View Details
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Product Detail Overlay */}
      <ProductDetailOverlay
        productId={showProductOverlay ? product.id : null}
        isOpen={showProductOverlay}
        onClose={() => setShowProductOverlay(false)}
      />

      {/* Add to Basket Modal - only for non-authenticated users or when no baskets exist */}
      {showAddToBasketModal && (
        <AddToBasketModal
          isOpen={showAddToBasketModal}
          onClose={() => setShowAddToBasketModal(false)}
          productId={product.id}
          productName={product.name}
          onProductAdded={handleProductAdded}
        />
      )}
    </>
  );
}
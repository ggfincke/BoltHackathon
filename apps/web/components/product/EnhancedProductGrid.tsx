'use client';

import { useState } from 'react';
import { useAuth } from '~/lib/auth';
import { supabase } from '~/lib/supabaseClient';
import ProductDetailOverlay from '../shared/ProductDetailOverlay';
import AddToBasketModal from '../shared/AddToBasketModal';

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
    retailer: { 
      id: string;
      name: string;
    };
  }[];
};

interface EnhancedProductGridProps {
  products: Product[];
  emptyMessage?: string;
  onProductAdded?: () => void;
}

export default function EnhancedProductGrid({ 
  products, 
  emptyMessage = "No products found",
  onProductAdded 
}: EnhancedProductGridProps) {
  const { user } = useAuth();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [isAddToBasketModalOpen, setIsAddToBasketModalOpen] = useState(false);
  const [productToAdd, setProductToAdd] = useState<string | null>(null);
  const [addingProducts, setAddingProducts] = useState<Set<string>>(new Set());

  const getBestListing = (product: Product) => {
    if (!product.listings?.length) return null;

    const validListings = product.listings.filter(
      (l) => typeof l.price === 'number' && !Number.isNaN(l.price)
    );

    if (validListings.length === 0) return null;

    const inStockListings = validListings.filter((l) => l.in_stock);

    if (inStockListings.length > 0) {
      return inStockListings.reduce(
        (best, current) => (current.price! < best.price! ? current : best),
        inStockListings[0]
      );
    }

    return validListings.reduce(
      (best, current) => (current.price! < best.price! ? current : best),
      validListings[0]
    );
  };

  const getBestImage = (product: Product) => {
    if (!product.listings?.length) return 'https://via.placeholder.com/300x300?text=No+Image';

    // Sort listings by retailer ID (1 = Amazon, 2 = Target, 3 = Walmart)
    // Lower retailer ID = higher precedence
    const listingsWithImages = product.listings
      .filter(listing => listing.image_url)
      .sort((a, b) => {
        const aRetailerId = parseInt(a.retailer.id) || 999;
        const bRetailerId = parseInt(b.retailer.id) || 999;
        return aRetailerId - bRetailerId;
      });

    if (listingsWithImages.length > 0) {
      return listingsWithImages[0].image_url!;
    }

    return 'https://via.placeholder.com/300x300?text=No+Image';
  };

  const handleProductClick = (productId: string, e: React.MouseEvent) => {
    // Prevent overlay from opening when clicking the add button
    if ((e.target as HTMLElement).closest('.add-to-basket-btn')) {
      return;
    }
    
    setSelectedProductId(productId);
    setIsOverlayOpen(true);
  };

  const handleAddToBasket = async (productId: string) => {
    if (!user) {
      setProductToAdd(productId);
      setIsAddToBasketModalOpen(true);
      return;
    }

    try {
      setAddingProducts(prev => new Set(prev).add(productId));

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
        setProductToAdd(productId);
        setIsAddToBasketModalOpen(true);
        return;
      }

      const basketId = basketUsers[0].basket_id;
      if (!basketId) return;

      // Check if product already exists in basket
      const { data: existingItems, error: checkError } = await supabase
        .from('basket_items')
        .select('id, quantity')
        .eq('basket_id', basketId)
        .eq('product_id', productId);

      if (checkError) throw checkError;

      // Get current price
      const { data: listings, error: listingsError } = await supabase
        .from('listings')
        .select('price')
        .eq('product_id', productId)
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
            product_id: productId,
            quantity: 1,
            price_at_add: currentPrice
          });

        if (insertError) throw insertError;
      }

      // Trigger basket update
      if (onProductAdded) {
        onProductAdded();
      }

      // Dispatch custom event for sidebar to listen to
      window.dispatchEvent(new CustomEvent('basketUpdated'));

      // Show success feedback
      const productElement = document.querySelector(`[data-product-id="${productId}"]`);
      if (productElement) {
        const addButton = productElement.querySelector('.add-to-basket-btn');
        if (addButton) {
          addButton.textContent = 'Added!';
          setTimeout(() => {
            addButton.textContent = 'Add';
          }, 2000);
        }
      }

    } catch (error) {
      console.error('Error adding to basket:', error);
    } finally {
      setAddingProducts(prev => {
        const newSet = new Set(prev);
        newSet.delete(productId);
        return newSet;
      });
    }
  };

  const handleOverlayAddToBasket = (productId: string) => {
    setIsOverlayOpen(false);
    handleAddToBasket(productId);
  };

  if (products.length === 0) {
    return (
      <div className="bg-surface p-8 rounded-lg shadow-sm text-center">
        <h2 className="text-xl font-semibold mb-2">{emptyMessage}</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Try browsing other categories or using the search.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {products.map((product) => {
          const bestListing = getBestListing(product);
          const imageUrl = getBestImage(product);
          const isAdding = addingProducts.has(product.id);
          
          return (
            <div 
              key={product.id} 
              data-product-id={product.id}
              className="bg-surface rounded-lg shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:scale-[1.02] cursor-pointer relative group"
              onClick={(e) => handleProductClick(product.id, e)}
            >
              {/* Product Image */}
              <div className="aspect-square overflow-hidden bg-gray-100 dark:bg-gray-800 relative">
                <img 
                  src={imageUrl} 
                  alt={product.name}
                  className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-105"
                />
                
                {/* Add to Basket Button Overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddToBasket(product.id);
                    }}
                    disabled={isAdding}
                    className="add-to-basket-btn opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-200 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-full font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isAdding ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Adding...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Add
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Product Info */}
              <div className="p-4">
                <h3 className="font-medium text-lg mb-1 line-clamp-2 hover:text-primary transition-colors">
                  {product.name}
                </h3>
                
                {product.brand && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {product.brand.name}
                  </p>
                )}
                
                {bestListing ? (
                  <div className="mt-2">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-lg text-primary">
                        {bestListing.price != null
                          ? `$${bestListing.price.toFixed(2)}`
                          : 'N/A'}
                      </span>
                      <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-2 py-1 rounded font-medium">
                        {bestListing.retailer.name}
                      </span>
                    </div>
                    
                    <div className={`text-xs px-2 py-1 rounded-full text-center font-medium ${
                      bestListing.in_stock
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                    }`}>
                      {bestListing.in_stock ? 'In Stock' : 'Out of Stock'}
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

      {/* Product Detail Overlay */}
      <ProductDetailOverlay
        productId={selectedProductId}
        isOpen={isOverlayOpen}
        onClose={() => setIsOverlayOpen(false)}
        onAddToBasket={handleOverlayAddToBasket}
      />

      {/* Add to Basket Modal */}
      <AddToBasketModal
        isOpen={isAddToBasketModalOpen}
        onClose={() => setIsAddToBasketModalOpen(false)}
        productId={productToAdd || ''}
        productName={products.find(p => p.id === productToAdd)?.name || ''}
      />
    </>
  );
}
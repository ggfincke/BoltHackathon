import React from 'react';

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

interface ProductCardProps {
  product: Product;
  compact?: boolean;
}

export default function ProductCard({ product, compact = false }: ProductCardProps) {
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

  const bestListing = getBestListing(product);
  const imageUrl = bestListing?.image_url || 'https://via.placeholder.com/300x300?text=No+Image';
  
  return (
    <div className="bg-surface rounded-lg shadow-sm overflow-hidden transition-transform hover:scale-[1.02]">
      <div className="aspect-square overflow-hidden bg-gray-100 dark:bg-gray-800">
        <img 
          src={imageUrl} 
          alt={product.name}
          className="w-full h-full object-contain"
        />
      </div>
      <div className={compact ? "p-3" : "p-4"}>
        <h3 className={`font-medium ${compact ? "text-sm mb-1" : "text-lg mb-1"} line-clamp-2`}>
          {product.name}
        </h3>
        
        {product.brand && (
          <p className={`${compact ? "text-xs mb-1" : "text-sm mb-2"} text-gray-600 dark:text-gray-400`}>
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
              <span className={`text-xs bg-gray-200 dark:bg-gray-700 ${compact ? "px-1.5 py-0.5" : "px-2 py-1"} rounded`}>
                {bestListing.retailer.name}
              </span>
            </div>
            
            <div className={compact ? "mt-2" : "mt-3"}>
              <a 
                href={bestListing.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className={`block w-full bg-primary text-buttonText text-center ${compact ? "py-1.5 text-sm" : "py-2"} rounded-md hover:bg-opacity-90 transition-colors`}
              >
                View Deal
              </a>
            </div>
          </div>
        ) : (
          <p className={`text-gray-500 dark:text-gray-400 italic ${compact ? "mt-1 text-xs" : "mt-2"}`}>
            No listings available
          </p>
        )}
      </div>
    </div>
  );
}
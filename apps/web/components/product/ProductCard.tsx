import React from 'react';
import Link from 'next/link';
import Image from 'next/image';

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
    <div className="product-card">
      <Link href={`/product/${product.slug}`} className="block">
        <div className="product-image-container">
          <Image 
            src={imageUrl} 
            alt={product.name}
            width={300}
            height={300}
            className="w-full h-full object-contain"
          />
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
              <Link 
                href={`/product/${product.slug}`}
                className={`flex-1 product-button ${compact ? "compact" : ""}`}
              >
                Details
              </Link>
              <a 
                href={bestListing.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className={`flex-1 bg-primary text-buttonText text-center ${compact ? "py-1.5 text-xs" : "py-2 text-sm"} rounded-md hover:bg-opacity-90 transition-colors`}
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
            <Link 
              href={`/product/${product.slug}`}
              className={`block w-full product-button ${compact ? "compact mt-2" : "mt-3"}`}
            >
              View Details
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
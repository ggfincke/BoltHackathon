import Link from 'next/link';
import { Database } from '~/lib/database.types';

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

interface ProductGridProps {
  products: Product[];
  emptyMessage?: string;
}

export default function ProductGrid({ products, emptyMessage = "No products found" }: ProductGridProps) {
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

  if (products.length === 0) {
    return (
      <div className="bg-surface p-8 rounded-lg shadow-sm text-center">
        <h2 className="text-xl font-semibold mb-2">{emptyMessage}</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Try browsing other categories or using the search.
        </p>
        <Link 
          href="/categories"
          className="inline-block bg-primary text-buttonText px-4 py-2 rounded-md hover:bg-opacity-90 transition-colors"
        >
          Browse Categories
        </Link>
      </div>
    );
  }

  return (
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
  );
}
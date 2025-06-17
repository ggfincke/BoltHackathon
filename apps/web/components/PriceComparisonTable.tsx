import React from 'react';

type Listing = {
  id: string;
  retailer_id: string;
  price: number | null;
  original_price: number | null;
  currency: string;
  in_stock: boolean;
  availability_status: string | null;
  url: string;
  image_url: string | null;
  retailer: {
    id: string;
    name: string;
  };
};

interface PriceComparisonTableProps {
  listings: Listing[];
}

export default function PriceComparisonTable({ listings }: PriceComparisonTableProps) {
  // Sort listings by price (lowest first), then by in_stock (in stock first)
  const sortedListings = [...listings].sort((a, b) => {
    // In stock items first
    if (a.in_stock && !b.in_stock) return -1;
    if (!a.in_stock && b.in_stock) return 1;
    
    // Then by price (null prices last)
    if (a.price === null && b.price !== null) return 1;
    if (a.price !== null && b.price === null) return -1;
    if (a.price !== null && b.price !== null) return a.price - b.price;
    
    // If both prices are null, sort by retailer name
    return a.retailer.name.localeCompare(b.retailer.name);
  });

  if (listings.length === 0) {
    return (
      <div className="bg-surface p-6 rounded-lg shadow-sm text-center">
        <p className="text-gray-600 dark:text-gray-400">
          No listings available for this product.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-800">
              <th className="px-4 py-3 text-left text-sm font-semibold">Retailer</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Price</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">Availability</th>
              <th className="px-4 py-3 text-right text-sm font-semibold"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {sortedListings.map((listing) => (
              <tr 
                key={listing.id} 
                className={`hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                  listing.in_stock ? '' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center">
                    {listing.retailer.name}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">
                  {listing.price !== null ? (
                    <div>
                      <span className="font-medium">${listing.price.toFixed(2)}</span>
                      {listing.original_price && listing.original_price > listing.price && (
                        <span className="ml-2 text-gray-500 line-through text-xs">
                          ${listing.original_price.toFixed(2)}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-500">Not available</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    listing.in_stock 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  }`}>
                    {listing.in_stock ? 'In Stock' : 'Out of Stock'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  <a
                    href={listing.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-block px-3 py-1 rounded-md text-xs font-medium ${
                      listing.in_stock
                        ? 'bg-primary text-buttonText hover:bg-opacity-90'
                        : 'bg-gray-300 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-opacity-90'
                    } transition-colors`}
                  >
                    View Deal
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
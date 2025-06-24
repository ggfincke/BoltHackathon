import React from 'react';

interface Listing {
  id: string;
  price: number | null;
  currency: string;
  in_stock: boolean;
  url: string;
  retailer: {
    name: string;
    logo_url?: string | null;
  };
}

interface PriceComparisonTableProps {
  listings: Listing[];
  productName: string;
}

export default function PriceComparisonTable({ listings, productName }: PriceComparisonTableProps) {
  if (!listings || listings.length === 0) {
    return (
      <div className="bg-surface rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Price Comparison</h3>
        <p className="text-muted">
          No price listings available for this product yet.
        </p>
      </div>
    );
  }

  // Sort listings by price (in stock first, then by price)
  const sortedListings = [...listings].sort((a, b) => {
    // Prioritize in-stock items
    if (a.in_stock && !b.in_stock) return -1;
    if (!a.in_stock && b.in_stock) return 1;
    
    // Then sort by price
    if (a.price === null && b.price === null) return 0;
    if (a.price === null) return 1;
    if (b.price === null) return -1;
    return a.price - b.price;
  });

  return (
    <div className="bg-surface rounded-lg overflow-hidden">
      <div className="p-6">
        <h3 className="text-lg font-semibold mb-4">Price Comparison</h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="table-header">
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Retailer</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Price</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Stock</th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y table-divider">
            {sortedListings.map((listing) => (
              <tr 
                key={listing.id} 
                className={`table-row ${
                  listing.in_stock ? '' : 'text-secondary'
                }`}
              >
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    {listing.retailer.logo_url && (
                      <img 
                        src={listing.retailer.logo_url} 
                        alt={listing.retailer.name}
                        className="h-8 w-8 rounded mr-3 object-contain"
                      />
                    )}
                    <div className="text-sm font-medium">
                      {listing.retailer.name}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-semibold">
                    {listing.price !== null ? `$${listing.price.toFixed(2)}` : 'N/A'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full status-badge ${
                    listing.in_stock 
                      ? 'success'
                      : 'error'
                  }`}>
                    {listing.in_stock ? 'In Stock' : 'Out of Stock'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <a
                    href={listing.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      listing.in_stock && listing.price !== null
                        ? 'bg-primary text-buttonText hover:bg-opacity-90'
                        : 'bg-secondary text-text hover:bg-opacity-90'
                    }`}
                  >
                    {listing.in_stock && listing.price !== null ? 'Buy Now' : 'View Page'}
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
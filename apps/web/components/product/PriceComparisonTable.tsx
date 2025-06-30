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
}

export default function PriceComparisonTable({ listings }: PriceComparisonTableProps) {
  if (!listings || listings.length === 0) {
    return (
      <div className="p-8 text-center">
        <svg className="w-16 h-16 mx-auto mb-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 009.586 13H7" />
        </svg>
        <h3 className="text-lg font-semibold mb-2 text-secondary">No Price Data Available</h3>
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
    <div className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead style={{ background: 'var(--bg-tertiary)' }}>
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-secondary border-b border-primary">
                Retailer
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-secondary border-b border-primary">
                Price
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-secondary border-b border-primary">
                Stock
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-secondary border-b border-primary">
                Action
              </th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ background: 'var(--background)' }}>
            {sortedListings.map((listing, index) => (
              <tr 
                key={listing.id} 
                className={`table-row transition-colors ${
                  listing.in_stock ? 'hover:bg-hover' : 'opacity-75'
                } ${index === 0 && listing.in_stock ? 'bg-success-bg border-l-4 border-l-primary' : ''}`}
              >
                <td className="px-6 py-5 whitespace-nowrap">
                  <div className="flex items-center">
                    {listing.retailer.logo_url && (
                      <div className="flex-shrink-0 h-10 w-10 mr-4">
                        <img 
                          src={listing.retailer.logo_url} 
                          alt={listing.retailer.name}
                          className="h-10 w-10 rounded-lg object-contain bg-white p-1 shadow-sm"
                        />
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-semibold text-secondary">
                        {listing.retailer.name}
                      </div>
                      {index === 0 && listing.in_stock && (
                        <div className="text-xs font-medium" style={{ color: 'var(--primary)' }}>
                          Best Deal
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-5 whitespace-nowrap">
                  <div className={`text-lg font-bold ${listing.price !== null ? '' : 'text-muted'}`}>
                    {listing.price !== null ? (
                      <span style={{ color: index === 0 && listing.in_stock ? 'var(--primary)' : 'inherit' }}>
                        ${listing.price.toFixed(2)}
                      </span>
                    ) : (
                      'N/A'
                    )}
                  </div>
                </td>
                <td className="px-6 py-5 whitespace-nowrap">
                  <span className={`status-badge ${listing.in_stock ? 'success' : 'error'}`}>
                    {listing.in_stock ? 'In Stock' : 'Out of Stock'}
                  </span>
                </td>
                <td className="px-6 py-5 whitespace-nowrap">
                  <a
                    href={listing.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`btn-base px-4 py-2 rounded-lg text-sm font-semibold transition-all hover-lift inline-flex items-center space-x-2 ${
                      !listing.in_stock || listing.price === null ? 'opacity-75' : ''
                    }`}
                    style={{ 
                      background: listing.in_stock && listing.price !== null 
                        ? 'var(--primary)' 
                        : 'var(--secondary)',
                      color: listing.in_stock && listing.price !== null 
                        ? 'var(--dark-text)' 
                        : 'var(--light-text)'
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    <span>{listing.in_stock && listing.price !== null ? 'Buy Now' : 'View Page'}</span>
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
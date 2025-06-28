'use client';

import { useState } from 'react';
import Link from 'next/link';

type BasketItem = {
  id: string;
  basket_id: string;
  product_id: string;
  quantity: number;
  price_at_add: number | null;
  added_at: string;
  updated_at: string;
  notes: string | null;
  product: {
    id: string;
    name: string;
    slug: string;
    image_url?: string | null;
    brand?: {
      name: string;
    } | null;
    listings?: {
      id: string;
      price: number | null;
      currency: string | null;
      in_stock: boolean | null;
      url: string;
      retailer: {
        name: string;
      };
    }[];
  };
};

interface BasketItemsTableProps {
  items: BasketItem[];
  canEdit: boolean;
  onUpdateItem: (itemId: string, updates: { quantity?: number; notes?: string }) => void;
  onRemoveItem: (itemId: string) => void;
}

export default function BasketItemsTable({ items, canEdit, onUpdateItem, onRemoveItem }: BasketItemsTableProps) {
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingQuantity, setEditingQuantity] = useState<number>(1);
  const [editingNotes, setEditingNotes] = useState<string>('');
  
  const startEditing = (item: BasketItem) => {
    setEditingItemId(item.id);
    setEditingQuantity(item.quantity);
    setEditingNotes(item.notes || '');
  };
  
  const saveEdits = () => {
    if (editingItemId) {
      onUpdateItem(editingItemId, {
        quantity: editingQuantity,
        notes: editingNotes
      });
      setEditingItemId(null);
    }
  };
  
  const cancelEdits = () => {
    setEditingItemId(null);
  };
  
  const getBestPrice = (item: BasketItem) => {
    if (!item.product.listings || item.product.listings.length === 0) {
      return item.price_at_add;
    }
    
    // Find the lowest price from available listings
    const validPrices = item.product.listings
      .filter(listing => listing.price !== null)
      .map(listing => listing.price as number);
    
    if (validPrices.length === 0) {
      return item.price_at_add;
    }
    
    return Math.min(...validPrices);
  };
  
  const getItemTotal = (item: BasketItem) => {
    const price = getBestPrice(item) || 0;
    return price * item.quantity;
  };
  
  const getBestRetailer = (item: BasketItem) => {
    if (!item.product.listings || item.product.listings.length === 0) {
      return null;
    }
    
    // Find the listing with the lowest price
    const validListings = item.product.listings.filter(listing => listing.price !== null);
    
    if (validListings.length === 0) {
      return null;
    }
    
    const bestListing = validListings.reduce(
      (best, current) => (current.price! < best.price! ? current : best),
      validListings[0]
    );
    
    return bestListing.retailer.name;
  };
  
  if (items.length === 0) {
    return (
      <div className="empty-state">
        <h2 className="text-xl font-semibold mb-2">No items in this basket</h2>
        <p className="text-muted mb-4">
          Start adding products to your basket to track prices and availability.
        </p>
        <Link
          href="/categories"
          className="product-button inline-block"
        >
          Browse Products
        </Link>
      </div>
    );
  }
  
  return (
    <div style={{ background: 'var(--surface)' }} className="rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="table-header">
              <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: 'var(--text)' }}>Product</th>
              <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: 'var(--text)' }}>Best Price</th>
              <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: 'var(--text)' }}>Quantity</th>
              <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: 'var(--text)' }}>Total</th>
              <th className="px-4 py-3 text-left text-sm font-semibold" style={{ color: 'var(--text)' }}>Notes</th>
              <th className="px-4 py-3 text-right text-sm font-semibold" style={{ color: 'var(--text)' }}>Actions</th>
            </tr>
          </thead>
          <tbody className="table-divider">
            {items.map((item) => (
              <tr key={item.id} className="table-row">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {/* Product Image */}
                    <div className="product-image-container w-12 h-12 flex-shrink-0">
                      {item.product.image_url ? (
                        <img
                          src={item.product.image_url}
                          alt={item.product.name}
                          className="w-full h-full object-cover rounded"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            target.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      {/* Fallback placeholder */}
                      <div 
                        className={`w-full h-full rounded flex items-center justify-center text-xs font-medium ${item.product.image_url ? 'hidden' : ''}`}
                        style={{ 
                          background: 'var(--bg-muted)', 
                          color: 'var(--text-muted)' 
                        }}
                      >
                        {item.product.name.charAt(0).toUpperCase()}
                      </div>
                    </div>
                    
                    {/* Product Details */}
                    <div className="flex-1 min-w-0">
                      <Link 
                        href={`/product/${item.product.slug}`}
                        className="font-medium transition-colors line-clamp-2"
                        style={{ color: 'var(--text)' }}
                        onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text)'}
                      >
                        {item.product.name}
                      </Link>
                      {item.product.brand && (
                        <div className="text-xs text-secondary mt-1">
                          {item.product.brand.name}
                        </div>
                      )}
                      {getBestRetailer(item) && (
                        <div className="product-retailer-badge inline-block mt-1">
                          Best at: {getBestRetailer(item)}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {getBestPrice(item) !== null ? (
                    <span className="font-medium" style={{ color: 'var(--text)' }}>
                      ${getBestPrice(item)?.toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-muted">N/A</span>
                  )}
                  {item.price_at_add !== null && getBestPrice(item) !== item.price_at_add && (
                    <div className="text-xs text-secondary mt-1">
                      Added at: ${item.price_at_add?.toFixed(2)}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  {editingItemId === item.id ? (
                    <input
                      type="number"
                      min="1"
                      value={editingQuantity}
                      onChange={(e) => setEditingQuantity(parseInt(e.target.value) || 1)}
                      className="form-input w-16 p-1 text-sm"
                    />
                  ) : (
                    <span style={{ color: 'var(--text)' }}>{item.quantity}</span>
                  )}
                </td>
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--text)' }}>
                  ${getItemTotal(item).toFixed(2)}
                </td>
                <td className="px-4 py-3">
                  {editingItemId === item.id ? (
                    <input
                      type="text"
                      value={editingNotes}
                      onChange={(e) => setEditingNotes(e.target.value)}
                      className="form-input w-full p-1 text-sm"
                      placeholder="Add notes..."
                    />
                  ) : (
                    <span className="text-sm text-secondary truncate-tooltip" 
                          data-tooltip={item.notes}
                          style={{ maxWidth: '150px', display: 'inline-block' }}>
                      {item.notes || '-'}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {editingItemId === item.id ? (
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={saveEdits}
                        className="modal-button p-2 rounded transition-all hover-lift"
                        style={{ color: 'var(--success-text)' }}
                        title="Save"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                      <button
                        onClick={cancelEdits}
                        className="modal-button p-2 rounded transition-all hover-lift"
                        style={{ color: 'var(--text-muted)' }}
                        title="Cancel"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-end space-x-2">
                      {canEdit && (
                        <>
                          <button
                            onClick={() => startEditing(item)}
                            className="modal-button p-2 rounded transition-all hover-lift"
                            style={{ color: 'var(--primary)' }}
                            title="Edit"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => onRemoveItem(item.id)}
                            className="modal-button danger p-2 rounded transition-all hover-lift"
                            title="Remove"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </>
                      )}
                      <Link
                        href={`/product/${item.product.slug}`}
                        className="modal-button p-2 rounded transition-all hover-lift"
                        style={{ color: 'var(--text-muted)' }}
                        title="View Product"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </Link>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '~/lib/supabaseClient';

interface ProductAlternative {
  product_id: string;
  product_name: string;
  brand?: string;
  price?: number;
  retailer?: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
  image_url?: string;
  similarity_score: number;
}

interface AIAlternativesOverlayProps {
  productId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onReplaceProduct?: (alternativeProductId: string) => void;
}

export default function AIAlternativesOverlay({ 
  productId, 
  isOpen, 
  onClose,
  onReplaceProduct 
}: AIAlternativesOverlayProps) {
  const [alternatives, setAlternatives] = useState<ProductAlternative[]>([]);
  const [originalProduct, setOriginalProduct] = useState<{ id: string; name: string; brand?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && productId) {
      // Clear previous state immediately to avoid showing stale data
      setAlternatives([]);
      setOriginalProduct(null);
      setError(null);
      fetchAlternatives();
    }
  }, [isOpen, productId]);

  const fetchAlternatives = async () => {
    if (!productId) return;

    setIsLoading(true);
    setError(null);
    
    try {
      // Call the AI alternatives edge function
      const { data, error: functionError } = await supabase.functions.invoke('ai-alternatives', {
        body: { product_id: productId }
      });

      if (functionError) {
        throw functionError;
      }

      setAlternatives(data.alternatives || []);
      setOriginalProduct(data.original_product);
    } catch (err: unknown) {
      console.error('Error fetching alternatives:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch alternatives');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReplaceProduct = (alternativeProductId: string) => {
    if (onReplaceProduct) {
      onReplaceProduct(alternativeProductId);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="product-overlay" onClick={onClose}>
      <div className="product-overlay-content" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b" style={{ borderBottomColor: 'var(--surface)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: 'linear-gradient(135deg, var(--primary), var(--secondary))' }}>
              <svg className="w-6 h-6" style={{ color: 'var(--dark-text)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-semibold" style={{ color: 'var(--text)' }}>
                Alternatives
              </h2>
              {originalProduct && (
                                 <p className="text-sm text-muted">
                   Alternatives for &quot;{originalProduct.name}&quot;
                 </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="modal-button p-2 rounded transition-all hover-lift"
            style={{ color: 'var(--text-muted)' }}
            title="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(98vh - 140px)' }}>
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="loading-shimmer w-12 h-12 rounded-full mb-4"></div>
              <p className="text-muted">Finding alternatives...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-500 mb-2">Error</div>
              <p className="text-muted">{error}</p>
              <button
                onClick={fetchAlternatives}
                className="mt-4 btn-base px-4 py-2 rounded-lg"
                style={{ background: 'var(--primary)', color: 'var(--dark-text)' }}
              >
                Try Again
              </button>
            </div>
          ) : alternatives.length === 0 ? (
            <div className="text-center py-12">
                             <div className="text-muted mb-2">No alternatives found</div>
               <p className="text-sm text-muted">
                 We couldn&apos;t find any suitable alternatives for this product.
               </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-muted mb-4">
                Found {alternatives.length} AI-recommended alternative{alternatives.length !== 1 ? 's' : ''}
              </div>
              
                             {alternatives.map((alternative) => (
                <div
                  key={alternative.product_id}
                  className="chat-result-item border rounded-lg p-4 hover:border-primary transition-all min-h-[160px] flex flex-col"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border-primary)' }}
                >
                  <div className="flex gap-4 flex-1">
                    {/* Product Image */}
                    <div className="w-16 h-16 flex-shrink-0">
                      {alternative.image_url ? (
                        <img
                          src={alternative.image_url}
                          alt={alternative.product_name}
                          className="w-full h-full object-cover rounded"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                            target.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div 
                        className={`w-full h-full rounded flex items-center justify-center text-xs font-medium ${alternative.image_url ? 'hidden' : ''}`}
                        style={{ 
                          background: 'var(--bg-muted)', 
                          color: 'var(--text-muted)' 
                        }}
                      >
                        {alternative.product_name.charAt(0).toUpperCase()}
                      </div>
                    </div>

                    {/* Product Details */}
                    <div className="flex-1 min-w-0 flex flex-col">
                      {/* Product Name - Fixed height section */}
                      <div className="mb-2 h-12 flex items-start">
                        <h3 className="font-semibold line-clamp-2 text-sm leading-tight" style={{ color: 'var(--text)' }}>
                          {alternative.product_name}
                        </h3>
                      </div>

                      {/* Brand - Fixed height section */}
                      <div className="h-5 mb-2">
                        {alternative.brand && (
                          <p className="text-xs text-secondary truncate">
                            {alternative.brand}
                          </p>
                        )}
                      </div>

                      {/* Price and Retailer - Fixed height section */}
                      <div className="h-6 mb-3 flex items-center">
                        {alternative.price !== undefined && (
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-semibold text-base flex-shrink-0" style={{ color: 'var(--primary)' }}>
                              ${alternative.price.toFixed(2)}
                            </span>
                            {alternative.retailer && (
                              <span className="product-retailer-badge text-xs truncate">
                                at {alternative.retailer}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Reason - Flexible height but controlled */}
                      <div className="flex-1 mb-3">
                        <p className="text-xs text-muted line-clamp-3">
                          {alternative.reason}
                        </p>
                      </div>

                      {/* Button - Fixed position at bottom */}
                      <div className="flex items-center justify-end mt-auto">
                        {onReplaceProduct && (
                          <button
                            onClick={() => handleReplaceProduct(alternative.product_id)}
                            className="btn-base px-3 py-1.5 text-xs rounded-lg hover-lift flex-shrink-0"
                            style={{ background: 'var(--secondary)', color: 'var(--light-text)' }}
                          >
                            Replace Product
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 
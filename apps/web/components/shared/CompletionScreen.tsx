import React, { useRef, useState } from 'react';
import Popover from '~/components/ui/Popover';

interface ProductMatch {
  ingredient: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit?: string;
  confidence: 'high' | 'medium' | 'low';
  price: number;
  retailer: string;
  image_url?: string;
  alternatives?: ProductAlternative[];
}

interface ProductAlternative {
  product_id: string;
  product_name: string;
  price: number;
  retailer: string;
  image_url?: string;
}

interface ChatToBasketResponse {
  basket_id: string;
  matches: ProductMatch[];
  unmatched: string[];
  summary: string;
}

interface CompletionScreenProps {
  result: ChatToBasketResponse;
  matches: ProductMatch[];
  isUpdating: boolean;
  openAlternatives: string | null;
  onSetOpenAlternatives: (value: string | null) => void;
  onSwitchToAlternative: (matchIndex: number, alternative: ProductAlternative) => void;
  onUpdateQuantity: (matchIndex: number, newQuantity: number) => void;
  onDeleteProduct: (matchIndex: number) => void;
  onViewBasket: () => void;
  onReset: () => void;
}

const CompletionScreen: React.FC<CompletionScreenProps> = ({
  result,
  matches,
  isUpdating,
  openAlternatives,
  onSetOpenAlternatives,
  onSwitchToAlternative,
  onUpdateQuantity,
  onDeleteProduct,
  onViewBasket,
  onReset,
}) => {
  const totalItems = matches.reduce((sum, match) => sum + match.quantity, 0);
  const totalPrice = matches.reduce((sum, match) => sum + ((match.price || 0) * match.quantity), 0);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleQuantityChange = (matchIndex: number, newQuantity: number) => {
    if (newQuantity <= 0) {
      onDeleteProduct(matchIndex);
    } else {
      onUpdateQuantity(matchIndex, newQuantity);
    }
  };

  return (
    <div className={`space-y-6 chat-state-transition ${isUpdating ? 'updating-alternative' : ''}`}>
      {/* Success Header */}
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-text">Basket Created!</h2>
          <p className="text-muted">{result.summary}</p>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="completion-card">
          <div className="completion-section-title">Total Items</div>
          <div className="text-2xl font-bold text-primary">{totalItems}</div>
        </div>
        <div className="completion-card">
          <div className="completion-section-title">Estimated Total</div>
          <div className="text-2xl font-bold text-primary">${totalPrice.toFixed(2)}</div>
        </div>
        <div className="completion-card">
          <div className="completion-section-title">Matched</div>
          <div className="text-2xl font-bold text-green-600">{matches.length}</div>
        </div>
      </div>

      {/* Product Grid */}
      <div>
        <h3 className="completion-section-title mb-4">Products in Your Basket</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {matches.map((match, index) => (
            <div key={match.product_id} className="completion-card relative overflow-visible">
              <div className="completion-product-image">
                {match.image_url && match.image_url.trim() !== '' ? (
                  <img 
                    src={match.image_url} 
                    alt={match.product_name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                ) : null}
                <div className={`w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center ${match.image_url && match.image_url.trim() !== '' ? 'hidden' : ''}`}>
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="completion-product-title flex-1 pr-2" title={match.product_name}>
                    {match.product_name}
                  </h4>
                  <div className="flex items-center space-x-2">
                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => onDeleteProduct(index)}
                      className="p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                      title="Remove from basket"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    {/* Alternatives Dropdown */}
                    {match.alternatives && match.alternatives.length > 0 && (
                      <div className="relative">
                        <button
                          type="button"
                          onClick={(e) => {
                            const id = `completion-${index}`;
                            if (openAlternatives === id) {
                              onSetOpenAlternatives(null);
                              setAnchorEl(null);
                            } else {
                              onSetOpenAlternatives(id);
                              setAnchorEl(e.currentTarget as HTMLElement);
                            }
                          }}
                          className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
                          title={`${match.alternatives.length} alternatives available`}
                          data-dropdown-trigger
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                          </svg>
                        </button>
                        {openAlternatives === `completion-${index}` && anchorEl && (
                          <Popover anchor={anchorEl} onClose={() => { onSetOpenAlternatives(null); setAnchorEl(null); }}>
                            <div className="chat-alternatives-dropdown" data-dropdown>
                              <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                                <h5 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                  Alternative Options ({match.alternatives.length})
                                </h5>
                              </div>
                              {match.alternatives.map((alt, altIndex) => (
                                <div
                                  key={`completion-${alt.product_id}-${altIndex}`}
                                  className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-600 last:border-b-0"
                                  onClick={() => {
                                    onSwitchToAlternative(index, alt);
                                    onSetOpenAlternatives(null);
                                    setAnchorEl(null);
                                  }}
                                >
                                  <div className="flex space-x-3">
                                    <div className="w-12 h-12 flex-shrink-0 bg-gray-100 dark:bg-gray-600 rounded overflow-hidden">
                                      {alt.image_url && alt.image_url.trim() !== '' ? (
                                        <img
                                          src={alt.image_url}
                                          alt={alt.product_name || 'Product image'}
                                          className="w-full h-full object-cover"
                                          onError={(e) => {
                                            const t = e.target as HTMLImageElement;
                                            t.style.display = 'none';
                                            t.nextElementSibling?.classList.remove('hidden');
                                          }}
                                        />
                                      ) : null}
                                      <div className={`w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center ${alt.image_url && alt.image_url.trim() !== '' ? 'hidden' : ''}`}>
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                      </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h6 className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                        {alt.product_name || 'Unknown product'}
                                      </h6>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {alt.retailer || 'Unknown retailer'}
                                      </p>
                                      <p className="text-sm font-semibold text-green-600 dark:text-green-400 mt-1">
                                        ${(alt.price ?? 0).toFixed(2)}
                                      </p>
                                    </div>
                                    <div className="flex items-center">
                                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </Popover>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="completion-product-retailer">{match.retailer}</div>
                <div className="flex items-center justify-between mt-2">
                  <div className="completion-product-price">${(match.price || 0).toFixed(2)}</div>
                  {/* Quantity Controls */}
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(index, match.quantity - 1)}
                      className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                      disabled={match.quantity <= 1}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={match.quantity}
                      onChange={(e) => {
                        const newQuantity = parseInt(e.target.value) || 1;
                        handleQuantityChange(index, newQuantity);
                      }}
                      className="w-12 h-6 text-center text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    />
                    <button
                      type="button"
                      onClick={() => handleQuantityChange(index, match.quantity + 1)}
                      className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {/* Alternatives Indicator */}
                {match.alternatives && match.alternatives.length > 0 && (
                  <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">
                    {match.alternatives.length} alternative{match.alternatives.length !== 1 ? 's' : ''} available
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Unmatched Items */}
      {result.unmatched && result.unmatched.length > 0 && (
        <div className="completion-card">
          <h3 className="completion-section-title mb-3">Items We Couldn't Match</h3>
          <div className="space-y-2">
            {result.unmatched.map((item, index) => (
              <div key={index} className="flex items-center justify-between py-2 px-3 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                <span className="text-sm">{item}</span>
                <span className="text-xs text-muted">You can add these manually</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button
          onClick={onViewBasket}
          className="btn-base px-8 py-3 text-lg rounded-lg flex items-center justify-center space-x-2"
          style={{ background: 'var(--secondary)', color: 'var(--light-text)' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          <span>View Basket</span>
        </button>
        <button
          onClick={onReset}
          className="btn-base px-8 py-3 text-lg rounded-lg flex items-center justify-center space-x-2"
          style={{ background: 'var(--primary)', color: 'var(--dark-text)' }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          <span>Create Another</span>
        </button>
      </div>
    </div>
  );
};

export default React.memo(CompletionScreen); 
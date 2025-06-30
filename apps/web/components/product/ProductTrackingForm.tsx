import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ProductTrackingFormProps {
  isTracking: boolean;
  preferences: {
    id?: string;
    target_price: number | null;
    notify_on_price_drop: boolean;
    notify_on_availability: boolean;
    notify_on_changes: boolean;
  };
  onSubmit: (preferences: {
    id?: string;
    target_price: number | null;
    notify_on_price_drop: boolean;
    notify_on_availability: boolean;
    notify_on_changes: boolean;
  }) => Promise<void>;
  isLoading: boolean;
  isLoggedIn: boolean;
  currentPrice: number | null;
}

export default function ProductTrackingForm({
  isTracking,
  preferences,
  onSubmit,
  isLoading,
  isLoggedIn,
  currentPrice
}: ProductTrackingFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState(preferences);
  const [targetPriceInput, setTargetPriceInput] = useState(
    preferences.target_price ? preferences.target_price.toString() : ''
  );

  useEffect(() => {
    setFormData(preferences);
    setTargetPriceInput(preferences.target_price ? preferences.target_price.toString() : '');
  }, [preferences]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isLoggedIn) {
      router.push('/auth/login');
      return;
    }
    
    // Parse target price from input
    const targetPrice = targetPriceInput ? parseFloat(targetPriceInput) : null;
    
    onSubmit({
      ...formData,
      target_price: targetPrice
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'target_price') {
      setTargetPriceInput(value);
    } else {
      setFormData({
        ...formData,
        [name]: type === 'checkbox' ? checked : value
      });
    }
  };

  const suggestTargetPrice = () => {
    if (currentPrice) {
      // Suggest 10% off current price
      const suggestedPrice = Math.floor(currentPrice * 0.9 * 100) / 100;
      setTargetPriceInput(suggestedPrice.toString());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="block text-sm font-semibold mb-3 text-secondary">
          Target Price
        </label>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-muted">$</span>
            <input
              type="number"
              name="target_price"
              value={targetPriceInput}
              onChange={handleInputChange}
              step="0.01"
              min="0"
              placeholder="Set your target price"
              className="input-enhanced w-full pl-10 pr-4 py-3 rounded-lg"
            />
          </div>
          {currentPrice && (
            <button
              type="button"
              onClick={suggestTargetPrice}
              className="btn-base px-4 py-3 rounded-lg font-medium hover-lift transition-all"
              style={{ 
                background: 'var(--accent)',
                color: 'var(--light-text)'
              }}
            >
              Suggest
            </button>
          )}
        </div>
        <p className="text-xs text-muted mt-2 flex items-center">
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          We&apos;ll notify you when the price drops below this amount
        </p>
      </div>
      
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-secondary mb-3">Notification Preferences</h3>
        
        <div className="space-y-3">
          <label className="flex items-center p-3 rounded-lg bg-tertiary hover:bg-hover-secondary transition-colors cursor-pointer">
            <input
              type="checkbox"
              id="notify_on_price_drop"
              name="notify_on_price_drop"
              checked={formData.notify_on_price_drop}
              onChange={handleInputChange}
              className="w-5 h-5 rounded mr-3"
              style={{ accentColor: 'var(--primary)' }}
            />
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" style={{ color: 'var(--primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <span className="text-sm font-medium">Notify me about price drops</span>
            </div>
          </label>
          
          <label className="flex items-center p-3 rounded-lg bg-tertiary hover:bg-hover-secondary transition-colors cursor-pointer">
            <input
              type="checkbox"
              id="notify_on_availability"
              name="notify_on_availability"
              checked={formData.notify_on_availability}
              onChange={handleInputChange}
              className="w-5 h-5 rounded mr-3"
              style={{ accentColor: 'var(--secondary)' }}
            />
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" style={{ color: 'var(--secondary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm font-medium">Notify me when back in stock</span>
            </div>
          </label>
          
          <label className="flex items-center p-3 rounded-lg bg-tertiary hover:bg-hover-secondary transition-colors cursor-pointer">
            <input
              type="checkbox"
              id="notify_on_changes"
              name="notify_on_changes"
              checked={formData.notify_on_changes}
              onChange={handleInputChange}
              className="w-5 h-5 rounded mr-3"
              style={{ accentColor: 'var(--accent)' }}
            />
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-2" style={{ color: 'var(--accent)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m0 0V1a1 1 0 011-1h2a1 1 0 011 1v16a1 1 0 01-1 1H3a1 1 0 01-1-1V1a1 1 0 011-1h2a1 1 0 011 1v3m0 0h8m-8 0H5a1 1 0 00-1 1v3m1-4h8m0 0h1a1 1 0 011 1v3m-1-4V4" />
              </svg>
              <span className="text-sm font-medium">Notify me about product changes</span>
            </div>
          </label>
        </div>
      </div>
      
      <button
        type="submit"
        disabled={isLoading}
        className="btn-base w-full py-4 rounded-lg font-semibold text-lg flex items-center justify-center space-x-2 hover-lift transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ 
          background: isLoading ? 'var(--bg-muted)' : 'var(--primary)',
          color: isLoading ? 'var(--text-muted)' : 'var(--dark-text)'
        }}
      >
        {isLoading ? (
          <>
            <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Processing...</span>
          </>
        ) : isTracking ? (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span>Update Tracking Preferences</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Track This Product</span>
          </>
        )}
      </button>
      
      {!isLoggedIn && (
        <div className="p-4 rounded-lg" style={{ background: 'var(--warning-bg)' }}>
          <div className="flex items-center">
            <svg className="w-5 h-5 mr-2" style={{ color: 'var(--warning-text)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.081 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-sm font-medium" style={{ color: 'var(--warning-text)' }}>
              You&apos;ll need to sign in to track products
            </span>
          </div>
        </div>
      )}
    </form>
  );
}
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
  onSubmit: (preferences: any) => Promise<void>;
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
    <form onSubmit={handleSubmit}>
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">
          Target Price
        </label>
        <div className="flex">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">$</span>
            <input
              type="number"
              name="target_price"
              value={targetPriceInput}
              onChange={handleInputChange}
              step="0.01"
              min="0"
              placeholder="Set your target price"
              className="w-full pl-8 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-background"
            />
          </div>
          {currentPrice && (
            <button
              type="button"
              onClick={suggestTargetPrice}
              className="ml-2 px-3 py-2 bg-gray-200 dark:bg-gray-700 rounded-md text-sm hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Suggest
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          We'll notify you when the price drops below this amount
        </p>
      </div>
      
      <div className="space-y-3 mb-4">
        <div className="flex items-center">
          <input
            type="checkbox"
            id="notify_on_price_drop"
            name="notify_on_price_drop"
            checked={formData.notify_on_price_drop}
            onChange={handleInputChange}
            className="mr-2"
          />
          <label htmlFor="notify_on_price_drop" className="text-sm">
            Notify me about price drops
          </label>
        </div>
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="notify_on_availability"
            name="notify_on_availability"
            checked={formData.notify_on_availability}
            onChange={handleInputChange}
            className="mr-2"
          />
          <label htmlFor="notify_on_availability" className="text-sm">
            Notify me when back in stock
          </label>
        </div>
        
        <div className="flex items-center">
          <input
            type="checkbox"
            id="notify_on_changes"
            name="notify_on_changes"
            checked={formData.notify_on_changes}
            onChange={handleInputChange}
            className="mr-2"
          />
          <label htmlFor="notify_on_changes" className="text-sm">
            Notify me about product changes
          </label>
        </div>
      </div>
      
      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-primary text-buttonText py-2 px-4 rounded-md hover:bg-opacity-90 transition-colors disabled:opacity-50 flex items-center justify-center"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          </>
        ) : isTracking ? (
          'Update Tracking Preferences'
        ) : (
          'Track This Product'
        )}
      </button>
      
      {!isLoggedIn && (
        <p className="text-sm text-center mt-2 text-gray-600 dark:text-gray-400">
          You'll need to sign in to track products
        </p>
      )}
    </form>
  );
}
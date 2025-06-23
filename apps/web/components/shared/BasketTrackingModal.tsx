'use client';

import { useState, useEffect } from 'react';
import { supabase } from '~/lib/supabaseClient';

interface BasketTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  basketId: string;
  userId: string | undefined;
}

type TrackingPreferences = {
  id?: string;
  notify_on_price_drop: boolean;
  notify_on_availability: boolean;
  notify_on_changes: boolean;
};

export default function BasketTrackingModal({ 
  isOpen, 
  onClose, 
  basketId,
  userId
}: BasketTrackingModalProps) {
  const [preferences, setPreferences] = useState<TrackingPreferences>({
    notify_on_price_drop: true,
    notify_on_availability: true,
    notify_on_changes: true
  });
  const [isTracking, setIsTracking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && userId) {
      fetchTrackingPreferences();
    }
  }, [isOpen, userId, basketId]);

  const fetchTrackingPreferences = async () => {
    if (!userId) return;
    
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('basket_trackings')
        .select('*')
        .eq('user_id', userId)
        .eq('basket_id', basketId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "Results contain 0 rows" - expected if not tracking yet
        throw error;
      }
      
      if (data) {
        setIsTracking(true);
        setPreferences({
          id: data.id,
          notify_on_price_drop: data.notify_on_price_drop,
          notify_on_availability: data.notify_on_availability,
          notify_on_changes: data.notify_on_changes
        });
      } else {
        setIsTracking(false);
        setPreferences({
          notify_on_price_drop: true,
          notify_on_availability: true,
          notify_on_changes: true
        });
      }
    } catch (error) {
      console.error('Error fetching tracking preferences:', error);
      setError('Failed to load tracking preferences');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    
    setError(null);
    setSuccess(null);
    setIsSaving(true);
    
    try {
      if (isTracking) {
        // Update existing tracking
        const { error } = await supabase
          .from('basket_trackings')
          .update({
            notify_on_price_drop: preferences.notify_on_price_drop,
            notify_on_availability: preferences.notify_on_availability,
            notify_on_changes: preferences.notify_on_changes
          })
          .eq('id', preferences.id);
        
        if (error) throw error;
        setSuccess('Tracking preferences updated');
      } else {
        // Create new tracking
        const { error } = await supabase
          .from('basket_trackings')
          .insert({
            user_id: userId,
            basket_id: basketId,
            notify_on_price_drop: preferences.notify_on_price_drop,
            notify_on_availability: preferences.notify_on_availability,
            notify_on_changes: preferences.notify_on_changes
          });
        
        if (error) throw error;
        setIsTracking(true);
        setSuccess('Basket tracking enabled');
      }
    } catch (error) {
      console.error('Error saving tracking preferences:', error);
      setError('Failed to save tracking preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStopTracking = async () => {
    if (!userId || !preferences.id) return;
    
    setError(null);
    setSuccess(null);
    setIsSaving(true);
    
    try {
      const { error } = await supabase
        .from('basket_trackings')
        .delete()
        .eq('id', preferences.id);
      
      if (error) throw error;
      
      setIsTracking(false);
      setPreferences({
        notify_on_price_drop: true,
        notify_on_availability: true,
        notify_on_changes: true
      });
      setSuccess('Basket tracking disabled');
    } catch (error) {
      console.error('Error stopping tracking:', error);
      setError('Failed to stop tracking');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-background rounded-lg shadow-lg w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <h2 className="text-xl font-bold mb-4">Basket Tracking Preferences</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md">
            {success}
          </div>
        )}
        
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 mb-6">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="notify_on_price_drop"
                  checked={preferences.notify_on_price_drop}
                  onChange={(e) => setPreferences({
                    ...preferences,
                    notify_on_price_drop: e.target.checked
                  })}
                  className="mr-2"
                />
                <label htmlFor="notify_on_price_drop">
                  Notify me about price drops
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="notify_on_availability"
                  checked={preferences.notify_on_availability}
                  onChange={(e) => setPreferences({
                    ...preferences,
                    notify_on_availability: e.target.checked
                  })}
                  className="mr-2"
                />
                <label htmlFor="notify_on_availability">
                  Notify me when items become available
                </label>
              </div>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="notify_on_changes"
                  checked={preferences.notify_on_changes}
                  onChange={(e) => setPreferences({
                    ...preferences,
                    notify_on_changes: e.target.checked
                  })}
                  className="mr-2"
                />
                <label htmlFor="notify_on_changes">
                  Notify me about product changes
                </label>
              </div>
            </div>
            
            <div className="flex justify-between">
              {isTracking && (
                <button
                  type="button"
                  onClick={handleStopTracking}
                  disabled={isSaving}
                  className="px-4 py-2 border border-red-300 text-red-600 rounded-md hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                >
                  Stop Tracking
                </button>
              )}
              
              <button
                type="submit"
                disabled={isSaving}
                className={`px-4 py-2 bg-primary text-buttonText rounded-md hover:bg-opacity-90 transition-colors disabled:opacity-50 ${isTracking ? '' : 'w-full'}`}
              >
                {isSaving ? 'Saving...' : isTracking ? 'Update Preferences' : 'Start Tracking'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
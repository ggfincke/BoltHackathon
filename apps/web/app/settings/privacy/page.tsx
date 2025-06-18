'use client';

import { useState } from 'react';
import { useAuth } from '~/lib/auth';

export default function PrivacySettings() {
  const { user } = useAuth();
  const [dataSharing, setDataSharing] = useState(true);
  const [analyticsConsent, setAnalyticsConsent] = useState(true);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSaveSettings = () => {
    // In a real app, this would save to the database
    setMessage({ type: 'success', text: 'Privacy settings updated successfully' });
    
    // Clear message after 3 seconds
    setTimeout(() => {
      setMessage(null);
    }, 3000);
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Privacy Settings</h1>
      
      {message && (
        <div className={`mb-6 p-4 rounded-md ${
          message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {message.text}
        </div>
      )}
      
      <div className="bg-surface p-6 rounded-lg shadow-sm mb-6">
        <h2 className="text-xl font-semibold mb-4">Data Sharing & Privacy</h2>
        
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Product Data Sharing</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Allow TrackBasket to use your product views and searches to improve recommendations
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={dataSharing}
                  onChange={() => setDataSharing(!dataSharing)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
          
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Analytics Consent</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Allow anonymous usage data collection to help us improve the service
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={analyticsConsent}
                  onChange={() => setAnalyticsConsent(!analyticsConsent)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
          
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Marketing Communications</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Receive emails about deals, new features, and recommendations
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={marketingConsent}
                  onChange={() => setMarketingConsent(!marketingConsent)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-surface p-6 rounded-lg shadow-sm mb-6">
        <h2 className="text-xl font-semibold mb-4">Data Management</h2>
        
        <div className="space-y-6">
          <div>
            <h3 className="font-medium">Download Your Data</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-3">
              Download a copy of all your personal data, including your profile, baskets, and tracking preferences.
            </p>
            <button className="bg-primary text-buttonText px-4 py-2 rounded-md hover:bg-opacity-90 transition-colors">
              Request Data Export
            </button>
          </div>
          
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="font-medium text-red-600 dark:text-red-400">Delete Account</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-3">
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <button className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors">
              Delete Account
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex justify-end">
        <button 
          onClick={handleSaveSettings}
          className="bg-primary text-buttonText px-6 py-2 rounded-md hover:bg-opacity-90 transition-colors"
        >
          Save Settings
        </button>
      </div>
    </div>
  );
}
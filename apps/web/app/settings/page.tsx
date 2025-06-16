'use client';

import { useState } from 'react';
import { useAuth } from '~/lib/auth';
import { useRouter } from 'next/navigation';

export default function Settings() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [showConfirmation, setShowConfirmation] = useState(false);

  if (!user) {
    router.push('/auth/login');
    return null;
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      
      <div className="bg-surface p-6 rounded-lg shadow-sm mb-6">
        <h2 className="text-xl font-semibold mb-4">Account Settings</h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium mb-2">Email Notifications</h3>
            <div className="flex items-center">
              <input 
                type="checkbox" 
                id="price-alerts" 
                className="mr-2"
                defaultChecked
              />
              <label htmlFor="price-alerts">Price drop alerts</label>
            </div>
            <div className="flex items-center mt-2">
              <input 
                type="checkbox" 
                id="availability-alerts" 
                className="mr-2"
                defaultChecked
              />
              <label htmlFor="availability-alerts">Availability alerts</label>
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-2">Password</h3>
            <button 
              onClick={() => router.push('/auth/update-password')}
              className="bg-primary text-buttonText py-1 px-3 rounded-md hover:bg-opacity-90 transition-colors text-sm"
            >
              Change Password
            </button>
          </div>
        </div>
      </div>
      
      <div className="bg-surface p-6 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-4 text-red-600 dark:text-red-400">Danger Zone</h2>
        
        {showConfirmation ? (
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md">
            <p className="mb-4">Are you sure you want to sign out from all devices?</p>
            <div className="flex space-x-3">
              <button 
                onClick={async () => {
                  await signOut();
                  router.push('/');
                }}
                className="bg-red-600 text-white py-1 px-3 rounded-md hover:bg-red-700 transition-colors text-sm"
              >
                Yes, Sign Out
              </button>
              <button 
                onClick={() => setShowConfirmation(false)}
                className="bg-gray-200 dark:bg-gray-700 text-text py-1 px-3 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => setShowConfirmation(true)}
            className="bg-red-600 text-white py-1 px-3 rounded-md hover:bg-red-700 transition-colors text-sm"
          >
            Sign Out from All Devices
          </button>
        )}
      </div>
    </div>
  );
}
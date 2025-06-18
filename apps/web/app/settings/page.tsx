'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '~/lib/auth';
import { useRouter } from 'next/navigation';
import { supabase } from '~/lib/supabaseClient';

export default function Settings() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    try {
      setIsLoading(true);
      
      // Get user profile from database
      const { data, error } = await supabase
        .from('users')
        .select('first_name, last_name, username, email')
        .eq('id', user?.id)
        .single();
      
      if (error) throw error;
      
      // Set form values
      setFirstName(data.first_name || '');
      setLastName(data.last_name || '');
      setUsername(data.username || '');
      setEmail(data.email || user?.email || '');
      
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSaving(true);
      setMessage(null);
      
      // Update user profile in database
      const { error } = await supabase
        .from('users')
        .update({
          first_name: firstName,
          last_name: lastName,
          username: username
        })
        .eq('id', user?.id);
      
      if (error) throw error;
      
      setMessage({ type: 'success', text: 'Profile updated successfully' });
    } catch (error) {
      console.error('Error updating profile:', error);
      setMessage({ type: 'error', text: 'Failed to update profile' });
    } finally {
      setIsSaving(false);
      
      // Clear message after 3 seconds
      setTimeout(() => {
        setMessage(null);
      }, 3000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Account Settings</h1>
      
      {message && (
        <div className={`mb-6 p-4 rounded-md ${
          message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {message.text}
        </div>
      )}
      
      <div className="bg-surface p-6 rounded-lg shadow-sm mb-6">
        <h2 className="text-xl font-semibold mb-4">Profile Information</h2>
        
        <form onSubmit={handleSaveProfile}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium mb-1">
                First Name
              </label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-background"
              />
            </div>
            
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium mb-1">
                Last Name
              </label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-background"
              />
            </div>
          </div>
          
          <div className="mb-4">
            <label htmlFor="username" className="block text-sm font-medium mb-1">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-background"
            />
          </div>
          
          <div className="mb-6">
            <label htmlFor="email" className="block text-sm font-medium mb-1">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              disabled
              className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-background opacity-70"
            />
            <p className="text-xs text-gray-500 mt-1">
              Email address cannot be changed. Contact support if you need to update your email.
            </p>
          </div>
          
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="bg-primary text-buttonText px-4 py-2 rounded-md hover:bg-opacity-90 transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
      
      <div className="bg-surface p-6 rounded-lg shadow-sm mb-6">
        <h2 className="text-xl font-semibold mb-4">Password</h2>
        
        <div className="mb-4">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Change your password to keep your account secure.
          </p>
          
          <button 
            onClick={() => router.push('/auth/update-password')}
            className="bg-primary text-buttonText px-4 py-2 rounded-md hover:bg-opacity-90 transition-colors"
          >
            Change Password
          </button>
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
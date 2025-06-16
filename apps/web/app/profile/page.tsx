'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '~/lib/auth';
import { useRouter } from 'next/navigation';

export default function Profile() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login');
    } else if (user) {
      setEmail(user.email || '');
      // Extract name from email or use default
      const emailName = user.email?.split('@')[0] || '';
      setName(emailName);
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="bg-surface p-6 rounded-lg shadow-sm">
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Your Profile</h1>
      
      <div className="bg-surface p-6 rounded-lg shadow-sm">
        <div className="flex items-center mb-6">
          <div className="w-16 h-16 rounded-full bg-primary text-buttonText flex items-center justify-center text-2xl font-bold mr-4">
            {name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-semibold">{name}</h2>
            <p className="text-gray-600 dark:text-gray-400">{email}</p>
          </div>
        </div>
        
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <h3 className="text-lg font-medium mb-4">Account Information</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Email</p>
              <p>{email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Member Since</p>
              <p>{user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
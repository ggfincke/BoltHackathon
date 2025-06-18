'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '~/lib/supabaseClient';
import { useAuth } from '~/lib/auth';

type NotificationPreference = {
  id: string;
  user_id: string;
  notification_type: 'price_drop' | 'availability' | 'changes' | 'general';
  channel: 'email' | 'push' | 'sms';
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export default function NotificationSettings() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Notification types and channels
  const notificationTypes = [
    { id: 'price_drop', label: 'Price Drops', description: 'Get notified when prices drop for tracked products' },
    { id: 'availability', label: 'Availability', description: 'Get notified when out-of-stock products become available' },
    { id: 'changes', label: 'Product Changes', description: 'Get notified about changes to products you track' },
    { id: 'general', label: 'General Updates', description: 'Get notified about system updates and new features' }
  ];
  
  const notificationChannels = [
    { id: 'email', label: 'Email', icon: 'envelope' },
    { id: 'push', label: 'Push Notifications', icon: 'bell' },
    { id: 'sms', label: 'SMS', icon: 'phone' }
  ];

  useEffect(() => {
    if (!authLoading && user) {
      fetchPreferences();
    }
  }, [user, authLoading]);

  const fetchPreferences = async () => {
    try {
      setIsLoading(true);
      
      if (!user?.id) {
        throw new Error('User ID is required');
      }

      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) {
        console.error('Error fetching preferences:', error);
        throw error;
      }
      
      // If no preferences exist yet, create default ones
      if (!data || data.length === 0) {
        await createDefaultPreferences();
        return;
      }
      
      setPreferences(data as NotificationPreference[]);
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
      setMessage({ 
        type: 'error', 
        text: 'Failed to load notification preferences. Please try refreshing the page.' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createDefaultPreferences = async () => {
    try {
      if (!user?.id) {
        throw new Error('User ID is required');
      }

      // First ensure user exists in users table
      const { error: userError } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          email: user.email || '',
          first_name: user.user_metadata?.first_name || '',
          last_name: user.user_metadata?.last_name || '',
        }, {
          onConflict: 'id',
          ignoreDuplicates: false
        });

      if (userError) {
        console.error('Error ensuring user exists:', userError);
        // Continue anyway, user might already exist
      }

      const defaultPreferences = [];
      
      // Create default preferences for all combinations
              for (const type of notificationTypes) {
          for (const channel of notificationChannels) {
            defaultPreferences.push({
              user_id: user.id,
              notification_type: type.id as 'price_drop' | 'availability' | 'changes' | 'general',
              channel: channel.id as 'email' | 'push' | 'sms',
              is_enabled: channel.id === 'email'
            });
          }
        }
      
      const { data, error } = await supabase
        .from('notification_preferences')
        .insert(defaultPreferences)
        .select();
      
      if (error) {
        console.error('Database error details:', error);
        throw error;
      }
      
      setPreferences((data || []) as NotificationPreference[]);
    } catch (error) {
      console.error('Error creating default notification preferences:', error);
      setMessage({ 
        type: 'error', 
        text: 'Failed to initialize notification preferences. Please try refreshing the page.' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const togglePreference = async (type: string, channel: string, currentValue: boolean) => {
    try {
      setIsSaving(true);
      setMessage(null);
      
      // Find the preference to update
      const preference = preferences.find(
        p => p.notification_type === type && p.channel === channel
      );
      
      if (!preference) {
        throw new Error('Preference not found');
      }
      
      // Update the preference
      const { error } = await supabase
        .from('notification_preferences')
        .update({ is_enabled: !currentValue })
        .eq('id', preference.id);
      
      if (error) throw error;
      
      // Update local state
      setPreferences(preferences.map(p => 
        p.id === preference.id ? { ...p, is_enabled: !currentValue } : p
      ));
      
      setMessage({ type: 'success', text: 'Preferences updated successfully' });
    } catch (error) {
      console.error('Error updating notification preference:', error);
      setMessage({ type: 'error', text: 'Failed to update preference' });
    } finally {
      setIsSaving(false);
      
      // Clear message after 3 seconds
      setTimeout(() => {
        setMessage(null);
      }, 3000);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Notification Settings</h1>
      
      {message && (
        <div className={`mb-6 p-4 rounded-md ${
          message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {message.text}
        </div>
      )}
      
      <div className="bg-surface p-6 rounded-lg shadow-sm mb-6">
        <h2 className="text-xl font-semibold mb-4">Notification Preferences</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Choose how and when you want to be notified about your tracked products and baskets.
        </p>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="text-left py-3 px-4">Notification Type</th>
                {notificationChannels.map(channel => (
                  <th key={channel.id} className="text-center py-3 px-4">
                    <div className="flex flex-col items-center">
                      <span className="mb-1">
                        {channel.icon === 'envelope' && (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        )}
                        {channel.icon === 'bell' && (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                          </svg>
                        )}
                        {channel.icon === 'phone' && (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        )}
                      </span>
                      {channel.label}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {notificationTypes.map(type => (
                <tr key={type.id} className="border-b border-gray-200 dark:border-gray-700">
                  <td className="py-4 px-4">
                    <div>
                      <div className="font-medium">{type.label}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">{type.description}</div>
                    </div>
                  </td>
                  {notificationChannels.map(channel => {
                    const preference = preferences.find(
                      p => p.notification_type === type.id && p.channel === channel.id
                    );
                    const isEnabled = preference?.is_enabled || false;
                    
                    return (
                      <td key={`${type.id}-${channel.id}`} className="text-center py-4 px-4">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={isEnabled}
                            onChange={() => togglePreference(type.id, channel.id, isEnabled)}
                            disabled={isSaving}
                          />
                          <div className={`w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary ${isSaving ? 'opacity-50' : ''}`}></div>
                        </label>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="bg-surface p-6 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Additional Settings</h2>
        
        <div className="mb-6">
          <h3 className="text-lg font-medium mb-2">Notification Frequency</h3>
          <div className="flex items-center space-x-4">
            <label className="inline-flex items-center">
              <input type="radio" name="frequency" className="form-radio" defaultChecked />
              <span className="ml-2">Real-time</span>
            </label>
            <label className="inline-flex items-center">
              <input type="radio" name="frequency" className="form-radio" />
              <span className="ml-2">Daily digest</span>
            </label>
            <label className="inline-flex items-center">
              <input type="radio" name="frequency" className="form-radio" />
              <span className="ml-2">Weekly summary</span>
            </label>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Note: Critical notifications like price drops will always be sent in real-time.
          </p>
        </div>
        
        <div>
          <h3 className="text-lg font-medium mb-2">Quiet Hours</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Start Time</label>
              <input 
                type="time" 
                className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-background"
                defaultValue="22:00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Time</label>
              <input 
                type="time" 
                className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-background"
                defaultValue="08:00"
              />
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            We won't send notifications during your quiet hours, except for critical alerts you've opted into.
          </p>
        </div>
      </div>
    </div>
  );
}
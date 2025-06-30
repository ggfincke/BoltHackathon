'use client';

import { useState, useEffect } from 'react';

import { supabase } from '~/lib/supabaseClient';
import { useAuth } from '~/lib/auth';

type NotificationPreference = {
  id: string;
  user_id: string;
  notification_type: 'basket_updates' | 'general';
  channel: 'email' | 'push' | 'sms';
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export default function NotificationSettings() {
  const { user, loading: authLoading } = useAuth();
  
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const notificationTypes = [
    { 
      id: 'basket_updates', 
      label: 'Basket Updates', 
      description: 'Get notified about changes to your baskets and basket items',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17M17 13v4a2 2 0 01-2 2H9a2 2 0 01-2-2v-4m8 0V9a2 2 0 00-2-2H9a2 2 0 00-2 2v4.01" />
        </svg>
      )
    },
    { 
      id: 'general', 
      label: 'General Updates', 
      description: 'Get notified about system updates and new features',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    }
  ];
  
  const notificationChannels = [
    { 
      id: 'email', 
      label: 'Email', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      )
    },
    { 
      id: 'push', 
      label: 'Push', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      )
    },
    { 
      id: 'sms', 
      label: 'SMS', 
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      )
    }
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
      }

      const defaultPreferences = [];
      
      for (const type of notificationTypes) {
        for (const channel of notificationChannels) {
          defaultPreferences.push({
            user_id: user.id,
            notification_type: type.id as 'basket_updates' | 'general',
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
      
      const preference = preferences.find(
        p => p.notification_type === type && p.channel === channel
      );
      
      if (!preference) {
        throw new Error('Preference not found');
      }
      
      const { error } = await supabase
        .from('notification_preferences')
        .update({ is_enabled: !currentValue })
        .eq('id', preference.id);
      
      if (error) throw error;
      
      setPreferences(preferences.map(p => 
        p.id === preference.id ? { ...p, is_enabled: !currentValue } : p
      ));
      
      setMessage({ type: 'success', text: 'Preferences updated successfully' });
    } catch (error) {
      console.error('Error updating notification preference:', error);
      setMessage({ type: 'error', text: 'Failed to update preference' });
    } finally {
      setIsSaving(false);
      
      setTimeout(() => {
        setMessage(null);
      }, 3000);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Notification Settings</h1>
        <p className="text-muted">Choose how and when you want to be notified about your baskets and general updates.</p>
      </div>
      
      {message && (
        <div className={`mb-6 p-4 rounded-lg border ${
          message.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200' 
            : 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200'
        }`}>
          <div className="flex items-center gap-3">
            {message.type === 'success' ? (
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            )}
            <span className="font-medium">{message.text}</span>
          </div>
        </div>
      )}
      
      <div className="bg-surface rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6 overflow-hidden">
        <div className="bg-gradient-to-r from-primary/10 to-secondary/10 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <h2 className="text-xl font-semibold">Notification Preferences</h2>
          </div>
        </div>
        
        <div className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-4 px-2 font-medium">Notification Type</th>
                  {notificationChannels.map(channel => (
                    <th key={channel.id} className="text-center py-4 px-2 font-medium">
                      <div className="flex flex-col items-center gap-2">
                        <span className="text-gray-500 dark:text-gray-400">
                          {channel.icon}
                        </span>
                        <span className="text-sm">{channel.label}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {notificationTypes.map(type => (
                  <tr key={type.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="py-6 px-2">
                      <div className="flex items-start gap-3">
                        <span className="text-primary mt-1">
                          {type.icon}
                        </span>
                        <div>
                          <div className="font-medium mb-1">{type.label}</div>
                          <div className="text-sm text-muted">{type.description}</div>
                        </div>
                      </div>
                    </td>
                    {notificationChannels.map(channel => {
                      const preference = preferences.find(
                        p => p.notification_type === type.id && p.channel === channel.id
                      );
                      const isEnabled = preference?.is_enabled || false;
                      
                      return (
                        <td key={`${type.id}-${channel.id}`} className="text-center py-6 px-2">
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
      </div>
      
      <div className="bg-surface rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="bg-gradient-to-r from-secondary/10 to-accent/10 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-xl font-semibold">Additional Settings</h2>
          </div>
        </div>
        
        <div className="p-6 space-y-8">
          <div>
            <h3 className="text-lg font-medium mb-4">Notification Frequency</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="radio" name="frequency" className="w-4 h-4 text-primary" defaultChecked />
                <div>
                  <span className="font-medium">Real-time</span>
                  <p className="text-sm text-muted">Get notified immediately when events occur</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="radio" name="frequency" className="w-4 h-4 text-primary" />
                <div>
                  <span className="font-medium">Daily digest</span>
                  <p className="text-sm text-muted">Receive a summary of all notifications once per day</p>
                </div>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="radio" name="frequency" className="w-4 h-4 text-primary" />
                <div>
                  <span className="font-medium">Weekly summary</span>
                  <p className="text-sm text-muted">Get a weekly roundup of important notifications</p>
                </div>
              </label>
            </div>
            <p className="text-sm text-muted mt-3 flex items-center gap-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              Critical notifications like price drops will always be sent in real-time.
            </p>
          </div>
          
          <div>
            <h3 className="text-lg font-medium mb-4">Quiet Hours</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Start Time</label>
                <input 
                  type="time" 
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  defaultValue="22:00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">End Time</label>
                <input 
                  type="time" 
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
                  defaultValue="08:00"
                />
              </div>
            </div>
            <p className="text-sm text-muted mt-3">
              We won&apos;t send notifications during your quiet hours, except for critical alerts you&apos;ve opted into.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
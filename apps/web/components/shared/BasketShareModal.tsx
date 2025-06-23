'use client';

import { useState, useEffect } from 'react';
import { supabase } from '~/lib/supabaseClient';

type BasketUser = {
  id: string;
  basket_id: string;
  user_id: string;
  role: string;
  user: {
    email: string;
    username?: string;
  };
};

interface BasketShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  basketId: string;
  basketUsers: BasketUser[];
  onUsersUpdated: () => void;
}

export default function BasketShareModal({ 
  isOpen, 
  onClose, 
  basketId, 
  basketUsers, 
  onUsersUpdated 
}: BasketShareModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'viewer' | 'editor'>('viewer');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Check if basket is public
      const fetchBasketPublicStatus = async () => {
        try {
          const { data, error } = await supabase
            .from('baskets')
            .select('is_public')
            .eq('id', basketId)
            .single();
          
          if (error) throw error;
          setIsPublic(data.is_public);
        } catch (error) {
          console.error('Error fetching basket public status:', error);
        }
      };
      
      fetchBasketPublicStatus();
    }
  }, [isOpen, basketId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    
    setIsSubmitting(true);
    try {
      // Find user by email
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email.trim())
        .single();
      
      if (userError) {
        setError('User not found with this email');
        setIsSubmitting(false);
        return;
      }
      
      // Check if user already has access
      const existingUser = basketUsers.find(bu => bu.user.email === email.trim());
      if (existingUser) {
        // Update role if different
        if (existingUser.role !== role) {
          const { error: updateError } = await supabase
            .from('basket_users')
            .update({ role })
            .eq('id', existingUser.id);
          
          if (updateError) throw updateError;
          
          setSuccess(`Updated ${email}'s role to ${role}`);
          onUsersUpdated();
        } else {
          setError(`${email} already has ${role} access`);
        }
        setIsSubmitting(false);
        return;
      }
      
      // Add user to basket
      const { error: shareError } = await supabase
        .from('basket_users')
        .insert({
          basket_id: basketId,
          user_id: userData.id,
          role
        });
      
      if (shareError) throw shareError;
      
      setSuccess(`Shared with ${email} as ${role}`);
      setEmail('');
      onUsersUpdated();
    } catch (error) {
      console.error('Error sharing basket:', error);
      setError('Failed to share basket. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveUser = async (basketUserId: string) => {
    try {
      const { error } = await supabase
        .from('basket_users')
        .delete()
        .eq('id', basketUserId);
      
      if (error) throw error;
      
      setSuccess('User removed from basket');
      onUsersUpdated();
    } catch (error) {
      console.error('Error removing user:', error);
      setError('Failed to remove user. Please try again.');
    }
  };

  const togglePublicStatus = async () => {
    try {
      const { error } = await supabase
        .from('baskets')
        .update({ is_public: !isPublic })
        .eq('id', basketId);
      
      if (error) throw error;
      
      setIsPublic(!isPublic);
      setSuccess(`Basket is now ${!isPublic ? 'public' : 'private'}`);
    } catch (error) {
      console.error('Error updating basket public status:', error);
      setError('Failed to update basket visibility. Please try again.');
    }
  };

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
        
        <h2 className="text-xl font-bold mb-4">Share Basket</h2>
        
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
        
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <input
                id="isPublic"
                type="checkbox"
                checked={isPublic}
                onChange={togglePublicStatus}
                className="mr-2"
              />
              <label htmlFor="isPublic" className="text-sm">
                Make this basket public
              </label>
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Public baskets can be viewed by anyone with the link, but only invited users can edit.
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex gap-2 mb-4">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="flex-1 p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-background"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as 'viewer' | 'editor')}
              className="p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-background"
            >
              <option value="viewer">Viewer</option>
              <option value="editor">Editor</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary text-buttonText py-2 px-4 rounded-md hover:bg-opacity-90 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Sharing...' : 'Share'}
          </button>
        </form>
        
        <div>
          <h3 className="font-medium mb-2">Shared with</h3>
          {basketUsers.length > 1 ? (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {basketUsers.map((bu) => (
                <li key={bu.id} className="py-2 flex justify-between items-center">
                  <div>
                    <div className="font-medium">{bu.user.email}</div>
                    <div className="text-xs text-gray-500 capitalize">{bu.role}</div>
                  </div>
                  {bu.role !== 'owner' && (
                    <button
                      onClick={() => handleRemoveUser(bu.id)}
                      className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      title="Remove"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-sm">
              This basket is not shared with anyone yet.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
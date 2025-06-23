'use client';

import { useState, useEffect } from 'react';
import { supabase } from '~/lib/supabaseClient';
import { useAuth } from '~/lib/auth';
import Link from 'next/link';

interface AddToBasketModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
}

type Basket = {
  id: string;
  name: string;
  item_count: number;
};

export default function AddToBasketModal({
  isOpen,
  onClose,
  productId,
  productName
}: AddToBasketModalProps) {
  const { user, loading: authLoading } = useAuth();
  const [baskets, setBaskets] = useState<Basket[]>([]);
  const [selectedBasketId, setSelectedBasketId] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && !authLoading && user) {
      fetchUserBaskets();
    }
  }, [isOpen, user, authLoading]);

  const fetchUserBaskets = async () => {
    try {
      setIsLoading(true);
      
      // Get baskets the user has access to
      const { data: basketUsers, error: basketUsersError } = await supabase
        .from('basket_users')
        .select('basket_id, role')
        .eq('user_id', user?.id);
      
      if (basketUsersError) throw basketUsersError;
      
      if (!basketUsers || basketUsers.length === 0) {
        setBaskets([]);
        setIsLoading(false);
        return;
      }
      
      const basketIds = basketUsers.map(bu => bu.basket_id);
      
      // Get basket details with item count
      const { data, error } = await supabase
        .from('baskets')
        .select(`
          id, 
          name,
          basket_items:basket_items(count)
        `)
        .in('id', basketIds);
      
      if (error) throw error;
      
      const formattedBaskets = data.map(basket => ({
        id: basket.id,
        name: basket.name,
        item_count: basket.basket_items?.[0]?.count || 0
      }));
      
      setBaskets(formattedBaskets);
      
      // Select the first basket by default if available
      if (formattedBaskets.length > 0 && !selectedBasketId) {
        setSelectedBasketId(formattedBaskets[0].id);
      }
    } catch (error) {
      console.error('Error fetching baskets:', error);
      setError('Failed to load your baskets');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      setError('You must be logged in to add items to a basket');
      return;
    }
    
    if (!selectedBasketId) {
      setError('Please select a basket');
      return;
    }
    
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);
    
    try {
      // Check if product already exists in the basket
      const { data: existingItems, error: checkError } = await supabase
        .from('basket_items')
        .select('id, quantity')
        .eq('basket_id', selectedBasketId)
        .eq('product_id', productId);
      
      if (checkError) throw checkError;
      
      // Get current price for the product
      const { data: listings, error: listingsError } = await supabase
        .from('listings')
        .select('price')
        .eq('product_id', productId)
        .order('price', { ascending: true })
        .limit(1);
      
      if (listingsError) throw listingsError;
      
      const currentPrice = listings?.[0]?.price || null;
      
      if (existingItems && existingItems.length > 0) {
        // Update existing item quantity
        const existingItem = existingItems[0];
        const newQuantity = existingItem.quantity + quantity;
        
        const { error: updateError } = await supabase
          .from('basket_items')
          .update({
            quantity: newQuantity,
            notes: notes || existingItem.notes,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingItem.id);
        
        if (updateError) throw updateError;
        
        setSuccess(`Updated quantity of ${productName} in your basket`);
      } else {
        // Add new item to basket
        const { error: insertError } = await supabase
          .from('basket_items')
          .insert({
            basket_id: selectedBasketId,
            product_id: productId,
            quantity,
            price_at_add: currentPrice,
            notes: notes || null
          });
        
        if (insertError) throw insertError;
        
        setSuccess(`Added ${productName} to your basket`);
      }
      
      // Reset form
      setQuantity(1);
      setNotes('');
    } catch (error) {
      console.error('Error adding item to basket:', error);
      setError('Failed to add item to basket');
    } finally {
      setIsSubmitting(false);
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
        
        <h2 className="text-xl font-bold mb-4">Add to Basket</h2>
        <p className="mb-4 text-gray-600 dark:text-gray-400">{productName}</p>
        
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
        
        {!user && !authLoading ? (
          <div className="text-center py-4">
            <p className="mb-4">You need to be logged in to add items to a basket.</p>
            <Link
              href={`/auth/login?redirectedFrom=/product/${productId}`}
              className="bg-primary text-buttonText px-4 py-2 rounded-md hover:bg-opacity-90 transition-colors"
            >
              Sign In
            </Link>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : baskets.length === 0 ? (
          <div className="text-center py-4">
            <p className="mb-4">You don't have any baskets yet.</p>
            <Link
              href="/baskets"
              className="bg-primary text-buttonText px-4 py-2 rounded-md hover:bg-opacity-90 transition-colors"
            >
              Create a Basket
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="basket" className="block text-sm font-medium mb-1">
                Select Basket
              </label>
              <select
                id="basket"
                value={selectedBasketId}
                onChange={(e) => setSelectedBasketId(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-background"
                required
              >
                <option value="" disabled>Select a basket</option>
                {baskets.map((basket) => (
                  <option key={basket.id} value={basket.id}>
                    {basket.name} ({basket.item_count} items)
                  </option>
                ))}
              </select>
            </div>
            
            <div className="mb-4">
              <label htmlFor="quantity" className="block text-sm font-medium mb-1">
                Quantity
              </label>
              <input
                id="quantity"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-background"
                required
              />
            </div>
            
            <div className="mb-6">
              <label htmlFor="notes" className="block text-sm font-medium mb-1">
                Notes (optional)
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-background"
                rows={2}
                placeholder="Add any notes about this item..."
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !selectedBasketId}
                className="px-4 py-2 bg-primary text-buttonText rounded-md hover:bg-opacity-90 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Adding...' : 'Add to Basket'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
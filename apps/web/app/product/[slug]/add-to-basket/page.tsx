'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '~/lib/supabaseClient';
import { useAuth } from '~/lib/auth';
import Link from 'next/link';

type Product = {
  id: string;
  name: string;
  slug: string;
};

type Basket = {
  id: string;
  name: string;
  item_count: number;
};

export default function AddToBasketPage() {
  const { slug } = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [baskets, setBaskets] = useState<Basket[]>([]);
  const [selectedBasketId, setSelectedBasketId] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push(`/auth/login?redirectedFrom=/product/${slug}/add-to-basket`);
        return;
      }
      
      fetchProductAndBaskets();
    }
  }, [user, authLoading, slug, router]);

  const fetchProductAndBaskets = async () => {
    try {
      setIsLoading(true);
      
      // Fetch product details
      const { data: productData, error: productError } = await supabase
        .from('products')
        .select('id, name, slug')
        .eq('slug', slug as string)
        .single();
      
      if (productError) throw productError;
      setProduct(productData);
      
      // Fetch user's baskets
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
      if (formattedBaskets.length > 0) {
        setSelectedBasketId(formattedBaskets[0].id);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load product or baskets');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user || !product) {
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
        .eq('product_id', product.id);
      
      if (checkError) throw checkError;
      
      // Get current price for the product
      const { data: listings, error: listingsError } = await supabase
        .from('listings')
        .select('price')
        .eq('product_id', product.id)
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
        
        setSuccess(`Updated quantity of ${product.name} in your basket`);
      } else {
        // Add new item to basket
        const { error: insertError } = await supabase
          .from('basket_items')
          .insert({
            basket_id: selectedBasketId,
            product_id: product.id,
            quantity,
            price_at_add: currentPrice,
            notes: notes || null
          });
        
        if (insertError) throw insertError;
        
        setSuccess(`Added ${product.name} to your basket`);
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

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto py-8">
        <div className="bg-surface p-8 rounded-lg shadow-sm text-center">
          <h2 className="text-xl font-semibold mb-2">Product not found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            The product you're looking for doesn't exist or has been removed.
          </p>
          <button
            onClick={() => router.back()}
            className="inline-block bg-primary text-buttonText px-4 py-2 rounded-md hover:bg-opacity-90 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-2xl">
      <div className="bg-surface p-6 rounded-lg shadow-sm">
        <h1 className="text-2xl font-bold mb-6">Add to Basket</h1>
        
        <div className="mb-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-md">
          <h2 className="font-semibold mb-1">{product.name}</h2>
          <Link 
            href={`/product/${product.slug}`}
            className="text-sm text-primary hover:underline"
          >
            View product details
          </Link>
        </div>
        
        {error && (
          <div className="mb-6 p-3 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-6 p-3 bg-green-100 text-green-700 rounded-md">
            {success}
            <div className="mt-2 flex space-x-3">
              <Link
                href={`/product/${product.slug}`}
                className="text-sm text-green-700 hover:underline"
              >
                Back to Product
              </Link>
              <Link
                href="/baskets"
                className="text-sm text-green-700 hover:underline"
              >
                View Baskets
              </Link>
            </div>
          </div>
        )}
        
        {baskets.length === 0 ? (
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
              <label htmlFor="basket" className="block text-sm font-medium mb-2">
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
              <label htmlFor="quantity" className="block text-sm font-medium mb-2">
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
              <label htmlFor="notes" className="block text-sm font-medium mb-2">
                Notes (optional)
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-background"
                rows={3}
                placeholder="Add any notes about this item..."
              />
            </div>
            
            <div className="flex justify-end space-x-3">
              <Link
                href={`/product/${product.slug}`}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </Link>
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
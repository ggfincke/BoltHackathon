'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '~/lib/supabaseClient';
import { useAuth } from '~/lib/auth';
import Link from 'next/link';
import CreateBasketModal from '~/components/CreateBasketModal';

type Basket = {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  item_count: number;
  total_cost: number;
};

export default function Baskets() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [baskets, setBaskets] = useState<Basket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/auth/login?redirectedFrom=/baskets');
        return;
      }
      
      fetchBaskets();
    }
  }, [user, authLoading, router]);

  const fetchBaskets = async () => {
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
      
      // Get basket details with item count and total cost
      const { data, error } = await supabase
        .from('baskets')
        .select(`
          id, 
          name, 
          description, 
          is_public, 
          created_at, 
          updated_at,
          basket_items:basket_items(count)
        `)
        .in('id', basketIds);
      
      if (error) throw error;
      
      // Get total cost for each basket
      const basketsWithDetails = await Promise.all(data.map(async (basket) => {
        const { data: basketItems, error: itemsError } = await supabase
          .from('basket_items')
          .select(`
            quantity,
            price_at_add,
            product_id,
            products:products(
              listings:listings(
                price,
                currency
              )
            )
          `)
          .eq('basket_id', basket.id);
        
        if (itemsError) throw itemsError;
        
        // Calculate total cost based on current prices or price_at_add
        let totalCost = 0;
        basketItems?.forEach(item => {
          // Get current price from listings if available
          const currentPrice = item.products?.listings?.[0]?.price;
          
          // Use current price or fallback to price_at_add
          const price = currentPrice || item.price_at_add || 0;
          
          // Multiply by quantity
          totalCost += price * (item.quantity || 1);
        });
        
        return {
          ...basket,
          item_count: basket.basket_items?.[0]?.count || 0,
          total_cost: totalCost
        };
      }));
      
      setBaskets(basketsWithDetails);
    } catch (error) {
      console.error('Error fetching baskets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBasket = async (name: string, description: string, isPublic: boolean) => {
    try {
      // Create new basket
      const { data: basketData, error: basketError } = await supabase
        .from('baskets')
        .insert({
          name,
          description,
          is_public: isPublic
        })
        .select()
        .single();
      
      if (basketError) throw basketError;
      
      // Add user as owner
      const { error: userError } = await supabase
        .from('basket_users')
        .insert({
          basket_id: basketData.id,
          user_id: user?.id,
          role: 'owner'
        });
      
      if (userError) throw userError;
      
      // Refresh baskets
      fetchBaskets();
      
      // Close modal
      setIsModalOpen(false);
      
      // Navigate to the new basket
      router.push(`/basket/${basketData.id}`);
    } catch (error) {
      console.error('Error creating basket:', error);
    }
  };

  if (authLoading) {
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Your Baskets</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-primary text-buttonText px-4 py-2 rounded-md hover:bg-opacity-90 transition-colors"
        >
          Create New Basket
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : baskets.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {baskets.map((basket) => (
            <Link
              key={basket.id}
              href={`/basket/${basket.id}`}
              className="bg-surface p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              <h2 className="text-xl font-semibold mb-2">{basket.name}</h2>
              {basket.description && (
                <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">{basket.description}</p>
              )}
              <div className="flex justify-between mt-4">
                <div className="text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Items: </span>
                  <span className="font-medium">{basket.item_count}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Est. Total: </span>
                  <span className="font-medium">${basket.total_cost.toFixed(2)}</span>
                </div>
              </div>
              <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
                Last updated: {new Date(basket.updated_at).toLocaleDateString()}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="bg-surface p-8 rounded-lg shadow-sm text-center">
          <h2 className="text-xl font-semibold mb-2">No baskets yet</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Create your first basket to start tracking products and prices.
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-primary text-buttonText px-4 py-2 rounded-md hover:bg-opacity-90 transition-colors"
          >
            Create New Basket
          </button>
        </div>
      )}

      <CreateBasketModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateBasket}
      />
    </div>
  );
}
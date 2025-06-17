'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '~/lib/supabaseClient';
import { useAuth } from '~/lib/auth';
import { format } from 'date-fns';
import BasketItemsTable from '~/components/BasketItemsTable';
import BasketShareModal from '~/components/BasketShareModal';
import BasketTrackingModal from '~/components/BasketTrackingModal';
import ConfirmationModal from '~/components/ConfirmationModal';

type Basket = {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

type BasketItem = {
  id: string;
  basket_id: string;
  product_id: string;
  quantity: number;
  price_at_add: number | null;
  added_at: string;
  updated_at: string;
  notes: string | null;
  product: {
    id: string;
    name: string;
    slug: string;
    brand?: {
      name: string;
    } | null;
    listings?: {
      id: string;
      price: number | null;
      currency: string | null;
      in_stock: boolean | null;
      url: string;
      retailer: {
        name: string;
      };
    }[];
  };
};

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

export default function BasketDetail() {
  const { id } = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [basket, setBasket] = useState<Basket | null>(null);
  const [basketItems, setBasketItems] = useState<BasketItem[]>([]);
  const [basketUsers, setBasketUsers] = useState<BasketUser[]>([]);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [totalCost, setTotalCost] = useState(0);
  
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push('/auth/login?redirectedFrom=/basket/' + id);
        return;
      }
      
      fetchBasketDetails();
    }
  }, [user, authLoading, id, router]);
  
  const fetchBasketDetails = async () => {
    try {
      setIsLoading(true);
      
      // Get basket details
      const { data: basketData, error: basketError } = await supabase
        .from('baskets')
        .select('*')
        .eq('id', id)
        .single();
      
      if (basketError) throw basketError;
      setBasket(basketData);
      
      // Get user's role for this basket
      const { data: userRoleData, error: userRoleError } = await supabase
        .from('basket_users')
        .select('role')
        .eq('basket_id', id)
        .eq('user_id', user?.id)
        .single();
      
      if (userRoleError && userRoleError.code !== 'PGRST116') {
        // PGRST116 is "Results contain 0 rows" - expected if user doesn't have access
        throw userRoleError;
      }
      
      if (!userRoleData && !basketData.is_public) {
        // User doesn't have access to this private basket
        router.push('/baskets');
        return;
      }
      
      setUserRole(userRoleData?.role || null);
      
      // Get basket items with product details
      const { data: itemsData, error: itemsError } = await supabase
        .from('basket_items')
        .select(`
          id,
          basket_id,
          product_id,
          quantity,
          price_at_add,
          added_at,
          updated_at,
          notes,
          product:products(
            id,
            name,
            slug,
            brand:brands(name),
            listings(
              id,
              price,
              currency,
              in_stock,
              url,
              retailer:retailers(name)
            )
          )
        `)
        .eq('basket_id', id)
        .order('added_at', { ascending: false });
      
      if (itemsError) throw itemsError;
      setBasketItems(itemsData || []);
      
      // Calculate total cost
      let total = 0;
      itemsData?.forEach(item => {
        // Get current price from listings if available
        const currentPrice = item.product?.listings?.[0]?.price;
        
        // Use current price or fallback to price_at_add
        const price = currentPrice || item.price_at_add || 0;
        
        // Multiply by quantity
        total += price * (item.quantity || 1);
      });
      
      setTotalCost(total);
      
      // Get basket users if user is owner or editor
      if (userRoleData?.role === 'owner' || userRoleData?.role === 'editor') {
        const { data: usersData, error: usersError } = await supabase
          .from('basket_users')
          .select(`
            id,
            basket_id,
            user_id,
            role,
            user:users(
              email,
              username
            )
          `)
          .eq('basket_id', id);
        
        if (usersError) throw usersError;
        setBasketUsers(usersData || []);
      }
      
    } catch (error) {
      console.error('Error fetching basket details:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDeleteBasket = async () => {
    try {
      // Only owners can delete baskets
      if (userRole !== 'owner') return;
      
      const { error } = await supabase
        .from('baskets')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      router.push('/baskets');
    } catch (error) {
      console.error('Error deleting basket:', error);
    }
  };
  
  const handleCloneBasket = async () => {
    try {
      // Create new basket
      const { data: newBasket, error: basketError } = await supabase
        .from('baskets')
        .insert({
          name: `${basket?.name} (Copy)`,
          description: basket?.description,
          is_public: false
        })
        .select()
        .single();
      
      if (basketError) throw basketError;
      
      // Add user as owner
      const { error: userError } = await supabase
        .from('basket_users')
        .insert({
          basket_id: newBasket.id,
          user_id: user?.id,
          role: 'owner'
        });
      
      if (userError) throw userError;
      
      // Clone basket items
      const itemsToClone = basketItems.map(item => ({
        basket_id: newBasket.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price_at_add: item.price_at_add,
        notes: item.notes
      }));
      
      if (itemsToClone.length > 0) {
        const { error: itemsError } = await supabase
          .from('basket_items')
          .insert(itemsToClone);
        
        if (itemsError) throw itemsError;
      }
      
      // Navigate to new basket
      router.push(`/basket/${newBasket.id}`);
    } catch (error) {
      console.error('Error cloning basket:', error);
    }
  };
  
  const handleUpdateItem = async (itemId: string, updates: { quantity?: number; notes?: string }) => {
    try {
      const { error } = await supabase
        .from('basket_items')
        .update(updates)
        .eq('id', itemId);
      
      if (error) throw error;
      
      // Refresh basket items
      fetchBasketDetails();
    } catch (error) {
      console.error('Error updating basket item:', error);
    }
  };
  
  const handleRemoveItem = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from('basket_items')
        .delete()
        .eq('id', itemId);
      
      if (error) throw error;
      
      // Refresh basket items
      fetchBasketDetails();
    } catch (error) {
      console.error('Error removing basket item:', error);
    }
  };
  
  const handleAddItem = async (productId: string, quantity: number = 1, notes: string = '') => {
    try {
      // Get current price for the product
      const { data: listings, error: listingsError } = await supabase
        .from('listings')
        .select('price')
        .eq('product_id', productId)
        .order('price', { ascending: true })
        .limit(1);
      
      if (listingsError) throw listingsError;
      
      const currentPrice = listings?.[0]?.price || null;
      
      // Add item to basket
      const { error } = await supabase
        .from('basket_items')
        .insert({
          basket_id: id,
          product_id: productId,
          quantity,
          price_at_add: currentPrice,
          notes
        });
      
      if (error) throw error;
      
      // Refresh basket items
      fetchBasketDetails();
    } catch (error) {
      console.error('Error adding item to basket:', error);
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
  
  if (!basket) {
    return (
      <div className="container mx-auto py-8">
        <div className="bg-surface p-8 rounded-lg shadow-sm text-center">
          <h2 className="text-xl font-semibold mb-2">Basket not found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            The basket you're looking for doesn't exist or you don't have access to it.
          </p>
          <button
            onClick={() => router.push('/baskets')}
            className="bg-primary text-buttonText px-4 py-2 rounded-md hover:bg-opacity-90 transition-colors"
          >
            Back to Baskets
          </button>
        </div>
      </div>
    );
  }

  const canEdit = userRole === 'owner' || userRole === 'editor';
  
  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold">{basket.name}</h1>
          {basket.description && (
            <p className="text-gray-600 dark:text-gray-400 mt-1">{basket.description}</p>
          )}
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Last updated: {format(new Date(basket.updated_at), 'PPP')}
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <>
              <button
                onClick={() => setIsShareModalOpen(true)}
                className="bg-surface px-3 py-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share
              </button>
              <button
                onClick={() => setIsTrackingModalOpen(true)}
                className="bg-surface px-3 py-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                Track
              </button>
            </>
          )}
          <button
            onClick={() => setIsCloneModalOpen(true)}
            className="bg-surface px-3 py-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm flex items-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Clone
          </button>
          {userRole === 'owner' && (
            <button
              onClick={() => setIsDeleteModalOpen(true)}
              className="bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 px-3 py-1.5 rounded-md hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors text-sm flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </button>
          )}
        </div>
      </div>
      
      <div className="bg-surface p-4 rounded-lg shadow-sm mb-6">
        <div className="flex justify-between items-center">
          <div>
            <span className="text-gray-600 dark:text-gray-400">Total Items:</span>
            <span className="ml-2 font-semibold">{basketItems.length}</span>
          </div>
          <div>
            <span className="text-gray-600 dark:text-gray-400">Estimated Total:</span>
            <span className="ml-2 font-semibold">${totalCost.toFixed(2)}</span>
          </div>
        </div>
      </div>
      
      <BasketItemsTable
        items={basketItems}
        canEdit={canEdit}
        onUpdateItem={handleUpdateItem}
        onRemoveItem={handleRemoveItem}
      />
      
      {/* Modals */}
      <BasketShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        basketId={basket.id}
        basketUsers={basketUsers}
        onUsersUpdated={fetchBasketDetails}
      />
      
      <BasketTrackingModal
        isOpen={isTrackingModalOpen}
        onClose={() => setIsTrackingModalOpen(false)}
        basketId={basket.id}
        userId={user?.id}
      />
      
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteBasket}
        title="Delete Basket"
        message="Are you sure you want to delete this basket? This action cannot be undone."
        confirmText="Delete"
        confirmButtonClass="bg-red-600 hover:bg-red-700"
      />
      
      <ConfirmationModal
        isOpen={isCloneModalOpen}
        onClose={() => setIsCloneModalOpen(false)}
        onConfirm={handleCloneBasket}
        title="Clone Basket"
        message="This will create a copy of this basket with all its items. Do you want to continue?"
        confirmText="Clone"
      />
    </div>
  );
}
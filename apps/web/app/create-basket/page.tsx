'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '~/lib/auth';
import { supabase } from '~/lib/supabaseClient';
import CompletionScreen from '~/components/shared/CompletionScreen';

interface ProductMatch {
  ingredient: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit?: string;
  confidence: 'high' | 'medium' | 'low';
  price: number;
  retailer: string;
  image_url?: string;
  alternatives?: ProductAlternative[];
}

interface ProductAlternative {
    product_id: string;
    product_name: string;
  price: number;
  retailer: string;
  image_url?: string;
}

interface ChatToBasketResponse {
  basket_id: string;
  matches: ProductMatch[];
  unmatched: string[];
  summary: string;
}

export default function CreateBasketPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<'chat' | 'manual'>('chat');
  const [inputText, setInputText] = useState('');
  const [basketName, setBasketName] = useState('');
  const [basketDescription, setBasketDescription] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ChatToBasketResponse | null>(null);
  const [editableMatches, setEditableMatches] = useState<ProductMatch[]>([]);
  const [streamingStatus, setStreamingStatus] = useState<string>('');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [openAlternatives, setOpenAlternatives] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [basketItemsLoaded, setBasketItemsLoaded] = useState(false);
  const [isUpdatingAlternative, setIsUpdatingAlternative] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login?redirectedFrom=/create-basket');
    }
  }, [user, authLoading, router]);

  // Reset basketItemsLoaded when result changes
  useEffect(() => {
    if (result?.basket_id) {
      setBasketItemsLoaded(false);
    }
  }, [result?.basket_id]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openAlternatives && !event.target) return;
      
      const target = event.target as Element;
      const dropdownElement = target.closest('[data-dropdown]');
      const buttonElement = target.closest('[data-dropdown-trigger]');
      
      if (!dropdownElement && !buttonElement) {
        setOpenAlternatives(null);
      }
    };

    if (openAlternatives) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [openAlternatives]);

  useEffect(() => {
    if (result) {
      setEditableMatches([...result.matches]);
    }
  }, [result]);

  useEffect(() => {
    // After a basket is created, fetch fresh basket items with product details so we can
    // show accurate pricing, retailer and images in the completion screen.
    const fetchBasketItems = async () => {
      if (!result?.basket_id || basketItemsLoaded || isUpdatingAlternative) return;
      try {
        // First get the basket items with products
        const { data: basketItems, error: basketError } = await supabase
          .from('basket_items')
          .select(`
            product_id,
            quantity,
            products (
              name
            )
          `)
          .eq('basket_id', result.basket_id);

        if (basketError) throw basketError;

        if (!basketItems || basketItems.length === 0) {
          setBasketItemsLoaded(true);
          return;
        }

        // Get ALL product IDs (main products + alternatives) for efficient bulk fetching
        const allProductIds = new Set<string>();
        basketItems.forEach((item) => {
          allProductIds.add(item.product_id);
          // Add alternatives from original matches
          const originalMatch = result.matches.find(m => m.product_id === item.product_id);
          originalMatch?.alternatives?.forEach(alt => allProductIds.add(alt.product_id));
        });

        // Get the best listing for each product (lowest price, has image)
        const { data: listings, error: listingsError } = await supabase
          .from('listings')
          .select(`
            product_id,
            price,
            image_url,
            retailer:retailers(name)
          `)
          .in('product_id', Array.from(allProductIds))
          .order('price', { ascending: true });

        if (listingsError) throw listingsError;

        // Create a map of best listings per product (prefer listings with images, then lowest price)
        const bestListings = new Map();
        (listings || []).forEach((listing) => {
          const existing = bestListings.get(listing.product_id);
          if (!existing || 
              (listing.image_url && !existing.image_url) || 
              ((!listing.image_url || existing.image_url) && 
               listing.price !== null && existing.price !== null && listing.price < existing.price)) {
            bestListings.set(listing.product_id, listing);
          }
        });

        // Transform the data into the structure we already use for editableMatches
        // Preserve and enrich alternatives from the original LLM response
        const transformed: ProductMatch[] = basketItems.map((item) => {
          const listing = bestListings.get(item.product_id);
          // Find the original match to preserve alternatives
          const originalMatch = result.matches.find(m => m.product_id === item.product_id);
          
          // Enrich alternatives with database information
          const enrichedAlternatives = (originalMatch?.alternatives || [])
            .filter(alt => alt.product_id !== item.product_id) // Avoid duplicates
            .map(alt => {
              const altListing = bestListings.get(alt.product_id);
              if (altListing) {
                return {
                  ...alt,
                  price: altListing.price || alt.price,
                  retailer: altListing.retailer?.name || alt.retailer,
                  image_url: altListing.image_url || alt.image_url,
                };
              }
              return alt;
            });
          
          return {
            ingredient: item.products?.name || '',
            product_id: item.product_id,
            product_name: item.products?.name || 'Unknown product',
            quantity: item.quantity || 1,
            confidence: 'high' as const,
            price: listing?.price || 0,
            retailer: listing?.retailer?.name || '',
            image_url: listing?.image_url || '',
            alternatives: enrichedAlternatives,
          };
        });

        if (transformed.length > 0) {
          setEditableMatches(transformed);
        }
      } catch (err) {
        console.error('Failed to fetch basket items for completion screen', err);
      } finally {
        setBasketItemsLoaded(true);
      }
    };

    fetchBasketItems();
  }, [result?.basket_id]); // Remove basketItemsLoaded dependency to prevent unnecessary re-fetching

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputText.trim()) {
      setError('Please enter some text to process');
      return;
    }
    
    if (!user) {
      router.push('/auth/login?redirectedFrom=/create-basket');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    setLoadingProgress(0);
    setStreamingStatus('Analyzing your text...');
    
    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat-to-basket`;
      
      // Enhanced streaming updates with progress
      const statusUpdates = [
        { text: 'Analyzing your text...', progress: 15 },
        { text: 'Extracting ingredients...', progress: 35 },
        { text: 'Searching for products...', progress: 60 },
        { text: 'Finding best matches...', progress: 85 },
        { text: 'Creating your basket...', progress: 95 }
      ];
      
      let statusIndex = 0;
      const statusInterval = setInterval(() => {
        if (statusIndex < statusUpdates.length) {
          setStreamingStatus(statusUpdates[statusIndex].text);
          setLoadingProgress(statusUpdates[statusIndex].progress);
          statusIndex++;
        }
      }, 1000);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          messages: inputText,
          userId: user.id
        })
      });
      
      clearInterval(statusInterval);
      setLoadingProgress(100);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process text');
      }
      
      const data = await response.json();
      setResult(data);
      setStreamingStatus('');
      
      // Dispatch event to update baskets in sidebar
      window.dispatchEvent(new Event('basketUpdated'));
      
    } catch (err) {
      console.error('Error processing chat to basket:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStreamingStatus('');
    } finally {
      setIsProcessing(false);
      setLoadingProgress(0);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!basketName.trim()) {
      setError('Please enter a basket name');
      return;
    }
    
    if (!user) {
      router.push('/auth/login?redirectedFrom=/create-basket');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // Generate basket ID client-side so we can reference it immediately
      const newBasketId = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

      // 1) Create the basket (no RETURNING needed – default behaviour is minimal in supabase-js v2)
      const { error: basketError } = await supabase
        .from('baskets')
        .insert({
          id: newBasketId,
          name: basketName.trim(),
          description: basketDescription.trim() || null,
          is_public: false,
          created_at: new Date().toISOString(),
        }); // Generate types will handle the ID field

      if (basketError) throw basketError;

      // 2) Add the current user as the owner of the basket so RLS policies allow access
      const { error: linkError } = await supabase
        .from('basket_users')
        .insert({
          basket_id: newBasketId,
          user_id: user.id,
          role: 'owner',
          created_at: new Date().toISOString(),
        });

      if (linkError) throw linkError;

      // Dispatch event to update baskets in sidebar
      window.dispatchEvent(new Event('basketUpdated'));
      
      // Redirect to the new basket
      router.push(`/basket/${newBasketId}`);
      
    } catch (err) {
      console.error('Error creating basket:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleViewBasket = () => {
    if (result?.basket_id) {
      router.push(`/basket/${result.basket_id}`);
    }
  };
  
  const handleReset = () => {
    setInputText('');
    setBasketName('');
    setBasketDescription('');
    setResult(null);
    setEditableMatches([]);
    setError(null);
    setStreamingStatus('');
    setOpenAlternatives(null);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };



  const switchToAlternative = useCallback((matchIndex: number, alternative: ProductAlternative) => {
    setIsUpdatingAlternative(true);
    
    const updated = [...editableMatches];
    const currentMatch = updated[matchIndex];
    
    // Create a backup of the current selection to add to alternatives
    const currentAsAlternative: ProductAlternative = {
      product_id: currentMatch.product_id,
      product_name: currentMatch.product_name,
      price: currentMatch.price,
      retailer: currentMatch.retailer,
      image_url: currentMatch.image_url
    };
    
    // Update the current match with the selected alternative
    updated[matchIndex] = {
      ...currentMatch,
      product_id: alternative.product_id,
      product_name: alternative.product_name,
      price: alternative.price,
      retailer: alternative.retailer,
      image_url: alternative.image_url,
      // Update alternatives: remove the selected one and add the previous current one
      alternatives: [
        currentAsAlternative,
        ...(currentMatch.alternatives || []).filter(alt => alt.product_id !== alternative.product_id)
      ]
    };
    
    setEditableMatches(updated);
    setOpenAlternatives(null);
    
    // Update the actual basket item in the database asynchronously without blocking UI
    setTimeout(() => {
      updateBasketItemInDatabase(currentMatch.product_id, alternative.product_id);
      setIsUpdatingAlternative(false);
    }, 100);
  }, [editableMatches]);

  // New function to update basket item in database when alternative is selected
  const updateBasketItemInDatabase = async (oldProductId: string, newProductId: string) => {
    if (!result?.basket_id) return;
    
    try {
      // Get current basket item
      const { data: currentItem, error: fetchError } = await supabase
        .from('basket_items')
        .select('id, quantity, notes')
        .eq('basket_id', result.basket_id)
        .eq('product_id', oldProductId)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Get current price for new product
      const { data: listings, error: listingsError } = await supabase
        .from('listings')
        .select('price')
        .eq('product_id', newProductId)
        .order('price', { ascending: true })
        .limit(1);
      
      if (listingsError) throw listingsError;
      const currentPrice = listings?.[0]?.price || null;
      
      // Update the basket item with new product
      const { error: updateError } = await supabase
        .from('basket_items')
        .update({
          product_id: newProductId,
          price_at_add: currentPrice,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentItem.id);
      
      if (updateError) throw updateError;
      
    } catch (err) {
      console.error('Failed to update basket item in database:', err);
      // Don't show error to user as the UI state is already updated
      // The discrepancy will be resolved on next page load
    }
  };

  const handleUpdateQuantity = async (matchIndex: number, newQuantity: number) => {
    if (!result?.basket_id) return;
    
    try {
      const match = editableMatches[matchIndex];
      if (!match) return;

      // Update in database
      const { error } = await supabase
        .from('basket_items')
        .update({
          quantity: newQuantity,
          updated_at: new Date().toISOString()
        })
        .eq('basket_id', result.basket_id)
        .eq('product_id', match.product_id);
      
      if (error) throw error;

      // Update local state
      const updatedMatches = [...editableMatches];
      updatedMatches[matchIndex] = { ...match, quantity: newQuantity };
      setEditableMatches(updatedMatches);
      
    } catch (err) {
      console.error('Failed to update quantity:', err);
    }
  };

  const handleDeleteProduct = async (matchIndex: number) => {
    if (!result?.basket_id) return;
    
    try {
      const match = editableMatches[matchIndex];
      if (!match) return;

      // Remove from database
      const { error } = await supabase
        .from('basket_items')
        .delete()
        .eq('basket_id', result.basket_id)
        .eq('product_id', match.product_id);
      
      if (error) throw error;

      // Update local state
      const updatedMatches = editableMatches.filter((_, i) => i !== matchIndex);
      setEditableMatches(updatedMatches);
      
    } catch (err) {
      console.error('Failed to delete product:', err);
    }
  };

  // Enhanced Loading Component
  const LoadingScreen = () => (
    <div className="chat-loading-indicator">
      <div className="flex flex-col items-center space-y-6">
        {/* Animated Logo/Spinner */}
        <div className="relative">
          <div className="chat-loading-spinner"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <svg 
              className="w-8 h-8 text-primary"
              fill="currentColor" 
              viewBox="0 0 24 24"
            >
              <path d="M17,18C17.56,18 18,18.44 18,19C18,19.56 17.56,20 17,20C16.44,20 16,19.56 16,19C16,18.44 16.44,18 17,18M1,2V4H3L6.6,11.59L5.24,14.04C5.09,14.32 5,14.65 5,15A3,3 0 0,0 8,18H19V16H8A1,1 0 0,1 7,15L8.1,13H15.55C16.3,13 16.96,12.58 17.3,11.97L20.88,5H6.14L5.27,3H1M7,18C7.56,18 8,18.44 8,19C8,19.56 7.56,20 7,20C6.44,20 6,19.56 6,19C6,18.44 6.44,18 7,18Z"/>
            </svg>
          </div>
        </div>
        
        {/* Status Text */}
        <div className="text-center space-y-2">
          <div className="text-lg font-semibold text-text">{streamingStatus}</div>
          
          {/* Progress Bar */}
          <div className="chat-progress-bar">
            <div 
              className="chat-progress-value"
              style={{ width: `${loadingProgress}%` }}
            ></div>
          </div>
          
          <div className="text-sm text-muted">{loadingProgress}% complete</div>
        </div>
      </div>
    </div>
  );





  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Create Basket</h1>
      
      <div className="card-enhanced mb-6">
        {/* Mode Toggle */}
        <div className="flex justify-center mb-6">
          <div className="flex bg-muted rounded-lg p-1">
            <button
              onClick={() => {
                setMode('chat');
                setError(null);
              }}
              className={`px-4 py-2 rounded-md transition-all ${
                mode === 'chat' 
                  ? 'bg-primary text-dark-text' 
                  : 'text-muted hover:text-text'
              }`}
              style={mode === 'chat' ? { backgroundColor: 'var(--primary)', color: 'var(--dark-text)' } : {}}
            >
              Smart Creation
            </button>
            <button
              onClick={() => {
                setMode('manual');
                setError(null);
              }}
              className={`px-4 py-2 rounded-md transition-all ${
                mode === 'manual' 
                  ? 'bg-primary text-dark-text' 
                  : 'text-muted hover:text-text'
              }`}
              style={mode === 'manual' ? { backgroundColor: 'var(--primary)', color: 'var(--dark-text)' } : {}}
            >
              Manual Creation
            </button>
          </div>
        </div>

        {mode === 'chat' ? (
          <p className="mb-4 text-muted text-center">
            Paste any food-related text, recipe, or shopping list and we&apos;ll automatically create a basket with matching products.
          </p>
        ) : (
          <p className="mb-4 text-muted text-center">
            Create an empty basket that you can manually add products to.
          </p>
        )}
        
        {error && (
          <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: 'var(--error-bg)', color: 'var(--error-text)', border: '1px solid var(--error-border)' }}>
            {error}
          </div>
        )}

        {/* Loading Screen */}
        {streamingStatus && <LoadingScreen />}
        
        {!result && !streamingStatus ? (
          <form onSubmit={mode === 'chat' ? handleChatSubmit : handleManualSubmit}>
            <div className="mb-4">
              {mode === 'chat' ? (
                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    className="input-enhanced gradient-border-textarea enhanced-chat-input"
                    placeholder="Paste your recipe, ingredient list, or any text here..."
                    disabled={isProcessing}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <input
                      type="text"
                      value={basketName}
                      onChange={(e) => setBasketName(e.target.value)}
                      className="input-enhanced w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      placeholder="Enter basket name (e.g., 'Weekly Groceries', 'Dinner Party Shopping')"
                      disabled={isProcessing}
                    />
                  </div>
                  <div className="relative">
                    <textarea
                      value={basketDescription}
                      onChange={(e) => setBasketDescription(e.target.value)}
                      className="input-enhanced gradient-border-textarea w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-text placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                      rows={8}
                      placeholder="Enter basket description (optional)..."
                      disabled={isProcessing}
                    />
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex justify-center">
              <button
                type="submit"
                disabled={isProcessing || (mode === 'chat' ? !inputText.trim() : !basketName.trim())}
                className="btn-base bg-primary text-dark-text px-12 py-4 text-lg rounded-lg disabled:opacity-50 flex items-center gap-3"
                style={{ background: 'var(--primary)', color: 'var(--dark-text)' }}
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {mode === 'chat' ? 'Processing...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mode === 'chat' ? "M13 10V3L4 14h7v7l9-11h-7z" : "M12 6v6m0 0v6m0-6h6m-6 0H6"} />
                    </svg>
                    {mode === 'chat' ? 'Create Smart Basket' : 'Create Basket'}
                  </>
                )}
              </button>
            </div>
          </form>
        ) : result ? (
          <CompletionScreen 
            result={result}
            matches={editableMatches}
            isUpdating={isUpdatingAlternative} 
            openAlternatives={openAlternatives}
            onSetOpenAlternatives={setOpenAlternatives}
            onSwitchToAlternative={switchToAlternative}
            onUpdateQuantity={handleUpdateQuantity}
            onDeleteProduct={handleDeleteProduct}
            onViewBasket={handleViewBasket}
            onReset={handleReset}
          />
        ) : null}
      </div>
    </div>
  );
}
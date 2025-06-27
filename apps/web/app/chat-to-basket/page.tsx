'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '~/lib/auth';
import { supabase } from '~/lib/supabaseClient';

interface Ingredient {
  name: string;
  quantity: number | null;
  unit: string | null;
}

interface ProductMatch {
  ingredient: string;
  product_id: string;
  product_name: string;
  confidence: 'high' | 'medium' | 'low';
  quantity: number;
  unit: string | null;
}

interface ChatToBasketResponse {
  basket_id: string;
  matches: ProductMatch[];
  unmatched: string[];
  summary: string;
}

export default function ChatToBasketPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ChatToBasketResponse | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login?redirectedFrom=/chat-to-basket');
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputText.trim()) {
      setError('Please enter some text to process');
      return;
    }
    
    if (!user) {
      router.push('/auth/login?redirectedFrom=/chat-to-basket');
      return;
    }
    
    setIsProcessing(true);
    setError(null);
    
    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat-to-basket`;
      
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
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process text');
      }
      
      const data = await response.json();
      setResult(data);
      
      // Dispatch event to update baskets in sidebar
      window.dispatchEvent(new Event('basketUpdated'));
      
    } catch (err) {
      console.error('Error processing chat to basket:', err);
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
    setResult(null);
    setError(null);
    if (textareaRef.current) {
      textareaRef.current.focus();
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

  if (!user) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Chat to Basket</h1>
      
      <div className="bg-surface p-6 rounded-lg shadow-sm mb-6">
        <p className="mb-4">
          Paste any food-related text, recipe, or shopping list and we'll automatically create a basket with matching products.
        </p>
        
        {error && (
          <div className="mb-6 p-4 bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 rounded-lg">
            {error}
          </div>
        )}
        
        {!result ? (
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="w-full p-4 border border-gray-300 dark:border-gray-700 rounded-lg bg-background min-h-[200px]"
                placeholder="Paste your recipe, ingredient list, or any food-related text here..."
                disabled={isProcessing}
              />
            </div>
            
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isProcessing || !inputText.trim()}
                className="bg-primary text-buttonText px-6 py-3 rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Create Basket
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div>
            <div className="mb-6 p-4 bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300 rounded-lg">
              <h3 className="font-bold text-lg mb-2">Basket Created!</h3>
              <p>{result.summary}</p>
            </div>
            
            <div className="mb-6">
              <h3 className="font-semibold text-lg mb-3">Matched Products ({result.matches.length})</h3>
              {result.matches.length > 0 ? (
                <div className="bg-background border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Ingredient</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Product</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Quantity</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Confidence</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                      {result.matches.map((match, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">{match.ingredient}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{match.product_name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {match.quantity} {match.unit || ''}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              match.confidence === 'high' 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' 
                                : match.confidence === 'medium'
                                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                            }`}>
                              {match.confidence}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">No products were matched.</p>
              )}
            </div>
            
            {result.unmatched.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-lg mb-3">Unmatched Ingredients ({result.unmatched.length})</h3>
                <div className="bg-background border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <ul className="list-disc pl-5 space-y-1">
                    {result.unmatched.map((item, index) => (
                      <li key={index} className="text-gray-600 dark:text-gray-400">{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            
            <div className="flex justify-end space-x-4">
              <button
                onClick={handleReset}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Start Over
              </button>
              <button
                onClick={handleViewBasket}
                className="bg-primary text-buttonText px-6 py-2 rounded-lg hover:bg-opacity-90 transition-colors flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                View Basket
              </button>
            </div>
          </div>
        )}
      </div>
      
      <div className="bg-surface p-6 rounded-lg shadow-sm">
        <h2 className="text-xl font-bold mb-4">How It Works</h2>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold flex-shrink-0">1</div>
            <div>
              <h3 className="font-medium">Paste Your Text</h3>
              <p className="text-gray-600 dark:text-gray-400">Paste any recipe, ingredient list, or food-related text.</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold flex-shrink-0">2</div>
            <div>
              <h3 className="font-medium">Automatic Extraction</h3>
              <p className="text-gray-600 dark:text-gray-400">Our system identifies ingredients, quantities, and units.</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold flex-shrink-0">3</div>
            <div>
              <h3 className="font-medium">Product Matching</h3>
              <p className="text-gray-600 dark:text-gray-400">We match ingredients to real products from our database.</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold flex-shrink-0">4</div>
            <div>
              <h3 className="font-medium">Basket Creation</h3>
              <p className="text-gray-600 dark:text-gray-400">A new basket is created with all matched products ready for shopping.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
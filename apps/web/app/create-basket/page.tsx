'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '~/lib/auth';
import { supabase } from '~/lib/supabaseClient';



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

export default function CreateBasketPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<'chat' | 'manual'>('chat');
  const [inputText, setInputText] = useState('');
  const [basketName, setBasketName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ChatToBasketResponse | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login?redirectedFrom=/create-basket');
    }
  }, [user, authLoading, router]);

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
      const { data, error } = await supabase
        .from('baskets')
        .insert([
          {
            name: basketName.trim(),
            user_id: user.id,
            created_at: new Date().toISOString()
          }
        ])
        .select()
        .single();
      
      if (error) throw error;
      
      // Dispatch event to update baskets in sidebar
      window.dispatchEvent(new Event('basketUpdated'));
      
      // Redirect to the new basket
      router.push(`/basket/${data.id}`);
      
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
            Paste any food-related text, recipe, or shopping list and we'll automatically create a basket with matching products.
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
        
        {!result ? (
          <form onSubmit={mode === 'chat' ? handleChatSubmit : handleManualSubmit}>
            <div className="mb-4">
              {mode === 'chat' ? (
                <div className="relative">
                  <textarea
                    ref={textareaRef}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    className="input-enhanced gradient-border-textarea min-h-[200px] relative z-10"
                    placeholder="Paste your recipe, ingredient list, or any food-related text here..."
                    disabled={isProcessing}
                  />
                </div>
              ) : (
                <input
                  type="text"
                  value={basketName}
                  onChange={(e) => setBasketName(e.target.value)}
                  className="input-enhanced gradient-border-textarea"
                  placeholder="Enter basket name (e.g., &apos;Weekly Groceries&apos;, &apos;Dinner Party Shopping&apos;)"
                  disabled={isProcessing}
                />
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
        ) : (
          <div>
            <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-border)' }}>
              <h3 className="font-bold text-lg mb-2">Basket Created!</h3>
              <p>{result.summary}</p>
            </div>
            
            <div className="mb-6">
              <h3 className="font-semibold text-lg mb-3">Matched Products ({result.matches.length})</h3>
              {result.matches.length > 0 ? (
                <div className="rounded-lg overflow-hidden border-primary" style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border-primary)' }}>
                  <table className="min-w-full table-divider">
                    <thead className="table-header">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Ingredient</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Product</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Quantity</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Confidence</th>
                      </tr>
                    </thead>
                    <tbody className="table-divider" style={{ backgroundColor: 'var(--background)' }}>
                      {result.matches.map((match, index) => (
                        <tr key={index} className="table-row">
                          <td className="px-6 py-4 whitespace-nowrap text-sm">{match.ingredient}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{match.product_name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            {match.quantity} {match.unit || ''}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`status-badge ${
                              match.confidence === 'high' 
                                ? 'success' 
                                : match.confidence === 'medium'
                                ? 'warning'
                                : 'error'
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
                <p className="text-muted">No products were matched.</p>
              )}
            </div>
            
            {result.unmatched.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-lg mb-3">Unmatched Ingredients ({result.unmatched.length})</h3>
                <div className="rounded-lg p-4 border-primary" style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border-primary)' }}>
                  <ul className="list-disc pl-5 space-y-1">
                    {result.unmatched.map((item, index) => (
                      <li key={index} className="text-muted">{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            
            <div className="flex justify-end space-x-4">
              <button
                onClick={handleReset}
                className="modal-button"
              >
                Start Over
              </button>
              <button
                onClick={handleViewBasket}
                className="btn-base px-6 py-2 rounded-lg flex items-center gap-2"
                style={{ background: 'var(--primary)', color: 'var(--dark-text)' }}
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
      

    </div>
  );
}
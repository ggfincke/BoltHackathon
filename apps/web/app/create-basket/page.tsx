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
  confidence_reason: string;
  quantity: number;
  unit: string | null;
  alternatives?: {
    product_id: string;
    product_name: string;
    confidence: 'high' | 'medium' | 'low';
  }[];
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
  const [editableMatches, setEditableMatches] = useState<ProductMatch[]>([]);
  const [streamingStatus, setStreamingStatus] = useState<string>('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth/login?redirectedFrom=/create-basket');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (result) {
      setEditableMatches([...result.matches]);
    }
  }, [result]);

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
    setStreamingStatus('Analyzing your text...');
    
    try {
      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat-to-basket`;
      
      // Simulate streaming updates
      const statusUpdates = [
        'Extracting ingredients...',
        'Searching for products...',
        'Finding best matches...',
        'Creating your basket...'
      ];
      
      let statusIndex = 0;
      const statusInterval = setInterval(() => {
        if (statusIndex < statusUpdates.length) {
          setStreamingStatus(statusUpdates[statusIndex]);
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
    setEditableMatches([]);
    setError(null);
    setStreamingStatus('');
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const updateMatchQuantity = (index: number, newQuantity: number) => {
    const updated = [...editableMatches];
    updated[index].quantity = Math.max(1, newQuantity);
    setEditableMatches(updated);
  };

  const removeMatch = (index: number) => {
    const updated = editableMatches.filter((_, i) => i !== index);
    setEditableMatches(updated);
  };

  const replaceMatch = (index: number, alternativeId: string, alternativeName: string) => {
    const updated = [...editableMatches];
    updated[index].product_id = alternativeId;
    updated[index].product_name = alternativeName;
    setEditableMatches(updated);
  };

  const getConfidenceBadgeColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'low': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
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

        {streamingStatus && (
          <div className="mb-6 p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-600"></div>
              {streamingStatus}
            </div>
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
                    className="input-enhanced gradient-border-textarea min-h-[250px] relative z-10"
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
                  placeholder="Enter basket name (e.g., 'Weekly Groceries', 'Dinner Party Shopping')"
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
              <h3 className="font-semibold text-lg mb-3">Matched Products ({editableMatches.length})</h3>
              {editableMatches.length > 0 ? (
                <div className="space-y-4">
                  {editableMatches.map((match, index) => (
                    <div key={index} className="border rounded-lg p-4" style={{ borderColor: 'var(--border-primary)' }}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{match.ingredient}</span>
                            <span className="text-sm text-muted">→</span>
                            <span className="font-medium text-primary">{match.product_name}</span>
                          </div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getConfidenceBadgeColor(match.confidence)}`}>
                              {match.confidence} confidence
                            </span>
                            <span className="text-xs text-muted" title={match.confidence_reason}>
                              {match.confidence_reason}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => removeMatch(index)}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Remove item"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium">Quantity:</label>
                          <input
                            type="number"
                            min="1"
                            value={match.quantity}
                            onChange={(e) => updateMatchQuantity(index, parseInt(e.target.value) || 1)}
                            className="w-20 px-2 py-1 border rounded text-sm"
                            style={{ borderColor: 'var(--border-primary)' }}
                          />
                          {match.unit && <span className="text-sm text-muted">{match.unit}</span>}
                        </div>
                        
                        {match.alternatives && match.alternatives.length > 0 && (
                          <div className="flex items-center gap-2">
                            <label className="text-sm font-medium">Alternatives:</label>
                            <select
                              onChange={(e) => {
                                const alt = match.alternatives?.find(a => a.product_id === e.target.value);
                                if (alt) {
                                  replaceMatch(index, alt.product_id, alt.product_name);
                                }
                              }}
                              className="px-2 py-1 border rounded text-sm"
                              style={{ borderColor: 'var(--border-primary)' }}
                            >
                              <option value="">Switch to...</option>
                              {match.alternatives.map((alt, altIndex) => (
                                <option key={altIndex} value={alt.product_id}>
                                  {alt.product_name} ({alt.confidence})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
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
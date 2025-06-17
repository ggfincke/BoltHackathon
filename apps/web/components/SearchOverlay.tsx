import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '~/lib/supabaseClient';
import { SearchIcon } from '~/components/Icons';

type SearchResult = {
  id: string;
  name: string;
  slug: string;
  image_url?: string;
};

export default function SearchOverlay({ 
  isOpen, 
  onClose,
  initialQuery = ''
}: { 
  isOpen: boolean; 
  onClose: () => void;
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  
  // Focus input when overlay opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);
  
  // Close on escape key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    document.addEventListener('keydown', handleEsc as any);
    return () => document.removeEventListener('keydown', handleEsc as any);
  }, [onClose]);
  
  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        // Search products table
        const { data, error } = await supabase
          .from('products')
          .select('id, name, slug')
          .ilike('name', `%${query}%`)
          .limit(8);
        
        if (error) throw error;
        setResults(data || []);
      } catch (error) {
        console.error('Error searching products:', error);
      } finally {
        setIsLoading(false);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [query]);
  
  // Handle search submission
  const handleSearch = () => {
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      onClose();
    }
  };
  
  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex flex-col">
      <div className="container mx-auto pt-20 px-4">
        <div className="relative">
          {/* Close button */}
          <button 
            onClick={onClose}
            className="absolute right-0 top-0 p-2 text-text hover:text-primary transition-colors"
            aria-label="Close search"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          {/* Search input */}
          <div className="flex items-center border-b-2 border-primary pb-2">
            <SearchIcon className="w-6 h-6 text-primary mr-2" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search products..."
              className="w-full bg-transparent border-none outline-none text-xl"
              autoFocus
            />
            <button 
              onClick={handleSearch}
              className="bg-primary text-buttonText px-4 py-2 rounded-md hover:bg-opacity-90 transition-colors ml-4"
            >
              Search
            </button>
          </div>
          
          {/* Results */}
          {query.trim() && (
            <div className="mt-4">
              {isLoading ? (
                <div className="py-4 text-center">Searching...</div>
              ) : results.length > 0 ? (
                <ul className="bg-surface rounded-lg shadow-lg overflow-hidden">
                  {results.map((result) => (
                    <li key={result.id} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                      <button
                        onClick={() => {
                          router.push(`/search?q=${encodeURIComponent(result.name)}`);
                          onClose();
                        }}
                        className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{result.name}</p>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-gray-400">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                query.length > 2 && (
                  <div className="py-4 text-center text-gray-500 dark:text-gray-400">
                    No results found for "{query}"
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
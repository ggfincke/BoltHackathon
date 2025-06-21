import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '~/lib/supabaseClient';
import { SearchIcon } from '~/components/Icons';
import { FiX } from 'react-icons/fi';

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
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  
  // Focus input when overlay opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      
      // Load recent searches from localStorage
      const savedSearches = localStorage.getItem('recentSearches');
      if (savedSearches) {
        setRecentSearches(JSON.parse(savedSearches));
      }
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
      // Save to recent searches
      const updatedSearches = [
        query.trim(),
        ...recentSearches.filter(s => s !== query.trim())
      ].slice(0, 5);
      
      setRecentSearches(updatedSearches);
      localStorage.setItem('recentSearches', JSON.stringify(updatedSearches));
      
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
  
  // Handle recent search click
  const handleRecentSearchClick = (search: string) => {
    setQuery(search);
    router.push(`/search?q=${encodeURIComponent(search)}`);
    onClose();
  };
  
  // Clear recent searches
  const clearRecentSearches = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches([]);
    localStorage.removeItem('recentSearches');
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex flex-col animate-fade-in">
      <div className="container mx-auto pt-20 px-4">
        <div className="relative max-w-3xl mx-auto">
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
              className="flex-1 bg-transparent border-none outline-none text-xl"
              autoFocus
            />
            <button 
              onClick={handleSearch}
              className="bg-primary text-buttonText px-4 py-2 rounded-md hover:bg-opacity-90 transition-colors ml-2"
            >
              Search
            </button>
            
            {/* Close button */}
            <button 
              onClick={onClose}
              className="p-2 text-text hover:text-primary transition-colors ml-4"
              aria-label="Close search"
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>
          
          {/* Results */}
          <div className="mt-4">
            {query.trim() ? (
              isLoading ? (
                <div className="py-8 flex justify-center items-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : results.length > 0 ? (
                <div className="bg-surface rounded-lg shadow-lg overflow-hidden animate-slide-up">
                  <h3 className="px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    Products
                  </h3>
                  <ul>
                    {results.map((result) => (
                      <li key={result.id} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                        <button
                          onClick={() => {
                            router.push(`/product/${result.slug}`);
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
                </div>
              ) : (
                query.length > 2 && (
                  <div className="py-8 text-center text-gray-500 dark:text-gray-400 animate-slide-up">
                    <p className="text-lg mb-2">No results found for "{query}"</p>
                    <p className="text-sm">Try a different search term or browse categories</p>
                  </div>
                )
              )
            ) : recentSearches.length > 0 ? (
              <div className="bg-surface rounded-lg shadow-lg overflow-hidden animate-slide-up">
                <div className="px-4 py-2 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Recent Searches</h3>
                  <button 
                    onClick={clearRecentSearches}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                  >
                    Clear
                  </button>
                </div>
                <ul>
                  {recentSearches.map((search, index) => (
                    <li key={index} className="border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                      <button
                        onClick={() => handleRecentSearchClick(search)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center"
                      >
                        <SearchIcon className="w-4 h-4 text-gray-400 mr-3" />
                        <span>{search}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="py-8 text-center text-gray-500 dark:text-gray-400 animate-slide-up">
                <p className="text-lg mb-2">Start typing to search</p>
                <p className="text-sm">Search for products across multiple retailers</p>
              </div>
            )}
          </div>
          
          {/* Popular categories */}
          {!query.trim() && (
            <div className="mt-8 animate-slide-up">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">Popular Categories</h3>
              <div className="flex flex-wrap gap-2">
                {['Beverages', 'Snacks', 'Dairy', 'Produce', 'Frozen Foods', 'Bakery'].map((category) => (
                  <button
                    key={category}
                    onClick={() => {
                      router.push(`/categories/${category.toLowerCase().replace(' ', '-')}`);
                      onClose();
                    }}
                    className="px-3 py-1.5 bg-gray-200 dark:bg-gray-800 rounded-full text-sm hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '~/lib/supabaseClient';
import { SearchIcon } from '~/components/ui/Icons';

type SearchResult = {
  id: string;
  name: string;
  slug: string;
  image_url?: string;
};

interface SearchDropdownProps {
  className?: string;
}

export default function SearchDropdown({ className = '' }: SearchDropdownProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  
  // Load recent searches on mount
  useEffect(() => {
    const savedSearches = localStorage.getItem('recentSearches');
    if (savedSearches) {
      setRecentSearches(JSON.parse(savedSearches));
    }
  }, []);
  
  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, name, slug')
          .ilike('name', `%${query}%`)
          .limit(8);
        
        if (error) throw error;
        setResults(data || []);
      } catch (error) {
        console.error('Error searching products:', error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [query]);
  
  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Handle search submission
  const handleSearch = (searchQuery?: string) => {
    const finalQuery = searchQuery || query;
    if (finalQuery.trim()) {
      // Save to recent searches
      const updatedSearches = [
        finalQuery.trim(),
        ...recentSearches.filter(s => s !== finalQuery.trim())
      ].slice(0, 5);
      
      setRecentSearches(updatedSearches);
      localStorage.setItem('recentSearches', JSON.stringify(updatedSearches));
      
      router.push(`/search?q=${encodeURIComponent(finalQuery.trim())}`);
      setIsOpen(false);
      setQuery('');
      inputRef.current?.blur();
    }
  };
  
  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const totalItems = results.length + recentSearches.length;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < totalItems - 1 ? prev + 1 : -1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > -1 ? prev - 1 : totalItems - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          if (selectedIndex < results.length) {
            // Navigate to product
            const product = results[selectedIndex];
            router.push(`/product/${product.slug}`);
            setIsOpen(false);
            setQuery('');
            inputRef.current?.blur();
          } else {
            // Use recent search
            const recentIndex = selectedIndex - results.length;
            handleSearch(recentSearches[recentIndex]);
          }
        } else {
          handleSearch();
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };
  
  // Handle recent search click
  const handleRecentSearchClick = (search: string) => {
    setQuery(search);
    handleSearch(search);
  };
  
  // Handle product click
  const handleProductClick = (product: SearchResult) => {
    router.push(`/product/${product.slug}`);
    setIsOpen(false);
    setQuery('');
    inputRef.current?.blur();
  };
  
  // Clear recent searches
  const clearRecentSearches = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches([]);
    localStorage.removeItem('recentSearches');
  };
  
  const showDropdown = isOpen && (query.trim() || recentSearches.length > 0);
  
  return (
    <div className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search products..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          autoComplete="off"
        />
      </div>
      
      {/* Dropdown */}
      {showDropdown && (
        <div 
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-background border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto"
        >
          {/* Loading state */}
          {isLoading && query.trim() && (
            <div className="px-4 py-3 text-center text-gray-500">
              <div className="inline-flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-primary"></div>
                Searching...
              </div>
            </div>
          )}
          
          {/* Search Results */}
          {!isLoading && query.trim() && results.length > 0 && (
            <div>
              <div className="px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                Products
              </div>
              {results.map((result, index) => (
                <button
                  key={result.id}
                  onClick={() => handleProductClick(result)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-3 ${
                    selectedIndex === index ? 'bg-gray-100 dark:bg-gray-800' : ''
                  }`}
                >
                  <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center flex-shrink-0">
                    <SearchIcon className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{result.name}</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
            </div>
          )}
          
          {/* No Results */}
          {!isLoading && query.trim() && results.length === 0 && query.length > 2 && (
            <div className="px-4 py-6 text-center text-gray-500">
              <p className="text-sm mb-2">No results found for "{query}"</p>
              <p className="text-xs">Try a different search term or browse categories</p>
            </div>
          )}
          
          {/* Recent Searches */}
          {recentSearches.length > 0 && (!query.trim() || results.length > 0) && (
            <div className={query.trim() && results.length > 0 ? 'border-t border-gray-200 dark:border-gray-700' : ''}>
              <div className="px-3 py-2 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Recent Searches</span>
                <button 
                  onClick={clearRecentSearches}
                  className="text-xs text-primary hover:text-primary-dark"
                >
                  Clear
                </button>
              </div>
              {recentSearches.map((search, index) => {
                const adjustedIndex = results.length + index;
                return (
                  <button
                    key={index}
                    onClick={() => handleRecentSearchClick(search)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center gap-3 ${
                      selectedIndex === adjustedIndex ? 'bg-gray-100 dark:bg-gray-800' : ''
                    }`}
                  >
                    <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm">{search}</span>
                  </button>
                );
              })}
            </div>
          )}
          
          {/* Empty state */}
          {!query.trim() && recentSearches.length === 0 && (
            <div className="px-4 py-6 text-center text-gray-500">
              <SearchIcon className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p className="text-sm">Start typing to search products</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
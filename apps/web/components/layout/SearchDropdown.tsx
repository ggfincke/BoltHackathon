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
        <div 
          className="absolute left-3 top-1/2 transform -translate-y-1/2 transition-colors duration-200"
          style={{ color: isOpen ? 'var(--primary)' : 'var(--text)' }}
        >
          <SearchIcon className="w-5 h-5" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search products..."
          className="w-full pl-10 pr-4 py-2 border rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
          style={{
            background: 'var(--background)',
            borderColor: isOpen ? 'var(--primary)' : 'var(--surface)',
            color: 'var(--text)',
            boxShadow: isOpen ? `0 0 0 2px rgba(133, 209, 231, 0.2)` : 'none'
          }}
          autoComplete="off"
        />
      </div>
      
      {/* Dropdown with blur & gradient effects */}
      {showDropdown && (
        <>
          {/* Backdrop for mobile */}
          <div className="fixed inset-0 z-40 md:hidden bg-black/40 backdrop-blur-md" onClick={() => setIsOpen(false)} />
          
          <div 
            ref={dropdownRef}
            className="absolute top-full left-0 right-0 mt-1 rounded-xl shadow-2xl z-50 max-h-96 overflow-y-auto backdrop-blur-xl border"
            style={{
              background: 'rgba(var(--background-rgb), 0.85)',
              borderColor: 'var(--surface)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(var(--background-rgb), 0.05)'
            }}
          >
            {/* Loading state */}
            {isLoading && query.trim() && (
              <div 
                className="px-4 py-4 text-center"
                style={{ 
                  background: 'var(--surface)',
                  color: 'var(--text)'
                }}
              >
                <div className="inline-flex items-center gap-2">
                  <div 
                    className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2"
                    style={{ borderColor: 'var(--primary)' }}
                  ></div>
                  <span className="font-medium">Searching...</span>
                </div>
              </div>
            )}
            
            {/* Search Results */}
            {!isLoading && query.trim() && results.length > 0 && (
              <div>
                <div 
                  className="px-4 py-3 text-xs font-medium border-b"
                  style={{
                    background: `linear-gradient(135deg, var(--surface), var(--background))`,
                    color: 'var(--text)',
                    borderBottomColor: 'var(--surface)'
                  }}
                >
                  Products
                </div>
                {results.map((result, index) => (
                  <button
                    key={result.id}
                    onClick={() => handleProductClick(result)}
                    className={`w-full text-left px-4 py-3 transition-all duration-200 hover:translate-x-1 hover:shadow-md flex items-center gap-3 border-l-2 border-transparent`}
                    style={{
                      background: selectedIndex === index 
                        ? 'var(--bg-hover)'
                        : 'var(--surface)',
                      color: 'var(--text)',
                      borderLeftColor: selectedIndex === index ? 'var(--primary)' : 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      if (selectedIndex !== index) {
                        e.currentTarget.style.background = 'var(--bg-hover)'
                        e.currentTarget.style.borderLeftColor = 'var(--primary)'
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedIndex !== index) {
                        e.currentTarget.style.background = 'var(--surface)'
                        e.currentTarget.style.borderLeftColor = 'transparent'
                      }
                    }}
                  >
                    <div 
                      className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
                      style={{ background: 'var(--background)' }}
                    >
                      <div style={{ color: 'var(--primary)' }}>
                        <SearchIcon className="w-4 h-4" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{result.name}</p>
                    </div>
                    <svg 
                      className="w-4 h-4 flex-shrink-0 opacity-60" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                ))}
              </div>
            )}
            
            {/* No Results */}
            {!isLoading && query.trim() && results.length === 0 && query.length > 2 && (
              <div 
                className="px-4 py-6 text-center"
                style={{ 
                  background: 'var(--surface)',
                  color: 'var(--text)'
                }}
              >
                <div 
                  className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
                  style={{ background: 'var(--background)' }}
                >
                  <div style={{ color: 'var(--primary)' }}>
                    <SearchIcon className="w-6 h-6" />
                  </div>
                </div>
                <p className="text-sm mb-2 font-medium">No results found for "{query}"</p>
                <p className="text-xs opacity-60">Try a different search term or browse categories</p>
              </div>
            )}
            
            {/* Recent Searches */}
            {recentSearches.length > 0 && (!query.trim() || results.length > 0) && (
              <div className={query.trim() && results.length > 0 ? 'border-t' : ''} style={{ borderTopColor: 'var(--surface)' }}>
                <div 
                  className="px-4 py-3 flex justify-between items-center border-b"
                  style={{
                    background: `linear-gradient(135deg, var(--surface), var(--background))`,
                    borderBottomColor: 'var(--surface)'
                  }}
                >
                  <span className="text-xs font-medium" style={{ color: 'var(--text)' }}>Recent Searches</span>
                  <button 
                    onClick={clearRecentSearches}
                    className="text-xs font-medium transition-colors duration-200"
                    style={{ color: 'var(--primary)' }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--secondary)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--primary)'
                    }}
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
                      className={`w-full text-left px-4 py-3 transition-all duration-200 hover:translate-x-1 hover:shadow-md flex items-center gap-3 border-l-2 border-transparent`}
                      style={{
                        background: selectedIndex === adjustedIndex 
                          ? 'var(--bg-hover)'
                          : 'var(--surface)',
                        color: 'var(--text)',
                        borderLeftColor: selectedIndex === adjustedIndex ? 'var(--primary)' : 'transparent'
                      }}
                      onMouseEnter={(e) => {
                        if (selectedIndex !== adjustedIndex) {
                          e.currentTarget.style.background = 'var(--bg-hover)'
                          e.currentTarget.style.borderLeftColor = 'var(--primary)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedIndex !== adjustedIndex) {
                          e.currentTarget.style.background = 'var(--surface)'
                          e.currentTarget.style.borderLeftColor = 'transparent'
                        }
                      }}
                    >
                      <svg 
                        className="w-4 h-4 flex-shrink-0 opacity-60" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-sm font-medium">{search}</span>
                    </button>
                  );
                })}
              </div>
            )}
            
            {/* Empty state */}
            {!query.trim() && recentSearches.length === 0 && (
              <div 
                className="px-4 py-6 text-center"
                style={{ 
                  background: 'var(--surface)',
                  color: 'var(--text)'
                }}
              >
                <div 
                  className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center text-white"
                  style={{ background: `linear-gradient(135deg, var(--primary), var(--secondary))` }}
                >
                  <SearchIcon className="w-6 h-6" />
                </div>
                <p className="text-sm font-medium">Start typing to search products</p>
                <p className="text-xs opacity-60 mt-1">Find amazing deals on your favorite items</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
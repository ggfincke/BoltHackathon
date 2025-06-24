'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { LogoIcon, SearchIcon } from '../ui/Icons';
import ProfileDropdown from './ProfileDropdown';
import { useAuth } from '~/lib/auth';
import SearchOverlay from './SearchOverlay';
import NotificationCenter from '../shared/NotificationCenter';
import ThemeToggle from '../ui/ThemeToggle';

export default function NavBar() {
  const { user } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Handle scroll effect for navbar
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/search?q=${encodeURIComponent(searchQuery.trim())}`;
    }
  };

  const handleSearchFocus = () => {
    setSearchOpen(true);
  };

  return (
    <>
      <header 
        className="fixed top-0 left-0 right-0 z-50"
        style={{
          backgroundColor: scrolled ? 'rgba(var(--background-rgb), 0.95)' : 'var(--background)',
          backdropFilter: scrolled ? 'blur(8px)' : 'none',
          borderBottom: '1px solid rgba(133, 209, 231, 0.2)',
          boxShadow: scrolled ? '0 2px 10px rgba(0,0,0,0.1)' : 'none'
        }}
      >
        <div className="flex items-center justify-between h-16 px-4">
          {/* Logo */}
          <div className="flex items-center flex-shrink-0">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl" style={{color: 'var(--text)'}}>
              <LogoIcon className="w-7 h-7" />
              <span className="hidden sm:inline">TrackBasket</span>
            </Link>
          </div>
          
          {/* Search Bar */}
          <div className="flex-1 max-w-2xl mx-4">
            <form onSubmit={handleSearchSubmit} className="relative">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={handleSearchFocus}
                  placeholder="Search products..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </form>
          </div>
          
          {/* Right Side Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Notification Center (if logged in) */}
            {user && (
              <div style={{color: 'var(--text)'}}>
                <NotificationCenter />
              </div>
            )}
            
            {/* Theme Toggle */}
            <div style={{color: 'var(--text)'}}>
              <ThemeToggle />
            </div>
            
            {/* User Profile / Login */}
            {user ? (
              <div style={{color: 'var(--text)'}}>
                <ProfileDropdown />
              </div>
            ) : (
              <Link
                href="/auth/login"
                className="flex items-center gap-1.5 px-3 py-2 rounded-md"
                style={{color: 'var(--text)'}}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(133, 209, 231, 0.1)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <span className="hidden md:inline">Login</span>
              </Link>
            )}
          </div>
        </div>
      </header>
      
      {/* Search Overlay */}
      <SearchOverlay 
        isOpen={searchOpen} 
        onClose={() => setSearchOpen(false)}
        initialQuery={searchQuery}
      />
    </>
  );
}
'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { LogoIcon } from '../ui/Icons';
import ProfileDropdown from './ProfileDropdown';
import { useAuth } from '~/lib/auth';
import { useAuthModal } from '../shared/AuthModalProvider';
import SearchDropdown from './SearchDropdown';
import NotificationCenter from '../shared/NotificationCenter';
import ThemeToggle from '../ui/ThemeToggle';

export default function NavBar() {
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const [scrolled, setScrolled] = useState(false);

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

  const handleSignInClick = () => {
    openAuthModal('login');
  };

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 navbar transition-all duration-300 ${scrolled ? 'scrolled' : ''}`}>
      <div className="flex items-center justify-between h-16 px-4">
        {/* Logo */}
        <div className="flex items-center flex-shrink-0">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl navbar-logo">
            <LogoIcon className="w-7 h-7" />
            <span className="hidden sm:inline">TrackBasket</span>
          </Link>
        </div>
        
        {/* Search Bar */}
        <div className="flex-1 max-w-2xl mx-4">
          <SearchDropdown />
        </div>
        
        {/* Right Side Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Chat to Basket Link (if logged in) */}
          {user && (
            <div className="navbar-item">
              <Link 
                href="/chat-to-basket"
                className="flex items-center gap-1.5 px-3 py-2 rounded-md hover-primary-bg transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <span className="hidden md:inline">Chat to Basket</span>
              </Link>
            </div>
          )}
          
          {/* Notification Center (if logged in) */}
          {user && (
            <div className="navbar-item">
              <NotificationCenter />
            </div>
          )}
          
          {/* Theme Toggle */}
          <div className="navbar-item">
            <ThemeToggle />
          </div>
          
          {/* User Profile / Login */}
          {user ? (
            <div className="navbar-item">
              <ProfileDropdown />
            </div>
          ) : (
            <button
              onClick={handleSignInClick}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md hover-primary-bg transition-colors navbar-login"
            >
              <span className="hidden md:inline">Login</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
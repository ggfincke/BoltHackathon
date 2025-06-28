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
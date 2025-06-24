'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { LogoIcon } from '../ui/Icons';
import ProfileDropdown from './ProfileDropdown';
import { useAuth } from '~/lib/auth';
import SearchDropdown from './SearchDropdown';
import NotificationCenter from '../shared/NotificationCenter';
import ThemeToggle from '../ui/ThemeToggle';

export default function NavBar() {
  const { user } = useAuth();
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

  return (
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
          <SearchDropdown />
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
  );
}
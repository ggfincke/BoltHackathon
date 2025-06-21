'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import ThemeToggle from './ThemeToggle';
import { HomeIcon, SearchIcon, CategoriesIcon, BasketsIcon, UserIcon, LogoIcon } from './Icons';
import ProfileDropdown from './ProfileDropdown';
import { useAuth } from '~/lib/auth';
import SearchOverlay from './SearchOverlay';
import NotificationCenter from './NotificationCenter';

export default function NavBar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  
  const navItems = [
    { name: 'Home', href: '/', icon: HomeIcon },
    { name: 'Categories', href: '/categories', icon: CategoriesIcon },
    { name: 'Search', href: '/search', icon: SearchIcon },
    { name: 'Baskets', href: '/baskets', icon: BasketsIcon },
  ];

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

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-primary/95 backdrop-blur-sm shadow-sm' : 'bg-primary'}`}>
        <div className="container mx-auto">
          <div className="flex items-center justify-between h-16 px-4">
            <div className="flex items-center">
              <Link href="/" className="flex items-center gap-2 text-white font-bold text-xl">
                <LogoIcon className="w-7 h-7" />
                <span className="hidden sm:inline">TrackBasket</span>
              </Link>
            </div>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                
                // Special case for search - opens overlay instead of navigating
                if (item.name === 'Search') {
                  return (
                    <button
                      key={item.name}
                      onClick={() => setSearchOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-md transition-colors text-white hover:bg-white/10"
                      aria-label="Search"
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.name}</span>
                    </button>
                  );
                }
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-md transition-colors ${
                      isActive 
                        ? 'bg-white text-primary font-medium' 
                        : 'text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
            
            {/* Right Side Actions */}
            <div className="flex items-center gap-2">
              {/* Search Button (Mobile) */}
              <button
                onClick={() => setSearchOpen(true)}
                className="p-2 rounded-md text-white hover:bg-white/10 transition-colors md:hidden"
                aria-label="Search"
              >
                <SearchIcon className="w-5 h-5" />
              </button>
              
              {/* Notification Center (if logged in) */}
              {user && (
                <div className="text-white">
                  <NotificationCenter />
                </div>
              )}
              
              {/* Theme Toggle */}
              <div className="text-white">
                <ThemeToggle />
              </div>
              
              {/* User Profile / Login */}
              {user ? (
                <div className="text-white">
                  <ProfileDropdown />
                </div>
              ) : (
                <Link
                  href="/auth/login"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-md transition-colors text-white hover:bg-white/10"
                >
                  <UserIcon className="w-5 h-5" />
                  <span className="hidden md:inline">Login</span>
                </Link>
              )}
              
              {/* Mobile Menu Button */}
              <button 
                className="md:hidden p-2 rounded-md text-white hover:bg-white/10 transition-colors"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle menu"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div 
            ref={mobileMenuRef}
            className="md:hidden bg-primary border-t border-white/20 shadow-lg"
          >
            <div className="container mx-auto px-4 py-3 space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                
                // Special case for search - opens overlay instead of navigating
                if (item.name === 'Search') {
                  return (
                    <button
                      key={item.name}
                      onClick={() => {
                        setSearchOpen(true);
                        setMobileMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-3 rounded-md transition-colors text-white hover:bg-white/10"
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.name}</span>
                    </button>
                  );
                }
                
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex w-full items-center gap-3 px-4 py-3 rounded-md transition-colors ${
                      isActive 
                        ? 'bg-white text-primary font-medium' 
                        : 'text-white hover:bg-white/10'
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
              
              {/* Additional mobile menu items */}
              <div className="border-t border-white/20 pt-2 mt-2">
                {user ? (
                  <>
                    <Link
                      href="/profile"
                      className="flex w-full items-center gap-3 px-4 py-3 rounded-md transition-colors text-white hover:bg-white/10"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <UserIcon className="w-5 h-5" />
                      <span>My Profile</span>
                    </Link>
                    <Link
                      href="/settings"
                      className="flex w-full items-center gap-3 px-4 py-3 rounded-md transition-colors text-white hover:bg-white/10"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>Settings</span>
                    </Link>
                  </>
                ) : (
                  <Link
                    href="/auth/login"
                    className="flex w-full items-center gap-3 px-4 py-3 rounded-md transition-colors text-white hover:bg-white/10"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <UserIcon className="w-5 h-5" />
                    <span>Login / Sign Up</span>
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </header>
      
      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-primary border-t border-white/20 z-40">
        <div className="flex justify-around">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            
            // Special case for search - opens overlay instead of navigating
            if (item.name === 'Search') {
              return (
                <button
                  key={item.name}
                  onClick={() => setSearchOpen(true)}
                  className={`flex flex-col items-center py-3 ${
                    isActive ? 'text-white' : 'text-white/80'
                  }`}
                >
                  <Icon className="w-6 h-6" />
                  <span className="text-xs mt-1">{item.name}</span>
                </button>
              );
            }
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center py-3 ${
                  isActive ? 'text-white' : 'text-white/80'
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs mt-1">{item.name}</span>
              </Link>
            );
          })}
          
          {user ? (
            <Link
              href="/profile"
              className={`flex flex-col items-center py-3 ${
                pathname === '/profile' ? 'text-white' : 'text-white/80'
              }`}
            >
              <UserIcon className="w-6 h-6" />
              <span className="text-xs mt-1">Profile</span>
            </Link>
          ) : (
            <Link
              href="/auth/login"
              className={`flex flex-col items-center py-3 ${
                pathname === '/auth/login' ? 'text-white' : 'text-white/80'
              }`}
            >
              <UserIcon className="w-6 h-6" />
              <span className="text-xs mt-1">Login</span>
            </Link>
          )}
        </div>
      </div>
      
      {/* Search Overlay */}
      <SearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
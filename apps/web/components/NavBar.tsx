'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
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
  
  const navItems = [
    { name: 'Home', href: '/', icon: HomeIcon },
    { name: 'Categories', href: '/categories', icon: CategoriesIcon },
    { name: 'Search', href: '/search', icon: SearchIcon },
    { name: 'Baskets', href: '/baskets', icon: BasketsIcon },
  ];

  return (
    <>
      <header className="fixed top-0 left-0 right-0 bg-background border-b border-surface z-50">
        <div className="container mx-auto">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="flex items-center gap-2 text-primary hover:text-primaryHover font-bold text-xl transition-colors">
                <LogoIcon className="w-6 h-6" />
                <span>TrackBasket</span>
              </Link>
            </div>
            
            <nav className="hidden md:flex space-x-4">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                
                // Special case for search - opens overlay instead of navigating
                if (item.name === 'Search') {
                  return (
                    <button
                      key={item.name}
                      onClick={() => setSearchOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-surface text-text hover:bg-surfaceHover transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
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
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background ${
                      isActive 
                        ? 'bg-primary text-buttonText font-medium hover:bg-primaryHover' 
                        : 'bg-surface text-text hover:bg-surfaceHover'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSearchOpen(true)}
                className="p-2 rounded-md bg-surface text-text hover:bg-surfaceHover transition-colors md:hidden focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
                aria-label="Search"
              >
                <SearchIcon className="w-5 h-5" />
              </button>
              
              {user && <NotificationCenter />}
              
              <ThemeToggle />
              
              {user ? (
                <ProfileDropdown />
              ) : (
                <Link
                  href="/auth/login"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-md bg-secondary text-buttonText hover:bg-secondaryHover transition-colors focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background"
                >
                  <UserIcon className="w-5 h-5" />
                  <span className="hidden md:inline">Login</span>
                </Link>
              )}
              
              {/* Mobile menu button - only shown on small screens */}
              <div className="md:hidden">
                <button className="p-2 rounded-md bg-surface text-text hover:bg-surfaceHover transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background">
                  <CategoriesIcon className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Mobile navigation - fixed at bottom */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-surface">
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
                    className={`flex flex-col items-center py-3 px-2 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background rounded-md ${
                      isActive 
                        ? 'text-primary bg-surface' 
                        : 'text-text hover:text-primary hover:bg-surface'
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
                  className={`flex flex-col items-center py-3 px-2 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background rounded-md ${
                    isActive 
                      ? 'text-primary bg-surface' 
                      : 'text-text hover:text-primary hover:bg-surface'
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
                className={`flex flex-col items-center py-3 px-2 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background rounded-md ${
                  pathname === '/profile' 
                    ? 'text-primary bg-surface' 
                    : 'text-text hover:text-primary hover:bg-surface'
                }`}
              >
                <UserIcon className="w-6 h-6" />
                <span className="text-xs mt-1">Profile</span>
              </Link>
            ) : (
              <Link
                href="/auth/login"
                className={`flex flex-col items-center py-3 px-2 transition-colors focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background rounded-md ${
                  pathname === '/auth/login' 
                    ? 'text-secondary bg-surface' 
                    : 'text-text hover:text-secondary hover:bg-surface'
                }`}
              >
                <UserIcon className="w-6 h-6" />
                <span className="text-xs mt-1">Login</span>
              </Link>
            )}
          </div>
        </div>
      </header>
      
      {/* Search Overlay */}
      <SearchOverlay isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
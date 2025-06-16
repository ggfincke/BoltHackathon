'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';
import { HomeIcon, SearchIcon, CategoriesIcon, BasketsIcon, UserIcon, LogoIcon } from './Icons';
import ProfileDropdown from './ProfileDropdown';
import { useAuth } from '~/lib/auth';

export default function NavBar() {
  const pathname = usePathname();
  const { user } = useAuth();
  
  const navItems = [
    { name: 'Home', href: '/', icon: HomeIcon },
    { name: 'Categories', href: '/categories', icon: CategoriesIcon },
    { name: 'Search', href: '/search', icon: SearchIcon },
    { name: 'Baskets', href: '/baskets', icon: BasketsIcon },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 bg-background border-b border-surface z-50">
      <div className="container mx-auto">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2 text-primary font-bold text-xl">
              <LogoIcon className="w-6 h-6" />
              <span>TrackBasket</span>
            </Link>
          </div>
          
          <nav className="hidden md:flex space-x-4">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md transition-colors ${
                    isActive 
                      ? 'bg-primary text-buttonText font-medium' 
                      : 'hover:bg-surface'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
          
          <div className="flex items-center gap-2">
            <ThemeToggle />
            
            {user ? (
              <ProfileDropdown />
            ) : (
              <Link
                href="/auth/login"
                className="flex items-center gap-1.5 px-3 py-2 rounded-md transition-colors hover:bg-surface"
              >
                <UserIcon className="w-5 h-5" />
                <span className="hidden md:inline">Login</span>
              </Link>
            )}
            
            {/* Mobile menu button - only shown on small screens */}
            <div className="md:hidden">
              <button className="p-2 rounded-md hover:bg-surface">
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
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center py-3 ${
                  isActive ? 'text-primary' : 'text-text'
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
                pathname === '/profile' ? 'text-primary' : 'text-text'
              }`}
            >
              <UserIcon className="w-6 h-6" />
              <span className="text-xs mt-1">Profile</span>
            </Link>
          ) : (
            <Link
              href="/auth/login"
              className={`flex flex-col items-center py-3 ${
                pathname === '/auth/login' ? 'text-primary' : 'text-text'
              }`}
            >
              <UserIcon className="w-6 h-6" />
              <span className="text-xs mt-1">Login</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
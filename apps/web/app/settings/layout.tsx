'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '~/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login?redirectedFrom=' + pathname);
    }
  }, [user, loading, router, pathname]);

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  const settingsLinks = [
    { name: 'Account', href: '/settings' },
    { name: 'Notifications', href: '/settings/notifications' },
    { name: 'Privacy', href: '/settings/privacy' },
  ];

  return (
    <div className="container mx-auto py-8">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <div className="w-full md:w-64 shrink-0">
          <div className="bg-surface p-4 rounded-lg shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Settings</h2>
            <nav className="space-y-1">
              {settingsLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.name}
                    href={link.href}
                    className={`block px-3 py-2 rounded-md transition-colors ${
                      isActive
                        ? 'bg-primary text-buttonText font-medium'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {link.name}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}
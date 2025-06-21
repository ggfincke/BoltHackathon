import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '~/styles/globals.css';
import NavBar from '~/components/NavBar';
import { ThemeProvider } from '~/components/ThemeProvider';
import { AuthProvider } from '~/lib/auth';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'TrackBasket - Compare Prices & Save Money',
  description: 'Track prices and availability across multiple retailers, create shopping baskets, and get notified about the best deals.',
  keywords: 'price comparison, grocery shopping, price tracking, shopping baskets, price alerts',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <NavBar />
            <main className="pt-16 pb-16 md:pb-0 min-h-screen">
              {children}
            </main>
            <footer className="bg-surface py-8 border-t border-gray-200 dark:border-gray-800">
              <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                  <div>
                    <h3 className="font-bold text-lg mb-4">TrackBasket</h3>
                    <p className="text-gray-600 dark:text-gray-400 text-sm">
                      Track prices and availability across multiple retailers to find the best deals.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-4">Shop</h3>
                    <ul className="space-y-2 text-sm">
                      <li><a href="/categories" className="text-gray-600 dark:text-gray-400 hover:text-primary">Categories</a></li>
                      <li><a href="/search" className="text-gray-600 dark:text-gray-400 hover:text-primary">Search</a></li>
                      <li><a href="/baskets" className="text-gray-600 dark:text-gray-400 hover:text-primary">Baskets</a></li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-4">Account</h3>
                    <ul className="space-y-2 text-sm">
                      <li><a href="/auth/login" className="text-gray-600 dark:text-gray-400 hover:text-primary">Login</a></li>
                      <li><a href="/auth/signup" className="text-gray-600 dark:text-gray-400 hover:text-primary">Sign Up</a></li>
                      <li><a href="/profile" className="text-gray-600 dark:text-gray-400 hover:text-primary">My Profile</a></li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-4">Support</h3>
                    <ul className="space-y-2 text-sm">
                      <li><a href="#" className="text-gray-600 dark:text-gray-400 hover:text-primary">Help Center</a></li>
                      <li><a href="#" className="text-gray-600 dark:text-gray-400 hover:text-primary">Privacy Policy</a></li>
                      <li><a href="#" className="text-gray-600 dark:text-gray-400 hover:text-primary">Terms of Service</a></li>
                    </ul>
                  </div>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-800 mt-8 pt-8 text-center text-sm text-gray-600 dark:text-gray-400">
                  <p>&copy; {new Date().getFullYear()} TrackBasket. All rights reserved.</p>
                </div>
              </div>
            </footer>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
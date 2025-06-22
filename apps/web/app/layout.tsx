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
            <footer className="py-8" style={{backgroundColor: 'var(--surface)', color: 'var(--text)'}}>
              <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                  <div>
                    <h3 className="font-bold text-lg mb-4" style={{color: 'var(--text)'}}>TrackBasket</h3>
                    <p className="text-sm opacity-80" style={{color: 'var(--text)'}}>
                      Track prices and availability across multiple retailers to find the best deals.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-4" style={{color: 'var(--text)'}}>Shop</h3>
                    <ul className="space-y-2 text-sm">
                      <li><a href="/categories" className="opacity-80 hover:opacity-100" style={{color: 'var(--text)'}}>Categories</a></li>
                      <li><a href="/search" className="opacity-80 hover:opacity-100" style={{color: 'var(--text)'}}>Search</a></li>
                      <li><a href="/baskets" className="opacity-80 hover:opacity-100" style={{color: 'var(--text)'}}>Baskets</a></li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-4" style={{color: 'var(--text)'}}>Account</h3>
                    <ul className="space-y-2 text-sm">
                      <li><a href="/auth/login" className="opacity-80 hover:opacity-100" style={{color: 'var(--text)'}}>Login</a></li>
                      <li><a href="/auth/signup" className="opacity-80 hover:opacity-100" style={{color: 'var(--text)'}}>Sign Up</a></li>
                      <li><a href="/profile" className="opacity-80 hover:opacity-100" style={{color: 'var(--text)'}}>My Profile</a></li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-4" style={{color: 'var(--text)'}}>Support</h3>
                    <ul className="space-y-2 text-sm">
                      <li><a href="#" className="opacity-80 hover:opacity-100" style={{color: 'var(--text)'}}>Help Center</a></li>
                      <li><a href="#" className="opacity-80 hover:opacity-100" style={{color: 'var(--text)'}}>Privacy Policy</a></li>
                      <li><a href="#" className="opacity-80 hover:opacity-100" style={{color: 'var(--text)'}}>Terms of Service</a></li>
                    </ul>
                  </div>
                </div>
                <div className="mt-8 pt-8 text-center text-sm opacity-80" style={{borderTop: '1px solid rgba(133, 209, 231, 0.2)', color: 'var(--text)'}}>
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
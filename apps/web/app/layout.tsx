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
      <body className={`${inter.className} bg-background text-text`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            <NavBar />
            <main className="pt-16 pb-16 md:pb-0 min-h-screen bg-background">
              {children}
            </main>
            <footer className="bg-primary text-buttonText py-8">
              <div className="container mx-auto px-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                  <div>
                    <h3 className="font-bold text-lg mb-4">TrackBasket</h3>
                    <p className="text-buttonText/80 text-sm">
                      Track prices and availability across multiple retailers to find the best deals.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-4">Shop</h3>
                    <ul className="space-y-2 text-sm">
                      <li><a href="/categories" className="text-buttonText/80 hover:text-buttonText transition-colors">Categories</a></li>
                      <li><a href="/search" className="text-buttonText/80 hover:text-buttonText transition-colors">Search</a></li>
                      <li><a href="/baskets" className="text-buttonText/80 hover:text-buttonText transition-colors">Baskets</a></li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-4">Account</h3>
                    <ul className="space-y-2 text-sm">
                      <li><a href="/auth/login" className="text-buttonText/80 hover:text-buttonText transition-colors">Login</a></li>
                      <li><a href="/auth/signup" className="text-buttonText/80 hover:text-buttonText transition-colors">Sign Up</a></li>
                      <li><a href="/profile" className="text-buttonText/80 hover:text-buttonText transition-colors">My Profile</a></li>
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-4">Support</h3>
                    <ul className="space-y-2 text-sm">
                      <li><a href="#" className="text-buttonText/80 hover:text-buttonText transition-colors">Help Center</a></li>
                      <li><a href="#" className="text-buttonText/80 hover:text-buttonText transition-colors">Privacy Policy</a></li>
                      <li><a href="#" className="text-buttonText/80 hover:text-buttonText transition-colors">Terms of Service</a></li>
                    </ul>
                  </div>
                </div>
                <div className="border-t border-buttonText/20 mt-8 pt-8 text-center text-sm text-buttonText/80">
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
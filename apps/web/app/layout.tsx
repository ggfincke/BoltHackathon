import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '~/styles/globals.css';
import NavBar from '~/components/layout/NavBar';
import { ThemeProvider } from '~/components/ui/ThemeProvider';
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
            {/* <footer className="py-6" style={{backgroundColor: 'var(--surface)', color: 'var(--text)'}}>
              <div className="container mx-auto px-4">
                <div className="text-center text-sm opacity-80" style={{color: 'var(--text)'}}>
                  <p>&copy; {new Date().getFullYear()} TrackBasket. All rights reserved.</p>
                </div>
              </div>
            </footer> */}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
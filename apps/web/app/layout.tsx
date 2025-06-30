import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '~/styles/globals.css';
import NavBar from '~/components/layout/NavBar';
import Sidebar from '~/components/layout/Sidebar';
import { ThemeProvider } from '~/components/ui/ThemeProvider';
import { AuthProvider } from '~/lib/auth';
import { AuthModalProvider } from '~/components/shared/AuthModalProvider';

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
            <AuthModalProvider>
              <NavBar />
              <div className="flex">
                <Sidebar variant="home" />
                <main className="flex-1 ml-64 pt-16">
                  <div className="p-4">
                    {children}
                  </div>
                </main>
              </div>
            </AuthModalProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '~/styles/globals.css';
import NavBar from '~/components/NavBar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'TrackBasket',
  description: 'Track prices and availability across multiple retailers',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <NavBar />
        <main className="pt-16 pb-16 md:pb-0 min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
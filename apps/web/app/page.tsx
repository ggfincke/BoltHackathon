import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-text mb-4">
            Welcome to <span className="text-primary">TrackBasket</span>
          </h1>
          <p className="text-xl text-text/80 mb-8 max-w-2xl mx-auto">
            Track prices and availability across multiple retailers. 
            Never miss a deal on your favorite products again.
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/categories"
              className="bg-primary text-buttonText hover:bg-primaryHover px-6 py-3 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
            >
              Browse Categories
            </Link>
            <Link
              href="/baskets"
              className="bg-secondary text-buttonText hover:bg-secondaryHover px-6 py-3 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-secondary focus:ring-offset-2 focus:ring-offset-background"
            >
              Create Basket
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-surface p-6 rounded-lg border border-surface hover:bg-surfaceHover transition-colors">
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-buttonText" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-text mb-3">Price Tracking</h3>
            <p className="text-text/80">
              Monitor price changes across multiple retailers and get notified when prices drop.
            </p>
          </div>

          <div className="bg-surface p-6 rounded-lg border border-surface hover:bg-surfaceHover transition-colors">
            <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-buttonText" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m2.6 0L7 13m0 0L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17M17 13v4a2 2 0 01-2 2H9a2 2 0 01-2-2v-4m8 0V9a2 2 0 00-2-2H9a2 2 0 00-2-2v4.01" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-text mb-3">Smart Baskets</h3>
            <p className="text-text/80">
              Create and share shopping baskets with friends and family. Track total costs across stores.
            </p>
          </div>

          <div className="bg-surface p-6 rounded-lg border border-surface hover:bg-surfaceHover transition-colors">
            <div className="w-12 h-12 bg-accent rounded-lg flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-buttonText" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5-5-5h5v-5a7.5 7.5 0 000-15h-2.5a7.5 7.5 0 00-7.5 7.5v5H0l5 5 5-5z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-text mb-3">Price Comparison</h3>
            <p className="text-text/80">
              Compare prices across retailers instantly. Find the best deals without browsing multiple sites.
            </p>
          </div>
        </div>

        {/* Getting Started Section */}
        <div className="bg-surface border border-surface rounded-lg p-8">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl font-semibold text-text mb-4">Getting Started</h2>
            <p className="text-text/80 mb-6">
              Start tracking your favorite products in just a few clicks. 
              Browse our extensive catalog or search for specific items.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/search"
                className="bg-accent text-buttonText hover:bg-accentHover px-6 py-3 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface"
              >
                Search Products
              </Link>
              <Link
                href="/categories"
                className="bg-surface text-text hover:bg-surfaceHover border border-text/20 px-6 py-3 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-text focus:ring-offset-2 focus:ring-offset-surface"
              >
                Browse Categories
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
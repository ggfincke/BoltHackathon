"use client";

import Link from 'next/link';
import { useAuth } from '~/lib/auth';
import { FaShoppingBasket, FaRegBell, FaSearch, FaChartLine, FaUsers, FaArrowRight, FaTag, FaExclamationCircle } from 'react-icons/fa';

export default function Home() {
  const { user } = useAuth();
  
  // If user is logged in, show the authenticated home page
  if (user) {
    return <AuthenticatedHome />;
  }
  
  // Otherwise show the landing page for non-authenticated users
  return (
    <div className="min-h-screen">
      {/* Hero Section - Smaller height */}
      <section className="gradient-bg-surface py-16">
        <div className="container">
          <div className="max-w-3xl">
            <h1 className="text-5xl md:text-6xl font-bold mb-6 gradient-text animate-fade-in-up">
              Welcome to TrackBasket
            </h1>
            <p className="text-xl md:text-2xl mb-8 opacity-80 animate-fade-in-up delay-100" style={{color: 'var(--text)'}}>
              Track prices and availability across multiple retailers with ease. Save money and never miss a deal again.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up delay-200">
              <Link href="/auth/signup" className="btn-base px-12 py-3" style={{background: 'var(--primary)', color: 'var(--dark-text)'}}>
                Get Started
              </Link>
              <Link href="/categories" className="btn-base px-12 py-3" style={{background: 'var(--secondary)', color: 'var(--button-text)'}}>
                Browse Categories
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16" style={{background: 'var(--surface)'}}>
        <div className="container">
          <h2 className="text-4xl font-bold text-center mb-10" style={{color: 'var(--text)'}}>
            About TrackBasket
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="card-enhanced text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-6" style={{background: 'var(--primary)', color: 'var(--dark-text)'}}>
                <FaChartLine />
              </div>
              <h3 className="text-2xl font-semibold mb-4" style={{color: 'var(--text)'}}>Price Tracking</h3>
              <p className="opacity-80 mb-6" style={{color: 'var(--text)'}}>
                Monitor price changes across Amazon, Target, and Walmart. Get notified when prices drop on items you're watching.
              </p>
              <Link href="/search" className="btn-base px-6 py-2 text-sm w-full text-center" style={{background: 'var(--primary)', color: 'var(--dark-text)'}}>
                Start Tracking
              </Link>
            </div>
            
            <div className="card-enhanced text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-6" style={{background: 'var(--secondary)', color: 'var(--button-text)'}}>
                <FaShoppingBasket />
              </div>
              <h3 className="text-2xl font-semibold mb-4" style={{color: 'var(--text)'}}>Shopping Baskets</h3>
              <p className="opacity-80 mb-6" style={{color: 'var(--text)'}}>
                Create custom shopping baskets to organize products and track total costs. Share baskets with family and friends.
              </p>
              <Link href="/baskets" className="btn-base px-6 py-2 text-sm w-full text-center" style={{background: 'var(--secondary)', color: 'var(--button-text)'}}>
                Create Basket
              </Link>
            </div>
            
            <div className="card-enhanced text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-6" style={{background: 'var(--accent)', color: 'var(--button-text)'}}>
                <FaRegBell />
              </div>
              <h3 className="text-2xl font-semibold mb-4" style={{color: 'var(--text)'}}>Smart Notifications</h3>
              <p className="opacity-80 mb-6" style={{color: 'var(--text)'}}>
                Customize alerts for price drops, back-in-stock events, and product changes. Get notified via email, push, or SMS.
              </p>
              <Link href="/settings/notifications" className="btn-base px-6 py-2 text-sm w-full text-center" style={{background: 'var(--accent)', color: 'var(--button-text)'}}>
                Set Up Alerts
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Getting Started Section */}
      <section className="py-16">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <div className="card-enhanced">
              <h2 className="text-3xl font-bold mb-6 text-center" style={{color: 'var(--text)'}}>Getting Started</h2>
              <div className="grid md:grid-cols-2 gap-8">
                <div className="text-center">
                  <h3 className="text-xl font-semibold mb-4" style={{color: 'var(--primary)'}}>How It Works</h3>
                  <ul className="space-y-3 opacity-80" style={{color: 'var(--text)'}}>
                    <li className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold" style={{background: 'var(--primary)', color: 'var(--dark-text)'}}>1</span>
                      Search for products or browse categories
                    </li>
                    <li className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold" style={{background: 'var(--secondary)', color: 'var(--button-text)'}}>2</span>
                      Add items to your tracking list or baskets
                    </li>
                    <li className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold" style={{background: 'var(--accent)', color: 'var(--button-text)'}}>3</span>
                      Set up notifications for price alerts
                    </li>
                    <li className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold" style={{background: 'var(--primary)', color: 'var(--dark-text)'}}>4</span>
                      Save money by shopping at the best prices
                    </li>
                  </ul>
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-semibold mb-4" style={{color: 'var(--secondary)'}}>Popular Categories</h3>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {['Beverages', 'Snacks', 'Dairy', 'Produce', 'Frozen Foods', 'Bakery'].map((category) => (
                      <Link 
                        key={category}
                        href={`/categories/${category.toLowerCase().replace(' ', '-')}`}
                        className="px-3 py-1 rounded-full text-sm font-medium transition-colors duration-200"
                        style={{
                          background: 'var(--surface)',
                          color: 'var(--text)',
                          border: '1px solid var(--primary)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--primary)';
                          e.currentTarget.style.color = 'var(--dark-text)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'var(--surface)';
                          e.currentTarget.style.color = 'var(--text)';
                        }}
                      >
                        {category}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 gradient-bg-primary">
        <div className="container text-center">
          <h2 className="text-4xl font-bold mb-6" style={{color: 'var(--text)'}}>Ready to Start Saving?</h2>
          <p className="text-xl mb-8 opacity-80 max-w-2xl mx-auto" style={{color: 'var(--text)'}}>
            Join thousands of smart shoppers who save money with TrackBasket's intelligent price tracking.
          </p>
          <div className="flex justify-center">
            <Link href="/auth/signup" className="btn-base px-12 py-4 text-lg" style={{background: 'var(--primary)', color: 'var(--dark-text)'}}>
              Create Account
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

// Completely different home page for authenticated users
function AuthenticatedHome() {
  const { user } = useAuth();
  const username = user?.email?.split('@')[0] || 'there';
  
  // Mock data for demonstration
  const recentBaskets = [
    { id: '1', name: 'Weekly Groceries', itemCount: 12, totalCost: 87.45 },
    { id: '2', name: 'Pantry Essentials', itemCount: 8, totalCost: 42.99 },
    { id: '3', name: 'Snacks & Beverages', itemCount: 5, totalCost: 23.75 }
  ];
  
  const priceAlerts = [
    { id: '1', productName: 'Organic Milk', retailer: 'Target', oldPrice: 4.99, newPrice: 3.49, percentChange: -30 },
    { id: '2', productName: 'Cheerios Cereal', retailer: 'Walmart', oldPrice: 3.99, newPrice: 2.99, percentChange: -25 },
    { id: '3', productName: 'Coffee Beans', retailer: 'Amazon', oldPrice: 12.99, newPrice: 15.99, percentChange: 23 }
  ];
  
  const popularCategories = [
    { name: 'Beverages', count: 15 },
    { name: 'Snacks', count: 12 },
    { name: 'Dairy', count: 8 },
    { name: 'Produce', count: 6 }
  ];

  return (
    <div className="min-h-screen py-8">
      {/* Welcome Banner */}
      <section className="mb-8">
        <div className="container">
          <div className="bg-surface rounded-lg p-6 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold mb-2" style={{color: 'var(--text)'}}>
                  Welcome back, {username}!
                </h1>
                <p className="text-lg opacity-80" style={{color: 'var(--text)'}}>
                  Track your baskets, monitor price changes, and discover new savings.
                </p>
              </div>
              <div className="mt-4 md:mt-0">
                <Link href="/search" className="btn-base" style={{background: 'var(--primary)', color: 'var(--dark-text)'}}>
                  <FaSearch className="mr-2" /> Find Products
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      <div className="container">
        <div className="grid md:grid-cols-3 gap-6">
          {/* Left Column - Recent Baskets */}
          <div className="md:col-span-2">
            <div className="bg-surface rounded-lg shadow-sm p-6 mb-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold" style={{color: 'var(--text)'}}>Your Recent Baskets</h2>
                <Link href="/baskets" className="text-sm flex items-center" style={{color: 'var(--primary)'}}>
                  View All <FaArrowRight className="ml-1" />
                </Link>
              </div>
              
              {recentBaskets.length > 0 ? (
                <div className="space-y-4">
                  {recentBaskets.map(basket => (
                    <Link key={basket.id} href={`/basket/${basket.id}`} className="block">
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <div className="flex justify-between items-center">
                          <h3 className="font-medium" style={{color: 'var(--text)'}}>{basket.name}</h3>
                          <span className="text-sm font-bold" style={{color: 'var(--primary)'}}>
                            ${basket.totalCost.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between mt-2">
                          <span className="text-sm opacity-70" style={{color: 'var(--text)'}}>
                            {basket.itemCount} items
                          </span>
                          <span className="text-xs px-2 py-1 rounded-full" style={{background: 'var(--primary)', color: 'var(--dark-text)'}}>
                            View Details
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                  <FaShoppingBasket className="mx-auto text-4xl mb-3 opacity-50" style={{color: 'var(--text)'}} />
                  <p className="mb-4" style={{color: 'var(--text)'}}>You don't have any baskets yet</p>
                  <Link href="/baskets" className="btn-base" style={{background: 'var(--primary)', color: 'var(--dark-text)'}}>
                    Create Your First Basket
                  </Link>
                </div>
              )}
            </div>
            
            {/* Price Alerts */}
            <div className="bg-surface rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold" style={{color: 'var(--text)'}}>Recent Price Changes</h2>
                <Link href="/settings/notifications" className="text-sm flex items-center" style={{color: 'var(--primary)'}}>
                  Manage Alerts <FaArrowRight className="ml-1" />
                </Link>
              </div>
              
              {priceAlerts.length > 0 ? (
                <div className="space-y-4">
                  {priceAlerts.map(alert => (
                    <div key={alert.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium" style={{color: 'var(--text)'}}>{alert.productName}</h3>
                          <p className="text-sm" style={{color: 'var(--text)'}}>{alert.retailer}</p>
                        </div>
                        <div className={`text-sm font-bold px-2 py-1 rounded-full ${
                          alert.percentChange < 0 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
                          'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}>
                          {alert.percentChange < 0 ? '↓' : '↑'} {Math.abs(alert.percentChange)}%
                        </div>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm line-through opacity-70" style={{color: 'var(--text)'}}>
                            ${alert.oldPrice.toFixed(2)}
                          </span>
                          <span className="text-sm font-bold" style={{color: 'var(--text)'}}>
                            ${alert.newPrice.toFixed(2)}
                          </span>
                        </div>
                        <Link href={`/product/${alert.id}`} className="text-xs px-2 py-1 rounded-full" style={{background: 'var(--secondary)', color: 'var(--button-text)'}}>
                          View Product
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                  <FaExclamationCircle className="mx-auto text-4xl mb-3 opacity-50" style={{color: 'var(--text)'}} />
                  <p className="mb-4" style={{color: 'var(--text)'}}>No recent price changes</p>
                  <Link href="/search" className="btn-base" style={{background: 'var(--primary)', color: 'var(--dark-text)'}}>
                    Find Products to Track
                  </Link>
                </div>
              )}
            </div>
          </div>
          
          {/* Right Column - Stats and Categories */}
          <div>
            {/* Quick Stats */}
            <div className="bg-surface rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-xl font-bold mb-4" style={{color: 'var(--text)'}}>Your Stats</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-center">
                  <p className="text-3xl font-bold" style={{color: 'var(--primary)'}}>
                    {recentBaskets.reduce((sum, basket) => sum + basket.itemCount, 0)}
                  </p>
                  <p className="text-sm opacity-80" style={{color: 'var(--text)'}}>Tracked Items</p>
                </div>
                <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-center">
                  <p className="text-3xl font-bold" style={{color: 'var(--secondary)'}}>
                    ${priceAlerts.filter(a => a.percentChange < 0).reduce((sum, a) => sum + (a.oldPrice - a.newPrice), 0).toFixed(2)}
                  </p>
                  <p className="text-sm opacity-80" style={{color: 'var(--text)'}}>Potential Savings</p>
                </div>
              </div>
            </div>
            
            {/* Popular Categories */}
            <div className="bg-surface rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-xl font-bold mb-4" style={{color: 'var(--text)'}}>Your Popular Categories</h2>
              {popularCategories.length > 0 ? (
                <div className="space-y-3">
                  {popularCategories.map(category => (
                    <Link key={category.name} href={`/categories/${category.name.toLowerCase()}`}>
                      <div className="flex justify-between items-center p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <span style={{color: 'var(--text)'}}>{category.name}</span>
                        <span className="text-xs px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-700" style={{color: 'var(--text)'}}>
                          {category.count} items
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-center py-4 opacity-70" style={{color: 'var(--text)'}}>
                  No categories tracked yet
                </p>
              )}
            </div>
            
            {/* Quick Actions */}
            <div className="bg-surface rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-bold mb-4" style={{color: 'var(--text)'}}>Quick Actions</h2>
              <div className="space-y-3">
                <Link href="/baskets" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors w-full">
                  <div className="flex items-center">
                    <FaShoppingBasket className="mr-3" style={{color: 'var(--secondary)'}} />
                    <span style={{color: 'var(--text)'}}>Create New Basket</span>
                  </div>
                  <FaArrowRight style={{color: 'var(--text)'}} />
                </Link>
                <Link href="/search" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors w-full">
                  <div className="flex items-center">
                    <FaSearch className="mr-3" style={{color: 'var(--primary)'}} />
                    <span style={{color: 'var(--text)'}}>Search Products</span>
                  </div>
                  <FaArrowRight style={{color: 'var(--text)'}} />
                </Link>
                <Link href="/settings/notifications" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors w-full">
                  <div className="flex items-center">
                    <FaRegBell className="mr-3" style={{color: 'var(--accent)'}} />
                    <span style={{color: 'var(--text)'}}>Manage Notifications</span>
                  </div>
                  <FaArrowRight style={{color: 'var(--text)'}} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
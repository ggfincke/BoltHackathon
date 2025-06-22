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
    { 
      id: '1', 
      productName: 'Organic Milk', 
      retailer: 'Target', 
      oldPrice: 4.99, 
      newPrice: 3.49, 
      percentChange: -30,
      imageUrl: 'https://images.pexels.com/photos/2510584/pexels-photo-2510584.jpeg?auto=compress&cs=tinysrgb&w=300'
    },
    { 
      id: '2', 
      productName: 'Cheerios Cereal', 
      retailer: 'Walmart', 
      oldPrice: 3.99, 
      newPrice: 2.99, 
      percentChange: -25,
      imageUrl: 'https://images.pexels.com/photos/135525/pexels-photo-135525.jpeg?auto=compress&cs=tinysrgb&w=300'
    },
    { 
      id: '3', 
      productName: 'Coffee Beans', 
      retailer: 'Amazon', 
      oldPrice: 12.99, 
      newPrice: 15.99, 
      percentChange: 23,
      imageUrl: 'https://images.pexels.com/photos/1695052/pexels-photo-1695052.jpeg?auto=compress&cs=tinysrgb&w=300'
    },
    { 
      id: '4', 
      productName: 'Pasta Sauce', 
      retailer: 'Target', 
      oldPrice: 3.99, 
      newPrice: 2.79, 
      percentChange: -30,
      imageUrl: 'https://images.pexels.com/photos/1435904/pexels-photo-1435904.jpeg?auto=compress&cs=tinysrgb&w=300'
    }
  ];
  
  const popularCategories = [
    { name: 'Beverages', count: 15 },
    { name: 'Snacks', count: 12 },
    { name: 'Dairy', count: 8 },
    { name: 'Produce', count: 6 }
  ];

  return (
    <div className="min-h-screen py-6">
      {/* Welcome Banner */}
      <section className="mb-6">
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
                <Link href="/search" className="btn-base px-6 py-2" style={{background: 'var(--primary)', color: 'var(--dark-text)'}}>
                  <FaSearch className="inline-block mr-2" /> Find Products
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      <div className="container">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Column - Stats and Recent Baskets */}
          <div className="lg:col-span-1">
            {/* User Stats */}
            <div className="bg-surface rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-xl font-bold mb-4" style={{color: 'var(--text)'}}>Your Stats</h2>
              
              <div className="space-y-4">
                <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-center">
                  <p className="text-3xl font-bold" style={{color: 'var(--primary)'}}>25</p>
                  <p className="text-sm opacity-80" style={{color: 'var(--text)'}}>Tracked Items</p>
                </div>
                
                <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg text-center">
                  <p className="text-3xl font-bold" style={{color: 'var(--secondary)'}}>$2.50</p>
                  <p className="text-sm opacity-80" style={{color: 'var(--text)'}}>Potential Savings</p>
                </div>
              </div>
            </div>
            
            {/* Recent Baskets */}
            <div className="bg-surface rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold" style={{color: 'var(--text)'}}>Your Recent Baskets</h2>
                <Link href="/baskets" className="text-sm flex items-center" style={{color: 'var(--primary)'}}>
                  View All <FaArrowRight className="ml-1" />
                </Link>
              </div>
              
              {recentBaskets.length > 0 ? (
                <div className="space-y-3">
                  {recentBaskets.map(basket => (
                    <Link key={basket.id} href={`/basket/${basket.id}`}>
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <div className="flex justify-between items-center">
                          <h3 className="font-medium text-sm" style={{color: 'var(--text)'}}>{basket.name}</h3>
                          <span className="text-sm font-bold" style={{color: 'var(--primary)'}}>
                            ${basket.totalCost.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-xs opacity-70" style={{color: 'var(--text)'}}>
                            {basket.itemCount} items
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{background: 'var(--primary)', color: 'var(--dark-text)'}}>
                            View Details
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 border border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                  <FaShoppingBasket className="mx-auto text-3xl mb-2 opacity-50" style={{color: 'var(--text)'}} />
                  <p className="mb-3 text-sm" style={{color: 'var(--text)'}}>No baskets yet</p>
                  <Link href="/baskets" className="btn-base text-sm px-4 py-1.5" style={{background: 'var(--primary)', color: 'var(--dark-text)'}}>
                    Create Basket
                  </Link>
                </div>
              )}
            </div>
          </div>
          
          {/* Right Column - Price Changes */}
          <div className="lg:col-span-3">
            <div className="bg-surface rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold" style={{color: 'var(--text)'}}>Recent Price Changes</h2>
                <Link href="/settings/notifications" className="text-sm flex items-center" style={{color: 'var(--primary)'}}>
                  Manage Alerts <FaArrowRight className="ml-1" />
                </Link>
              </div>
              
              {priceAlerts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                  {priceAlerts.map(alert => (
                    <div key={alert.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      <div className="flex">
                        <div className="w-1/3">
                          <img 
                            src={alert.imageUrl} 
                            alt={alert.productName}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="w-2/3 p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="font-medium text-sm line-clamp-1" style={{color: 'var(--text)'}}>{alert.productName}</h3>
                              <p className="text-xs opacity-70" style={{color: 'var(--text)'}}>{alert.retailer}</p>
                            </div>
                            <div className={`text-xs font-bold px-2 py-1 rounded-full ${
                              alert.percentChange < 0 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
                              'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            }`}>
                              {alert.percentChange < 0 ? '↓' : '↑'} {Math.abs(alert.percentChange)}%
                            </div>
                          </div>
                          <div className="flex justify-between items-center mt-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs line-through opacity-70" style={{color: 'var(--text)'}}>
                                ${alert.oldPrice.toFixed(2)}
                              </span>
                              <span className="text-sm font-bold" style={{color: 'var(--text)'}}>
                                ${alert.newPrice.toFixed(2)}
                              </span>
                            </div>
                            <Link href={`/product/${alert.id}`} className="text-xs px-2 py-0.5 rounded-full" style={{background: 'var(--secondary)', color: 'var(--button-text)'}}>
                              View
                            </Link>
                          </div>
                        </div>
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
            
            {/* Popular Categories and Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              {/* Popular Categories */}
              <div className="bg-surface rounded-lg shadow-sm p-6">
                <h2 className="text-xl font-bold mb-4" style={{color: 'var(--text)'}}>Your Popular Categories</h2>
                {popularCategories.length > 0 ? (
                  <div className="space-y-2">
                    {popularCategories.map(category => (
                      <Link key={category.name} href={`/categories/${category.name.toLowerCase()}`}>
                        <div className="flex justify-between items-center p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
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
                <div className="space-y-2">
                  <Link href="/baskets" className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors w-full">
                    <div className="flex items-center">
                      <FaShoppingBasket className="mr-2" style={{color: 'var(--secondary)'}} />
                      <span style={{color: 'var(--text)'}}>Create New Basket</span>
                    </div>
                    <FaArrowRight style={{color: 'var(--text)'}} />
                  </Link>
                  <Link href="/search" className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors w-full">
                    <div className="flex items-center">
                      <FaSearch className="mr-2" style={{color: 'var(--primary)'}} />
                      <span style={{color: 'var(--text)'}}>Search Products</span>
                    </div>
                    <FaArrowRight style={{color: 'var(--text)'}} />
                  </Link>
                  <Link href="/settings/notifications" className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors w-full">
                    <div className="flex items-center">
                      <FaRegBell className="mr-2" style={{color: 'var(--accent)'}} />
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
    </div>
  );
}
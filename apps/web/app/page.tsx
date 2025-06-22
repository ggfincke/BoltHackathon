"use client";

import Link from 'next/link';
import { useAuth } from '~/lib/auth';
import { FaShoppingBasket, FaRegBell, FaSearch, FaChartLine, FaUsers } from 'react-icons/fa';

export default function Home() {
  const { user } = useAuth();
  
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="gradient-bg-surface py-24 md:py-28">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
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
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signup" className="btn-base px-12 py-4 text-lg" style={{background: 'var(--primary)', color: 'var(--dark-text)'}}>
              Create Account
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
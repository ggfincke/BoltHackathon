"use client";

import Link from 'next/link';
import { BsArrowRight } from 'react-icons/bs';
import { FaShoppingBasket, FaRegBell, FaSearch, FaChartLine, FaUsers } from 'react-icons/fa';

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="gradient-bg-surface py-20 text-center">
        <div className="container">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 gradient-text animate-fade-in-up">
            Welcome to TrackBasket
          </h1>
          <p className="text-xl md:text-2xl mb-8 opacity-80 animate-fade-in-up delay-100" style={{color: 'var(--text)'}}>
            Track prices and availability across multiple retailers with ease
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in-up delay-200">
            <Link href="/auth/signup" className="btn-base" style={{background: 'var(--primary)', color: 'var(--button-text)'}}>
              Get Started
            </Link>
            <Link href="/categories" className="btn-base" style={{background: 'var(--secondary)', color: 'var(--button-text)'}}>
              Browse Categories
            </Link>
            <Link href="/about" className="btn-base" style={{background: 'var(--accent)', color: 'var(--button-text)'}}>
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20" style={{background: 'var(--surface)'}}>
        <div className="container">
          <h2 className="text-4xl font-bold text-center mb-12" style={{color: 'var(--text)'}}>
            Why Choose TrackBasket?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="card-enhanced hover-lift">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-6" style={{background: 'var(--primary)'}}>
                🛍️
              </div>
              <h3 className="text-2xl font-semibold mb-4" style={{color: 'var(--text)'}}>Smart Tracking</h3>
              <p className="opacity-80 mb-6" style={{color: 'var(--text)'}}>
                Automatically monitor prices across multiple retailers and get notified when items go on sale.
              </p>
              <Link href="/search" className="btn-base px-4 py-2 text-sm" style={{background: 'var(--primary)', color: 'var(--button-text)'}}>
                Start Tracking
              </Link>
            </div>
            
            <div className="card-enhanced hover-lift">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-6" style={{background: 'var(--secondary)'}}>
                📊
              </div>
              <h3 className="text-2xl font-semibold mb-4" style={{color: 'var(--text)'}}>Price History</h3>
              <p className="opacity-80 mb-6" style={{color: 'var(--text)'}}>
                View detailed price trends and make informed decisions about when to buy.
              </p>
              <Link href="/categories" className="btn-base px-4 py-2 text-sm" style={{background: 'var(--secondary)', color: 'var(--button-text)'}}>
                View Analytics
              </Link>
            </div>
            
            <div className="card-enhanced hover-lift">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-6" style={{background: 'var(--accent)'}}>
                🎯
              </div>
              <h3 className="text-2xl font-semibold mb-4" style={{color: 'var(--text)'}}>Custom Baskets</h3>
              <p className="opacity-80 mb-6" style={{color: 'var(--text)'}}>
                Create personalized shopping baskets and track everything you want in one place.
              </p>
              <Link href="/baskets" className="btn-base px-4 py-2 text-sm" style={{background: 'var(--accent)', color: 'var(--button-text)'}}>
                Create Basket
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Getting Started Section */}
      <section className="py-20">
        <div className="container">
          <div className="max-w-4xl mx-auto">
            <div className="card-enhanced">
              <h2 className="text-3xl font-bold mb-6" style={{color: 'var(--text)'}}>Getting Started</h2>
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-xl font-semibold mb-4" style={{color: 'var(--primary)'}}>Quick Start Guide</h3>
                  <ul className="space-y-3 opacity-80" style={{color: 'var(--text)'}}>
                    <li className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold" style={{background: 'var(--primary)', color: 'var(--button-text)'}}>1</span>
                      Browse categories or search for products
                    </li>
                    <li className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold" style={{background: 'var(--secondary)', color: 'var(--button-text)'}}>2</span>
                      Create baskets to organize your tracked items
                    </li>
                    <li className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold" style={{background: 'var(--accent)', color: 'var(--button-text)'}}>3</span>
                      Get notifications when prices drop
                    </li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-4" style={{color: 'var(--secondary)'}}>Popular Categories</h3>
                  <div className="flex flex-wrap gap-2">
                    {['Electronics', 'Home & Garden', 'Fashion', 'Sports', 'Books', 'Groceries'].map((category) => (
                      <Link 
                        key={category}
                        href={`/categories/${category.toLowerCase().replace(' & ', '-').replace(' ', '-')}`}
                        className="px-3 py-1 rounded-full text-sm font-medium transition-all duration-200 hover:transform hover:-translate-y-1"
                        style={{
                          background: 'var(--surface)',
                          color: 'var(--text)',
                          border: '1px solid var(--primary)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--primary)';
                          e.currentTarget.style.color = 'var(--button-text)';
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
            <Link href="/auth/signup" className="btn-base px-8 py-4 text-lg" style={{background: 'var(--primary)', color: 'var(--button-text)'}}>
              Create Account
            </Link>
            <Link 
              href="/about" 
              className="btn-base px-8 py-4 text-lg border-2 hover:transform hover:-translate-y-1"
              style={{
                background: 'transparent',
                color: 'var(--text)',
                borderColor: 'var(--primary)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--primary)';
                e.currentTarget.style.color = 'var(--button-text)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = 'var(--text)';
              }}
            >
              Watch Demo
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
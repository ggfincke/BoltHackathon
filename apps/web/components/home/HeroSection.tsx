"use client";

import Link from 'next/link';

export default function HeroSection() {
  return (
    <section className="gradient-bg-surface py-16">
      <div className="container">
        <div className="max-w-3xl">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 gradient-text animate-fade-in-up">
            Welcome to TrackBasket
          </h1>
          <p
            className="text-xl md:text-2xl mb-8 opacity-80 animate-fade-in-up delay-100"
            style={{ color: 'var(--text)' }}
          >
            Track prices and availability across multiple retailers with ease.
            Save money and never miss a deal again.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up delay-200">
            <Link
              href="/auth/signup"
              className="btn-base px-12 py-3"
              style={{ background: 'var(--primary)', color: 'var(--dark-text)' }}
            >
              Get Started
            </Link>
            <Link
              href="/categories"
              className="btn-base px-12 py-3"
              style={{ background: 'var(--secondary)', color: 'var(--light-text)' }}
            >
              Browse Categories
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
} 
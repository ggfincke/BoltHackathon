"use client";

import Link from 'next/link';

export default function CTASection() {
  return (
    <section className="py-20 gradient-bg-primary">
      <div className="container text-center">
        <h2 className="text-4xl font-bold mb-6" style={{ color: 'var(--text)' }}>
          Ready to Start Saving?
        </h2>
        <p
          className="text-xl mb-8 opacity-80 max-w-2xl mx-auto"
          style={{ color: 'var(--text)' }}
        >
          Join thousands of smart shoppers who save money with TrackBasket&apos;s
          intelligent price tracking.
        </p>
        <div className="flex justify-center">
          <Link
            href="/auth/signup"
            className="btn-base px-12 py-4 text-lg"
            style={{ background: 'var(--primary)', color: 'var(--dark-text)' }}
          >
            Create Account
          </Link>
        </div>
      </div>
    </section>
  );
} 
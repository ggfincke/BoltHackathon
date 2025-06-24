"use client";

import Link from 'next/link';
import { FaSearch } from 'react-icons/fa';

interface WelcomeBannerProps {
  username: string;
}

export default function WelcomeBanner({ username }: WelcomeBannerProps) {
  return (
    <div className="bg-surface rounded-lg p-6 shadow-sm">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>
            Welcome back, {username}!
          </h1>
          <p className="text-lg opacity-80" style={{ color: 'var(--text)' }}>
            Track your baskets, monitor price changes, and discover new savings.
          </p>
        </div>
        <div className="mt-4 md:mt-0">
          <Link
            href="/search"
            className="btn-base px-6 py-2"
            style={{ background: 'var(--primary)', color: 'var(--dark-text)' }}
          >
            <FaSearch className="inline-block mr-2" /> Find Products
          </Link>
        </div>
      </div>
    </div>
  );
}
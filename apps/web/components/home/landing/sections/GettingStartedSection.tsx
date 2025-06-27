"use client";

import CategoryGrid from '~/components/home/CategoryGrid';

export default function GettingStartedSection() {
  return (
    <section className="py-16">
      <div className="container">
        <div className="max-w-4xl mx-auto">
          <div className="card-enhanced">
            <h2
              className="text-3xl font-bold mb-6 text-center"
              style={{ color: 'var(--text)' }}
            >
              Getting Started
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="text-center">
                <h3
                  className="text-xl font-semibold mb-4"
                  style={{ color: 'var(--primary)' }}
                >
                  How It Works
                </h3>
                <ul className="space-y-3 opacity-80" style={{ color: 'var(--text)' }}>
                  {[
                    'Search for products or browse categories',
                    'Add items to your tracking list or baskets',
                    'Set up notifications for price alerts',
                    'Save money by shopping at the best prices',
                  ].map((text, i) => {
                    const step = i + 1;
                    const bgColor =
                      step === 1
                        ? 'var(--primary)'
                        : step === 2
                        ? 'var(--secondary)'
                        : step === 3
                        ? 'var(--accent)'
                        : 'var(--primary)';
                    const color =
                      bgColor === 'var(--accent)'
                        ? 'var(--light-text)'
                        : step === 2
                        ? 'var(--light-text)'
                        : 'var(--dark-text)';
                    return (
                      <li key={step} className="flex items-center gap-3">
                        <span
                          className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold"
                          style={{ background: bgColor, color }}
                        >
                          {step}
                        </span>
                        {text}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="text-center">
                <h3
                  className="text-xl font-semibold mb-4"
                  style={{ color: 'var(--secondary)' }}
                >
                  Popular Categories
                </h3>
                <CategoryGrid />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
} 
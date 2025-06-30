"use client";

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function BoltBadge() {
  const { theme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Wait until mounted to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  // Determine if we're in dark mode
  const isDarkMode = theme === 'dark' || (theme === 'system' && systemTheme === 'dark');
  
  // Use light bolt on dark mode, dark bolt on light mode
  const svgContent = isDarkMode ? 'lightbolt.svg' : 'darkbolt.svg';

  return (
    <div 
      className="fixed bottom-4 right-4 pointer-events-none" 
      style={{ zIndex: 1 }}
    >
      <Link 
        href="https://bolt.new/"
        target="_blank"
        rel="noopener noreferrer"
        className="block w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 transition-all duration-300 hover:scale-105 hover:opacity-90 pointer-events-auto rounded-full"
        title="Built with Bolt.new"
      >
        <Image 
          src={`/${svgContent}`}
          alt="Bolt.new Badge"
          width={96}
          height={96}
          className="w-full h-full object-contain rounded-full"
        />
      </Link>
    </div>
  );
} 
"use client";

import { usePathname } from 'next/navigation';
import BoltBadge from './BoltBadge';

export default function ConditionalBoltBadge() {
  const pathname = usePathname();
  
  // Only show on home page
  if (pathname !== '/') {
    return null;
  }
  
  return <BoltBadge />;
} 
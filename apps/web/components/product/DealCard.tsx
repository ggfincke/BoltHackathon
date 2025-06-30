import React from 'react';
import Link from 'next/link';
import { FaArrowDown, FaArrowUp } from 'react-icons/fa';

export type Deal = {
  id: string;
  name: string;
  slug?: string;
  imageUrl: string;
  category: string;
  savings: number;
  bestPrice: number;
  worstPrice: number;
  bestRetailer: string;
  worstRetailer: string;
};

interface DealCardProps {
  deal: Deal;
  compact?: boolean;
}

export default function DealCard({ deal, compact = false }: DealCardProps) {
  
  return (
    <div className="product-card relative group">
      <Link href={`/product/${deal.slug ?? deal.id}`} className="block">
        <div className="product-image-container relative">
          <img 
            src={deal.imageUrl} 
            alt={deal.name}
            className="w-full h-full object-contain"
          />
          
          {/* Savings Badge */}
          <div className="absolute top-2 right-2 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 px-2 py-1 rounded-full text-xs font-bold">
            {deal.savings}% OFF
          </div>
        </div>
      </Link>
      
      <div className={compact ? "p-3" : "p-4"}>
        <Link href={`/product/${deal.slug ?? deal.id}`} className="block">
          <h3 className={`font-medium ${compact ? "text-sm mb-1" : "text-lg mb-1"} line-clamp-2 hover:text-primary transition-colors`}>
            {deal.name}
          </h3>
        </Link>
        
        <p className={`${compact ? "text-xs mb-1" : "text-sm mb-2"} text-muted`}>
          {deal.category}
        </p>
        
        <div className={compact ? "mt-1" : "mt-2"}>
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center">
              <FaArrowDown className="text-green-500 mr-1" />
              <span className={`font-bold ${compact ? "text-base" : "text-lg"}`}>
                ${deal.bestPrice.toFixed(2)}
              </span>
            </div>
            <span className={`product-retailer-badge ${compact ? "text-xs px-1.5 py-0.5" : "text-xs px-2 py-1"}`}>
              {deal.bestRetailer}
            </span>
          </div>
          
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center">
              <FaArrowUp className="text-red-500 mr-1" />
              <span className={`${compact ? "text-sm" : "text-base"} line-through opacity-70`}>
                ${deal.worstPrice.toFixed(2)}
              </span>
            </div>
            <span className={`text-xs ${compact ? "text-xs" : "text-sm"}`}>
              {deal.worstRetailer}
            </span>
          </div>
          
          <Link 
            href={`/product/${deal.slug ?? deal.id}`}
            className={`block w-full text-center ${compact ? "py-1.5 text-xs" : "py-2 text-sm"} rounded-md hover:opacity-90 transition-colors`}
            style={{ 
              background: 'var(--primary)', 
              color: 'var(--dark-text)' 
            }}
          >
            View Deal
          </Link>
        </div>
      </div>
    </div>
  );
} 
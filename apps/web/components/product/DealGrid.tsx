import Link from 'next/link';
import { useState, useMemo } from 'react';
import DealCard, { type Deal } from './DealCard';
import Pagination from '../ui/Pagination';

interface DealGridProps {
  deals: Deal[];
  emptyMessage?: string;
  itemsPerPage?: number;
}

export default function DealGrid({ 
  deals, 
  emptyMessage = "No deals found", 
  itemsPerPage = 20 
}: DealGridProps) {
  const [currentPage, setCurrentPage] = useState(1);

  // Calculate pagination
  const totalPages = Math.ceil(deals.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentDeals = deals.slice(startIndex, endIndex);

  // Reset page when deals change
  useMemo(() => {
    setCurrentPage(1);
  }, [deals]);

  if (deals.length === 0) {
    return (
      <div className="bg-surface p-8 rounded-lg shadow-sm text-center">
        <h2 className="text-xl font-semibold mb-2">{emptyMessage}</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Try adjusting your filters or check back later for new deals.
        </p>
        <Link 
          href="/categories"
          className="inline-block bg-primary text-buttonText px-4 py-2 rounded-md hover:bg-opacity-90 transition-colors"
        >
          Browse Categories
        </Link>
      </div>
    );
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of grid when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div>
      {/* Results count */}
      <div className="mb-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Showing {startIndex + 1}-{Math.min(endIndex, deals.length)} of {deals.length} products
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {currentDeals.map((deal) => (
          <DealCard 
            key={deal.id} 
            deal={deal}
          />
        ))}
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </div>
  );
} 
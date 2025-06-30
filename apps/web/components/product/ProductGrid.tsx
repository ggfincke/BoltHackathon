import Link from 'next/link';
import ProductCard from './ProductCard';

type Product = {
  id: string;
  name: string;
  slug: string;
  brand?: { name: string } | null;
  listings?: {
    id: string;
    retailer_id: string;
    price: number | null;
    currency: string | null;
    in_stock: boolean | null;
    url: string;
    image_url?: string | null;
    retailer: { name: string };
  }[];
};

interface ProductGridProps {
  products: Product[];
  emptyMessage?: string;
  onProductAdded?: () => void;
}

export default function ProductGrid({ products, emptyMessage = "No products found", onProductAdded }: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="bg-surface p-8 rounded-lg shadow-sm text-center">
        <h2 className="text-xl font-semibold mb-2">{emptyMessage}</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Try browsing other categories or using the search.
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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {products.map((product) => (
        <ProductCard 
          key={product.id} 
          product={product} 
          onProductAdded={onProductAdded}
        />
      ))}
    </div>
  );
}
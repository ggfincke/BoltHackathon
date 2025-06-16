export default function Home() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Welcome to TrackBasket</h1>
      <p className="text-lg mb-4">
        Track prices and availability across multiple retailers.
      </p>
      <div className="bg-surface p-6 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold mb-3">Getting Started</h2>
        <p>
          Browse categories, search for products, or create baskets to track your favorite items.
        </p>
      </div>
    </div>
  );
}
import Link from 'next/link';
import { BsArrowRight } from 'react-icons/bs';
import { FaShoppingBasket, FaRegBell, FaSearch } from 'react-icons/fa';

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/80 to-primary/40 z-10"></div>
        <div className="h-[500px] relative overflow-hidden">
          <img 
            src="https://images.pexels.com/photos/1660030/pexels-photo-1660030.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2" 
            alt="Fresh groceries" 
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
        <div className="container mx-auto absolute inset-0 z-20 flex items-center">
          <div className="max-w-2xl text-white p-6">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Track prices across retailers and save money</h1>
            <p className="text-lg md:text-xl mb-8">Compare prices, create shopping baskets, and get notified when prices drop.</p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/categories" className="bg-white text-primary hover:bg-gray-100 px-6 py-3 rounded-md font-medium transition-colors flex items-center justify-center">
                Browse Categories
              </Link>
              <Link href="/baskets" className="bg-transparent hover:bg-white/20 border-2 border-white text-white px-6 py-3 rounded-md font-medium transition-colors flex items-center justify-center">
                Create a Basket
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Categories */}
      <section className="py-16 bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold">Popular Categories</h2>
            <Link href="/categories" className="text-primary hover:underline flex items-center">
              View all <BsArrowRight className="ml-2" />
            </Link>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {['Beverages', 'Snacks', 'Dairy', 'Produce'].map((category, index) => (
              <Link href={`/categories/${category.toLowerCase()}`} key={index} className="group">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden transition-transform hover:shadow-md group-hover:scale-[1.02]">
                  <div className="h-40 bg-gray-200 dark:bg-gray-700 relative overflow-hidden">
                    <img 
                      src={`https://images.pexels.com/photos/${[1633525, 1906442, 248412, 1656663][index]}/pexels-photo-${[1633525, 1906442, 248412, 1656663][index]}.jpeg?auto=compress&cs=tinysrgb&w=600`} 
                      alt={category}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-4">
                    <h3 className="font-medium text-lg">{category}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Explore {category.toLowerCase()}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white dark:bg-gray-800">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">Why Use TrackBasket?</h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-surface p-6 rounded-lg shadow-sm text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <FaSearch className="text-primary text-2xl" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Compare Prices</h3>
              <p className="text-gray-600 dark:text-gray-400">Find the best deals by comparing prices across multiple retailers in real-time.</p>
            </div>
            
            <div className="bg-surface p-6 rounded-lg shadow-sm text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <FaShoppingBasket className="text-primary text-2xl" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Create Baskets</h3>
              <p className="text-gray-600 dark:text-gray-400">Organize your shopping with custom baskets and share them with family and friends.</p>
            </div>
            
            <div className="bg-surface p-6 rounded-lg shadow-sm text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <FaRegBell className="text-primary text-2xl" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Price Alerts</h3>
              <p className="text-gray-600 dark:text-gray-400">Get notified when prices drop or items come back in stock at your favorite stores.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-primary/10">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to start saving?</h2>
          <p className="text-lg mb-8 max-w-2xl mx-auto">Create an account to track prices, build shopping baskets, and get notified about the best deals.</p>
          <Link href="/auth/signup" className="bg-primary text-buttonText hover:bg-opacity-90 px-8 py-3 rounded-md font-medium transition-colors inline-block">
            Sign Up Now
          </Link>
        </div>
      </section>
    </div>
  );
}
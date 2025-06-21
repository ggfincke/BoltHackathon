import Link from 'next/link';
import { BsArrowRight } from 'react-icons/bs';
import { FaShoppingBasket, FaRegBell, FaSearch, FaChartLine, FaUsers } from 'react-icons/fa';

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero Section with Primary Color Background */}
      <section className="bg-primary py-20 relative overflow-hidden">
        <div className="absolute inset-0 bg-pattern opacity-10"></div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-2xl text-white">
            <h1 className="text-4xl md:text-5xl font-bold mb-6">Track prices across retailers and save money</h1>
            <p className="text-lg md:text-xl mb-8 text-white/90">Compare prices, create shopping baskets, and get notified when prices drop on your favorite products.</p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/categories" className="bg-white text-primary hover:bg-gray-100 px-6 py-3 rounded-md font-medium transition-colors flex items-center justify-center shadow-lg">
                Browse Categories
              </Link>
              <Link href="/baskets" className="bg-secondary text-white hover:bg-secondary/90 px-6 py-3 rounded-md font-medium transition-colors flex items-center justify-center shadow-lg">
                <FaShoppingBasket className="mr-2" />
                Create a Basket
              </Link>
            </div>
          </div>
        </div>
        <div className="hidden lg:block absolute right-0 top-0 h-full w-1/3">
          <div className="h-full w-full bg-gradient-to-l from-primary-light to-transparent"></div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-white dark:bg-gray-800 py-10 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex items-center justify-center">
              <div className="text-primary text-4xl font-bold mr-3">3+</div>
              <div className="text-gray-700 dark:text-gray-300">Major retailers tracked</div>
            </div>
            <div className="flex items-center justify-center">
              <div className="text-primary text-4xl font-bold mr-3">1000+</div>
              <div className="text-gray-700 dark:text-gray-300">Products monitored daily</div>
            </div>
            <div className="flex items-center justify-center">
              <div className="text-primary text-4xl font-bold mr-3">15%</div>
              <div className="text-gray-700 dark:text-gray-300">Average savings</div>
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
            {[
              { name: 'Beverages', image: 'https://images.pexels.com/photos/1633525/pexels-photo-1633525.jpeg', color: 'primary' },
              { name: 'Snacks', image: 'https://images.pexels.com/photos/1906442/pexels-photo-1906442.jpeg', color: 'secondary' },
              { name: 'Dairy', image: 'https://images.pexels.com/photos/248412/pexels-photo-248412.jpeg', color: 'accent' },
              { name: 'Produce', image: 'https://images.pexels.com/photos/1656663/pexels-photo-1656663.jpeg', color: 'primary' }
            ].map((category, index) => (
              <Link href={`/categories/${category.name.toLowerCase()}`} key={index} className="group">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden transition-transform hover:shadow-md group-hover:scale-[1.02] border-t-4 border-primary">
                  <div className="h-40 bg-gray-200 dark:bg-gray-700 relative overflow-hidden">
                    <img 
                      src={category.image} 
                      alt={category.name}
                      className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      <h3 className="font-medium text-lg text-white">{category.name}</h3>
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Explore {category.name.toLowerCase()}</p>
                    <div className="mt-2 flex justify-between items-center">
                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                        Best deals
                      </span>
                      <BsArrowRight className="text-primary" />
                    </div>
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
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-4">Why Use TrackBasket?</h2>
          <p className="text-center text-gray-600 dark:text-gray-400 max-w-2xl mx-auto mb-12">Our platform helps you make smarter shopping decisions and save money on your groceries.</p>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-surface p-6 rounded-lg shadow-sm text-center hover:shadow-md transition-shadow border-b-4 border-primary">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 text-white">
                <FaSearch className="text-2xl" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Compare Prices</h3>
              <p className="text-gray-600 dark:text-gray-400">Find the best deals by comparing prices across multiple retailers in real-time.</p>
            </div>
            
            <div className="bg-surface p-6 rounded-lg shadow-sm text-center hover:shadow-md transition-shadow border-b-4 border-secondary">
              <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto mb-4 text-white">
                <FaShoppingBasket className="text-2xl" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Create Baskets</h3>
              <p className="text-gray-600 dark:text-gray-400">Organize your shopping with custom baskets and share them with family and friends.</p>
            </div>
            
            <div className="bg-surface p-6 rounded-lg shadow-sm text-center hover:shadow-md transition-shadow border-b-4 border-accent">
              <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto mb-4 text-white">
                <FaRegBell className="text-2xl" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Price Alerts</h3>
              <p className="text-gray-600 dark:text-gray-400">Get notified when prices drop or items come back in stock at your favorite stores.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 bg-primary/10">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">How TrackBasket Works</h2>
          
          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-24 left-1/6 right-1/6 h-0.5 bg-primary"></div>
            
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center font-bold text-xl mb-4">1</div>
              <h3 className="text-xl font-semibold mb-3">Search Products</h3>
              <p className="text-gray-600 dark:text-gray-400">Find your favorite products across multiple retailers.</p>
            </div>
            
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center font-bold text-xl mb-4">2</div>
              <h3 className="text-xl font-semibold mb-3">Create Baskets</h3>
              <p className="text-gray-600 dark:text-gray-400">Add products to your custom shopping baskets.</p>
            </div>
            
            <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center font-bold text-xl mb-4">3</div>
              <h3 className="text-xl font-semibold mb-3">Save Money</h3>
              <p className="text-gray-600 dark:text-gray-400">Get alerts when prices drop and save on your groceries.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-16 bg-white dark:bg-gray-800">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-12">What Our Users Say</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-surface p-6 rounded-lg shadow-sm">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center mr-3">
                  <span className="text-primary font-bold">S</span>
                </div>
                <div>
                  <h4 className="font-semibold">Sarah M.</h4>
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                      </svg>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-400">"I've saved over $200 on my monthly grocery bill since I started using TrackBasket. The price alerts are a game-changer!"</p>
            </div>
            
            <div className="bg-surface p-6 rounded-lg shadow-sm">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center mr-3">
                  <span className="text-secondary font-bold">J</span>
                </div>
                <div>
                  <h4 className="font-semibold">James T.</h4>
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                      </svg>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-400">"The basket sharing feature is perfect for our family. We can all add items and find the best deals together."</p>
            </div>
            
            <div className="bg-surface p-6 rounded-lg shadow-sm">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center mr-3">
                  <span className="text-accent font-bold">L</span>
                </div>
                <div>
                  <h4 className="font-semibold">Lisa K.</h4>
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
                      </svg>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-400">"I love being able to compare prices across different stores without having to visit each website individually."</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-secondary text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to start saving?</h2>
          <p className="text-lg mb-8 max-w-2xl mx-auto opacity-90">Create an account to track prices, build shopping baskets, and get notified about the best deals.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signup" className="bg-white text-secondary hover:bg-gray-100 px-8 py-3 rounded-md font-medium transition-colors inline-block shadow-lg">
              Sign Up Now
            </Link>
            <Link href="/categories" className="bg-transparent border-2 border-white hover:bg-white/10 px-8 py-3 rounded-md font-medium transition-colors inline-block text-white">
              Browse Categories
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
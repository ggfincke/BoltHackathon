# 🛒 TrackBasket

A comprehensive price tracking and comparison web application that monitors products across major retailers (Amazon, Target, Walmart). TrackBasket helps users find the best deals by tracking price history, comparing prices across stores, and providing intelligent product recommendations.

## ✨ Features

### 🎯 For Users
- **💰 Price Tracking**: Monitor price changes for your favorite products
- **📊 Price History Charts**: Visualize price trends over time
- **🛒 Shopping Baskets**: Organize products into custom collections
- **🔍 Smart Search**: Find products across multiple retailers
- **📱 Modern UI**: Responsive design with dark/light theme support
- **👤 User Profiles**: Personalized tracking and recommendations
- **🏷️ Category Browsing**: Explore products by category hierarchy
- **⚡ Real-time Updates**: Live price updates and notifications

### 🤖 Backend Intelligence
- **🕷️ Automated Crawling**: Continuously monitors retailer websites
- **🔍 UPC Lookup**: Matches products across retailers using UPC codes
- **📊 Data Normalization**: Standardizes product information
- **⚡ High Performance**: Concurrent processing with intelligent rate limiting
- **🗄️ Robust Storage**: Supabase backend with real-time capabilities

## 🏗️ Architecture

```
TrackBasket/
├── apps/web/                   # 🌐 Next.js Web Application
│   ├── app/                   # 📱 App Router Pages
│   │   ├── auth/             # 🔐 Authentication pages
│   │   ├── baskets/          # 🛒 Shopping basket management
│   │   ├── categories/       # 🏷️ Product category browsing
│   │   ├── product/          # 📦 Product detail pages
│   │   ├── profile/          # 👤 User profile management
│   │   ├── search/           # 🔍 Product search interface
│   │   └── settings/         # ⚙️ User settings
│   ├── components/           # 🧩 React Components
│   │   ├── AuthForm.tsx      # 🔐 Authentication forms
│   │   ├── PriceComparisonTable.tsx  # 💰 Price comparison
│   │   ├── PriceHistoryChart.tsx     # 📊 Price trend charts
│   │   ├── ProductCard.tsx          # 📦 Product display cards
│   │   ├── ProductTrackingForm.tsx  # 📈 Product tracking setup
│   │   ├── NavBar.tsx              # 🧭 Navigation
│   │   └── ThemeProvider.tsx       # 🎨 Theme management
│   └── lib/                  # 📚 Utilities & Configuration
│       ├── auth.tsx          # 🔐 Authentication logic
│       ├── database.types.ts # 📊 TypeScript database types
│       └── supabaseClient.ts # 🗄️ Supabase client
├── src/                       # 🔧 Backend System
│   ├── crawlers/             # 🕷️ Web crawlers for data collection
│   │   ├── amazon/           # 📦 Amazon crawler
│   │   ├── target/           # 🎯 Target crawler
│   │   ├── walmart/          # 🏪 Walmart crawler
│   │   ├── upc_lookup/       # 🔍 UPC/barcode lookup system
│   │   └── normalizers/      # 🏷️ Data normalization
│   └── scrapers/             # 🧹 Direct product scrapers
├── supabase/                 # 🗄️ Database & Backend
│   └── migrations/           # 🔄 Database schema migrations
├── scripts/                  # 🚀 Automation Scripts
└── data/                     # 💾 Category hierarchies & processed data
```

## 🚀 Getting Started

### 📋 Prerequisites
- Node.js 22+ and npm/yarn
- Python 3.12+ for backend crawlers
- Supabase account (or local instance)

### 🏃‍♂️ Quick Setup

1. **Clone the repository**:
```bash
git clone <repository-url>
cd trackbasket
```

2. **Set up the web application**:
```bash
cd apps/web
npm install
```

3. **Configure environment variables**:
```bash
# In apps/web/.env.local
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

4. **Set up the database**:
```bash
cd supabase
npx supabase start  # For local development
# Or configure your Supabase project and run migrations
```

5. **Install backend dependencies**:
```bash
cd ../../  # Back to project root
pip install -r requirements.txt
```

6. **Start the development server**:
```bash
cd apps/web
npm run dev
```

Visit `http://localhost:3000` to see the application!

## 🌐 Web Application Features

### 🔐 Authentication
- **Sign up/Sign in**: Secure user authentication via Supabase Auth
- **Password Reset**: Email-based password recovery
- **Protected Routes**: Middleware-based route protection

### 🛒 Product Management
- **Product Tracking**: Add products to track price changes
- **Shopping Baskets**: Organize products into custom collections
- **Price Alerts**: Get notified when prices drop
- **Comparison Tables**: Side-by-side price comparison across retailers

### 📊 Analytics & Insights
- **Price History Charts**: Interactive charts showing price trends
- **Best Deals**: Automatically surface the best current deals
- **Category Analytics**: Price insights by product category

### 🎨 User Experience
- **Responsive Design**: Works seamlessly on desktop and mobile
- **Dark/Light Themes**: Toggle between theme preferences
- **Fast Search**: Instant product search with filters
- **Breadcrumb Navigation**: Easy navigation through categories

## 🤖 Backend Crawling System

### 🕷️ Automated Data Collection
The backend system continuously monitors retailer websites to keep product data fresh:

```bash
# Run manual crawls for testing
python scripts/crawl.py --retailer amazon --mode full --max-pages 3
python scripts/crawl.py --retailer target --category "Beverages" --hierarchical
python scripts/crawl.py --retailer walmart --from-hierarchy-file --concurrency 10
```

### 🔍 UPC Lookup & Matching
- **Cross-retailer Matching**: Uses UPC codes to match products across stores
- **Confidence Scoring**: Evaluates match reliability
- **Fallback Services**: Multiple UPC lookup providers
- **Intelligent Caching**: Reduces API costs and improves performance

### 📊 Data Processing
- **Category Normalization**: Standardizes product categories
- **Price History Tracking**: Maintains historical price data
- **Deduplication**: Prevents duplicate product entries
- **Real-time Updates**: Pushes updates to web app via Supabase real-time

## 🗄️ Database Schema

The application uses Supabase with the following core tables:
- **users**: User profiles and preferences
- **products**: Core product information with UPC codes
- **listings**: Retailer-specific product listings and prices
- **categories**: Hierarchical category structure
- **price_histories**: Historical price tracking
- **user_baskets**: User shopping basket collections

## 🛠️ Development

### 🧪 Running Tests
```bash
# Frontend tests
cd apps/web
npm test

# Backend tests
python -m pytest
```

### 🔧 Adding New Retailers
1. Create crawler in `src/crawlers/{retailer}/`
2. Implement retailer-specific parsing logic
3. Add retailer configuration to scripts
4. Update database with retailer information

### 📱 Frontend Development
The web app uses modern React patterns:
- **App Router**: Next.js 13+ app directory structure
- **Server Components**: Efficient server-side rendering
- **TypeScript**: Full type safety across the stack
- **Tailwind CSS**: Utility-first styling
- **Radix UI**: Accessible component primitives

## 🚀 Deployment

### 🌐 Web Application
Deploy the Next.js app to Vercel, Netlify, or your preferred platform:

```bash
cd apps/web
npm run build
```

### 🤖 Backend Crawlers
Set up automated crawling with cron jobs or cloud functions:

```bash
# Example cron job for daily crawling
0 2 * * * cd /path/to/trackbasket && python scripts/crawl.py --retailer amazon --from-hierarchy-file
```

### 🗄️ Database
- Use Supabase hosted database for production
- Set up proper RLS (Row Level Security) policies
- Configure backups and monitoring

## 📈 Performance & Scaling

### ⚡ Frontend Optimization
- **Static Generation**: Pre-render category and product pages
- **Image Optimization**: Next.js automatic image optimization
- **Code Splitting**: Automatic route-based code splitting
- **Caching**: Intelligent caching with ISR (Incremental Static Regeneration)

### 🔧 Backend Optimization
- **Concurrent Crawling**: Configurable worker pools
- **Rate Limiting**: Respectful crawling with intelligent delays
- **Caching**: Redis for UPC lookups and temporary data
- **Database Indexing**: Optimized queries for fast searches

## 🔐 Security

- **Authentication**: Supabase Auth with RLS policies
- **API Security**: Protected API routes with middleware
- **Data Validation**: Input validation on both client and server
- **CAPTCHA Handling**: Automated CAPTCHA solving for crawlers

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
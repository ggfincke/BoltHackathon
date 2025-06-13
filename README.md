# 🛒 TrackBasket

A comprehensive web crawling system for extracting product data from major retail websites (Amazon, Target, Walmart) with advanced features including UPC lookup, multiple output backends (JSON files, Redis queues, Supabase database), and hierarchical category processing.

## 📁 Project Structure

```
├── src/                        # 💻 Source code
│   ├── crawlers/              # 🕷️ Web crawlers for discovering and extracting data
│   │   ├── base_crawler.py    # 🏗️ Base classes and interfaces
│   │   ├── supabase_backend.py # 🗄️ Supabase database backend
│   │   ├── upc_lookup/        # 🔍 UPC/barcode lookup functionality
│   │   │   ├── base_upc_lookup.py    # 🎯 Base UPC lookup interface
│   │   │   ├── barcode_lookup.py     # 📊 BarcodeLookup.com service
│   │   │   └── upc_manager.py        # 🎛️ Multi-service UPC manager
│   │   ├── normalizers/       # 🏷️ Category normalization utilities
│   │   ├── amazon/            # 📦 Amazon-specific crawler implementation
│   │   ├── target/            # 🎯 Target-specific crawler implementation
│   │   └── walmart/           # 🏪 Walmart-specific crawler implementation
│   ├── scrapers/              # 🧹 Direct product scrapers (alternative approach)
│   │   ├── base_scraper.py    # 🏗️ Base scraper class
│   │   ├── amazon/            # 📦 Amazon product scraper
│   │   ├── target/            # 🎯 Target product scraper
│   │   └── walmart/           # 🏪 Walmart product scraper
│   ├── data_processing/       # ⚙️ Data processing utilities (future expansion)
│   └── utils/                 # 🔧 Shared utilities (future expansion)
├── scripts/                   # 🚀 Executable scripts
│   ├── crawl.py              # 🎮 Main crawler CLI interface
│   └── crawl.sh              # 🐚 Shell script wrapper
├── data/                      # 💾 Data storage
│   ├── raw/                  # 📥 Raw data files
│   └── processed/            # 📤 Processed data outputs and hierarchy files
│       ├── amazon_grocery_hierarchy.json    # 📦 Pre-built Amazon categories
│       ├── target_grocery_hierarchy.json    # 🎯 Pre-built Target categories
│       ├── walmart_grocery_hierarchy.json   # 🏪 Pre-built Walmart categories
│       └── categories.json                  # 🏷️ General category mappings
├── config/                    # ⚙️ Configuration files (future expansion)
├── docs/                      # 📚 Additional documentation
│   └── README.md             # 📖 Detailed crawler documentation
├── supabase/                  # 🗄️ Supabase configuration
│   ├── migrations/           # 🔄 Database migrations
│   └── config.toml           # ⚙️ Supabase configuration
├── temp/                      # 🗂️ Temporary files and utilities
├── test.py                   # 🧪 Test scripts
├── requirements.txt          # 📋 Python dependencies
└── README.md                 # 📄 This file
```

## 🚀 Quick Start

### 📥 Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd trackbasket
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set up environment variables (optional):
```bash
export REDIS_URL="redis://localhost:6379"
export SUPABASE_URL="your-supabase-url"
export SUPABASE_ANON_KEY="your-supabase-key"
```

### 🎯 Basic Usage

```bash
# 📋 List available retailers
python scripts/crawl.py --list-retailers

# 🔌 Test connections
python scripts/crawl.py --test-redis

# 🛍️ Basic crawling examples
python scripts/crawl.py --retailer amazon --mode full --max-pages 3
python scripts/crawl.py --retailer target --mode urls-only --category "Beverages"
python scripts/crawl.py --retailer walmart --mode full --hierarchical
python scripts/crawl.py --retailer amazon --from-hierarchy-file --concurrency 10
```

## 🔑 Key Features

### 🕷️ Crawlers vs 🧹 Scrapers

- **🕷️ Crawlers** (`src/crawlers/`): Discover product categories and URLs, then extract product data at scale with UPC enrichment
- **🧹 Scrapers** (`src/scrapers/`): Direct product data extraction from individual product pages

### 🔍 UPC Lookup
The system includes sophisticated UPC/barcode lookup capabilities:
- **🔄 Multi-service fallback**: Automatically tries multiple UPC lookup services
- **💾 Intelligent caching**: Reduces redundant API calls and improves performance  
- **⭐ Confidence scoring**: Evaluates the reliability of UPC matches
- **🎯 Product name matching**: Uses fuzzy matching to find UPCs for product names
  
### 📤 Output Backends

1. **📄 JSON Files**: Store data in JSON format (default for full mode)
2. **⚡ Redis**: Store URLs in Redis queues (default for urls-only mode)  
3. **🗄️ Supabase**: Store structured data directly in database with automatic UPC lookup

### 🛠️ Crawling Modes

- **🔍 Full Mode**: Extract complete product data (title, price, URL, UPC when available)
- **🔗 URLs Only**: Extract only product URLs for memory efficiency
- **🌳 Hierarchical**: Build category structure with products at leaf nodes

## 🚀 Advanced Features

### 📊 Hierarchy File Mode
Use pre-built category hierarchies for faster, more targeted crawling:

```bash
# ⚡ Use default hierarchy file with high concurrency
python scripts/crawl.py --retailer amazon --from-hierarchy-file --mode urls-only --concurrency 15

# 📁 Use custom hierarchy file
python scripts/crawl.py --retailer target --from-hierarchy-file my_hierarchy.json --mode full

# 🎯 Filter hierarchy to specific categories
python scripts/crawl.py --retailer walmart --from-hierarchy-file --category "Beverages" --mode full
```

### 🏷️ Category Filtering
Target specific categories or departments:

```bash
python scripts/crawl.py --retailer walmart --category "Beverages" --mode full
python scripts/crawl.py --retailer amazon --department "Amazon Grocery" --hierarchical
python scripts/crawl.py --retailer target --department "Target Grocery" --max-pages 10
```

### ⚡ Concurrent Processing
Optimize performance with adjustable concurrency:

```bash
python scripts/crawl.py --retailer target --from-hierarchy-file --concurrency 20 --max-pages 5
```

### 📤 Advanced Output Options
Control output format and destination:

```bash
# 📝 Custom output file names
python scripts/crawl.py --retailer amazon --mode full --output custom_amazon_crawl

# 🌳 Hierarchical JSON output
python scripts/crawl.py --retailer walmart --hierarchical --output walmart_hierarchy
```

## 📊 Data Outputs

### 📄 JSON Files
- **📍 Location**: Project root directory
- **📋 Format**: ND-JSON (one object per line) or hierarchical JSON
- **🏷️ Naming**: `{prefix}_{timestamp}.json`
- **📦 Content**: Product data with UPC codes when available

### ⚡ Redis Queues
- **🔑 Keys**: `product_urls:{retailer_id}`
- **📋 Format**: Plain URLs as strings
- **🎯 Use case**: URL collection for batch processing

### 🗄️ Supabase Database
- **📊 Tables**: products, listings, categories, brands, price_histories, upcs
- **✨ Features**: Automatic deduplication, category normalization, price tracking, UPC enrichment

## ⚙️ Configuration

### 🌍 Environment Variables
- `CRAWLER_MAX_DEPTH`: Maximum crawling depth (default: 10)
- `CRAWLER_CONCURRENCY`: Number of concurrent workers (default: 5)
- `REDIS_URL`: Redis connection URL
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key

### 📊 Pre-built Category Hierarchies
Each retailer has optimized category hierarchy files in `data/processed/`:
- 📦 Amazon: `amazon_grocery_hierarchy.json` (7,335 lines)
- 🎯 Target: `target_grocery_hierarchy.json` (1,017 lines)  
- 🏪 Walmart: `walmart_grocery_hierarchy.json` (3,329 lines)

### 🔍 UPC Lookup Configuration
- **📊 BarcodeLookup.com**: Primary UPC lookup service with fuzzy matching
- **💾 Caching**: Intelligent caching of both positive and negative results
- **🔄 Fallback**: Automatic fallback to additional services when available

## 🎮 CLI Reference

### 🔧 Main Arguments
- `--retailer, -r`: Choose retailer (amazon, target, walmart)
- `--mode, -m`: Crawling mode (full, urls-only)
- `--hierarchical`: Build/output hierarchical structure
- `--from-hierarchy-file [FILE]`: Use pre-built hierarchy (much faster)

### 🎯 Filtering Options
- `--department, -d`: Target specific department
- `--category, -c`: Target specific category  
- `--max-pages, -p`: Limit pages per category (default: 5)

### ⚡ Performance Options
- `--concurrency`: Concurrent workers (default: 5, recommended: 10-20 for hierarchy mode)
- `--output, -o`: Custom output file prefix
- `--log-level, -l`: Logging verbosity (DEBUG, INFO, WARNING, ERROR)

### 🔧 Utility Commands
- `--list-retailers`: Show available retailers and their configurations
- `--test-redis`: Test Redis connectivity

## 📦 Dependencies

Key Python packages required:
- `redis` - ⚡ Redis queue backend
- `pydantic` - ✅ Data validation and serialization
- `requests` - 🌐 HTTP client for web requests
- `beautifulsoup4` - 🍜 HTML parsing
- `selenium` - 🤖 Browser automation
- `playwright` - 🎭 Modern browser automation
- `undetected-chromedriver` - 🕵️ Anti-detection browser driver
- `easyocr` - 👁️ OCR for image-based UPC extraction
- `torch`, `opencv-python` - 🤖 Computer vision dependencies

## 🛠️ Development

### 🏗️ Project Structure Benefits
- **🎯 Clear separation of concerns**: Crawlers, scrapers, and utilities are organized separately
- **🧩 Modular design**: Easy to add new retailers or UPC lookup services
- **📈 Scalable architecture**: Supports multiple output backends and processing modes
- **🔄 No circular dependencies**: Clean import structure

### 🆕 Adding New Retailers
1. Create retailer directory in `src/crawlers/`
2. Implement crawler class inheriting from `BaseCrawler`
3. Add configuration to `scripts/crawl.py` `RETAILER_CONFIG`
4. Create category hierarchy file in `data/processed/`

### 🔍 Adding UPC Lookup Services
1. Implement service class inheriting from `BaseUPCLookup`
2. Add to `UPCManager._initialize_default_services()`
3. Configure fallback priority and caching behavior

### 🧪 Testing
```bash
python test.py
```

## ⚡ Performance Tips

### 🚀 Fastest Crawling
- Use `--from-hierarchy-file` mode (10x faster than discovery crawling)
- Set `--concurrency 15-20` for hierarchy mode
- Use `--mode urls-only` for maximum memory efficiency

### 🏭 Production Deployment
- Enable Redis for URL queue management
- Configure Supabase for structured data storage
- Monitor UPC lookup cache hit rates for cost optimization

### 💾 Memory Optimization
- Use URLs-only mode for large crawls
- Process data in batches via Redis queues
- Clear UPC lookup cache periodically in long-running processes

## 🔧 Troubleshooting

### ❗ Common Issues
1. **📥 Import errors**: Ensure you're running scripts from the project root
2. **📦 Missing dependencies**: Install all requirements, especially computer vision packages
3. **🔍 UPC lookup failures**: Check internet connectivity and service rate limits
4. **💾 High memory usage**: Use urls-only mode or reduce concurrency

### ⚡ Performance Issues
- Monitor UPC lookup service response times
- Adjust concurrency based on system resources and target site limits  
- Use hierarchy files instead of discovery crawling when possible

## 📄 License

[Add your license information here]

## 🤝 Contributing

[Add contribution guidelines here] 
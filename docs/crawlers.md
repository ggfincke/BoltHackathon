# 🕷️ Crawlers Subsystem

The crawlers subsystem (`src/crawlers/`) is the core web crawling engine that discovers and extracts product data from major retail websites. It provides a unified interface for crawling Amazon, Target, and Walmart with advanced features like UPC lookup, category hierarchies, and multiple output backends.

## 🏗️ Architecture Overview

```
src/crawlers/
├── base_crawler.py          # 🧱 Base crawler classes and interfaces
├── supabase_backend.py      # 🗄️ Supabase database integration
├── upc_lookup/              # 🔍 UPC/barcode lookup services
│   ├── base_upc_lookup.py   # 📋 Abstract UPC lookup interface
│   ├── barcode_lookup.py    # 🏷️ BarcodeLookup.com integration
│   └── upc_manager.py       # 🎯 Multi-service UPC management
├── normalizers/             # 🔧 Category and data normalization
├── amazon/                  # 📦 Amazon-specific crawler
├── target/                  # 🎯 Target-specific crawler
└── walmart/                 # 🏪 Walmart-specific crawler
```

## 🔧 Core Components

### 🧱 Base Crawler (`base_crawler.py`)

The foundation for all retailer-specific crawlers, providing:
- ✨ Abstract base classes defining crawler interfaces
- 🛠️ Common crawling patterns and utilities
- 🛡️ Error handling and retry mechanisms
- 🔗 Session management for web scraping
- 📊 Category hierarchy processing

**🔑 Key Classes:**
- `BaseCrawler`: Abstract base for all crawlers
- `CategoryCrawler`: Specialized for category-based crawling
- `ProductCrawler`: Specialized for product data extraction

### 🔍 UPC Lookup System (`upc_lookup/`)

A sophisticated system for enriching product data with UPC/barcode information:

#### ✨ Features:
- 🔄 **Multi-service fallback**: Automatically tries multiple UPC lookup services
- 🧠 **Intelligent caching**: Reduces redundant API calls with smart caching
- 📊 **Confidence scoring**: Evaluates reliability of UPC matches
- 🎯 **Fuzzy matching**: Uses product name similarity for UPC discovery
- ⏱️ **Rate limiting**: Respects API limits and handles throttling

#### 🏗️ Components:
- **`base_upc_lookup.py`**: Abstract interface for UPC lookup services
- **`barcode_lookup.py`**: BarcodeLookup.com API integration with fuzzy matching
- **`upc_manager.py`**: Orchestrates multiple UPC services with failover

#### 💡 Usage Example:
```python
from src.crawlers.upc_lookup.upc_manager import UPCManager

upc_manager = UPCManager()
upc_data = await upc_manager.lookup_upc_by_name("Coca Cola 12oz")
if upc_data:
    print(f"UPC: {upc_data['upc']}, Confidence: {upc_data['confidence']}")
```

### 🗄️ Supabase Backend (`supabase_backend.py`)

Provides direct database integration for storing crawled data:

#### ✨ Features:
- 📊 **Structured data storage**: Organized tables for products, categories, brands, etc.
- 🚫 **Automatic deduplication**: Prevents duplicate entries across crawls
- 📈 **Price tracking**: Historical price data for trend analysis
- 🏷️ **Category normalization**: Standardizes category names across retailers
- 🔍 **UPC enrichment**: Automatically enhances products with UPC data

#### 🗃️ Database Schema:
- `products`: Core product information
- `listings`: Retailer-specific product listings
- `categories`: Normalized category hierarchy
- `brands`: Brand information and normalization
- `price_histories`: Historical pricing data
- `upcs`: UPC/barcode mappings

## 🛍️ Retailer-Specific Crawlers

### 📦 Amazon Crawler (`amazon/`)
- 🌳 Category hierarchy discovery
- 📊 Product grid crawling
- 🔍 Search result processing
- 🎯 Amazon-specific data extraction patterns
- 🏢 Department-based organization

### 🎯 Target Crawler (`target/`)
- 🌐 Target.com category navigation
- 📄 Product page scraping
- 💰 Price and availability tracking
- 🆔 Target-specific identifiers

### 🏪 Walmart Crawler (`walmart/`)
- 🌐 Walmart.com product discovery
- 📊 Category-based crawling
- 🎯 Walmart-specific data patterns
- 🌍 Regional availability tracking

## 📋 Crawling Modes

### 🔍 Full Mode
Extracts complete product information:
- 📝 Product title and description
- 💰 Price and availability
- 🔗 Product URLs and images
- 🆔 Retailer-specific IDs
- 🏷️ UPC codes (when available)
- 📂 Category classifications

### 🔗 URLs-Only Mode
Memory-efficient URL collection:
- 🎯 Extracts only product URLs
- ⚡ Optimized for batch processing
- 💾 Lower memory footprint
- 🚀 Faster category traversal

### 🌳 Hierarchical Mode
Builds complete category structures:
- 📊 Nested category hierarchies
- 📁 Products organized by category
- 📄 JSON output with tree structure
- 🎯 Comprehensive category coverage

## ⚙️ Configuration and Customization

### 🌍 Environment Variables
```bash
CRAWLER_MAX_DEPTH=10          # 📏 Maximum crawling depth
CRAWLER_CONCURRENCY=5         # ⚡ Concurrent crawlers
UPC_LOOKUP_ENABLED=true       # 🔍 Enable UPC enrichment
UPC_CACHE_SIZE=10000         # 💾 UPC cache size
```

### 📂 Category Configuration
Each retailer has customizable category configurations:
- 🗺️ Department mappings
- 🔗 Category URL patterns
- ⭐ Crawling priorities
- 🚫 Exclusion rules

### 🚀 Performance Tuning
- ⚡ **Concurrency levels**: Adjust based on system resources
- ⏱️ **Rate limiting**: Respect retailer robots.txt and ToS
- 🧠 **Caching strategies**: Optimize for repeated crawls
- 💾 **Memory management**: Handle large datasets efficiently

## 🛡️ Error Handling and Resilience

### 🔄 Retry Mechanisms
- 🔁 Automatic retry for transient failures
- 📈 Exponential backoff for rate limiting
- ⚡ Circuit breaker patterns for service failures
- 🌟 Graceful degradation when services unavailable

### 📊 Monitoring and Logging
- 📝 Comprehensive logging at multiple levels
- ⏱️ Performance metrics and timing
- 🚨 Error tracking and categorization
- 📈 Progress reporting for long-running crawls

### ✅ Data Quality Assurance
- ✔️ Product data validation
- 🚫 Duplicate detection and handling
- 🔍 Consistency checks across retailers
- 🏷️ UPC validation and verification

## 🔌 Integration Points

### 📮 Redis Integration
- 📋 URL queue management
- 🌐 Distributed crawling coordination
- 💾 Result caching and storage
- 📊 Progress tracking across workers

### 📄 JSON File Output
- 📊 Structured data export
- 🌳 Hierarchical organization
- 🔄 Batch processing support
- 👁️ Human-readable formats

### 🔌 API Integrations
- 🔍 UPC lookup services
- 💰 Price tracking APIs
- 📂 Category mapping services
- ✨ Product enrichment APIs

## 📖 Best Practices

### 👨‍💻 Development Guidelines
1. **🧱 Extend base classes**: Use `BaseCrawler` for new retailers
2. **🔌 Implement interfaces**: Follow UPC lookup patterns for new services
3. **⏱️ Handle rate limits**: Respect retailer terms of service
4. **🧪 Test thoroughly**: Validate against real retailer sites
5. **📚 Document patterns**: Maintain clear crawler documentation

### 🏗️ Operational Guidelines
1. **📊 Monitor performance**: Track crawling speed and success rates
2. **⚖️ Manage resources**: Balance concurrency with system capacity
3. **✅ Validate data**: Regularly check data quality and completeness
4. **🔄 Update patterns**: Keep crawler patterns current with site changes
5. **💾 Backup configurations**: Maintain version control for configurations

## 🔧 Troubleshooting

### ⚠️ Common Issues
- **⏱️ Rate limiting**: Reduce concurrency or add delays
- **🔄 Site changes**: Update crawler patterns for layout changes
- **🔍 UPC lookup failures**: Check API keys and service status
- **💾 Memory issues**: Use URLs-only mode for large crawls
- **🗄️ Database errors**: Verify Supabase connection and schema

### 🛠️ Debug Tools
```bash
# 🔍 Enable debug logging
python scripts/crawl.py --retailer amazon --log-level DEBUG

# 🧪 Test specific components
python scripts/crawl.py --test-redis
python scripts/crawl.py --test-upc-lookup

# ✅ Validate configurations
python scripts/crawl.py --validate-config
``` 
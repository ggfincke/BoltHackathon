# Retail Web Crawler Project

A comprehensive web crawling system for extracting product data from major retail websites (Amazon, Target, Walmart) with support for multiple output backends including JSON files, Redis queues, and Supabase database.

## Project Structure

```
├── src/                        # Source code
│   ├── crawlers/              # Web crawlers for discovering and extracting data
│   │   ├── base_crawler.py    # Base classes and interfaces
│   │   ├── supabase_backend.py # Supabase database backend
│   │   ├── normalizers/       # Category normalization utilities
│   │   ├── amazon/            # Amazon-specific crawler implementation
│   │   ├── target/            # Target-specific crawler implementation
│   │   └── walmart/           # Walmart-specific crawler implementation
│   ├── scrapers/              # Direct product scrapers (alternative approach)
│   │   ├── base_scraper.py    # Base scraper class
│   │   ├── amazon/            # Amazon product scraper
│   │   ├── target/            # Target product scraper
│   │   └── walmart/           # Walmart product scraper
│   ├── data_processing/       # Data processing utilities (future)
│   └── utils/                 # Shared utilities (future)
├── scripts/                   # Executable scripts
│   ├── crawl.py              # Main crawler CLI interface
│   ├── crawl.sh              # Shell script wrapper
│   └── test.py               # Test scripts
├── data/                      # Data storage
│   ├── raw/                  # Raw data files (categories.json, etc.)
│   └── processed/            # Processed data outputs
├── config/                    # Configuration files (future)
├── docs/                      # Documentation
│   └── README.md             # Detailed crawler documentation
├── supabase/                  # Supabase configuration
│   ├── migrations/           # Database migrations
│   └── config.toml           # Supabase configuration
├── requirements.txt           # Python dependencies
└── README.md                 # This file
```

## Quick Start

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd BoltHackathon
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

### Basic Usage

```bash
# List available retailers
python scripts/crawl.py --list-retailers

# Test connections
python scripts/crawl.py --test-redis

# Basic crawling examples
python scripts/crawl.py --retailer amazon --mode full --max-pages 3
python scripts/crawl.py --retailer target --mode urls-only --category "Beverages"
python scripts/crawl.py --retailer walmart --mode full --hierarchical
```

## Components

### Crawlers vs Scrapers

- **Crawlers** (`src/crawlers/`): Discover product categories and URLs, then extract product data at scale
- **Scrapers** (`src/scrapers/`): Direct product data extraction from individual product pages

### Output Backends

1. **JSON Files**: Store data in JSON format (default for full mode)
2. **Redis**: Store URLs in Redis queues (default for urls-only mode)
3. **Supabase**: Store structured data directly in database (requires setup)

### Crawling Modes

- **Full Mode**: Extract complete product data (title, price, URL, etc.)
- **URLs Only**: Extract only product URLs for memory efficiency
- **Hierarchical**: Build category structure with products at leaf nodes

## Advanced Features

### Hierarchy File Mode
Use pre-built category hierarchies for faster crawling:

```bash
# Use default hierarchy file
python scripts/crawl.py --retailer amazon --from-hierarchy-file --mode urls-only --concurrency 10

# Use custom hierarchy file
python scripts/crawl.py --retailer target --from-hierarchy-file my_hierarchy.json --mode full
```

### Category Filtering
Target specific categories or departments:

```bash
python scripts/crawl.py --retailer walmart --category "Beverages" --mode full
python scripts/crawl.py --retailer amazon --department "Amazon Grocery" --hierarchical
```

### Concurrent Processing
Adjust concurrency for better performance:

```bash
python scripts/crawl.py --retailer target --from-hierarchy-file --concurrency 15 --max-pages 5
```

## Data Outputs

### JSON Files
- **Location**: Project root directory
- **Format**: ND-JSON (one object per line) or hierarchical JSON
- **Naming**: `{prefix}_{timestamp}.json`

### Redis Queues
- **Keys**: `product_urls:{retailer_id}`
- **Format**: Plain URLs as strings

### Supabase Database
- **Tables**: products, listings, categories, brands, price_histories
- **Features**: Automatic deduplication, category normalization, price tracking

## Configuration

### Environment Variables
- `CRAWLER_MAX_DEPTH`: Maximum crawling depth (default: 10)
- `CRAWLER_CONCURRENCY`: Number of concurrent workers (default: 3)
- `REDIS_URL`: Redis connection URL
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key

### Category Configuration Files
Each retailer has its own category hierarchy file:
- Amazon: `src/crawlers/amazon/amazon_grocery_hierarchy.json`
- Target: `src/crawlers/target/target_grocery_hierarchy.json`
- Walmart: `src/crawlers/walmart/walmart_grocery_hierarchy.json`

## Development

### Project Structure Benefits
- **Clear separation of concerns**: Crawlers, scrapers, and utilities are organized separately
- **Modular design**: Easy to add new retailers or modify existing ones
- **Scalable architecture**: Supports multiple output backends and processing modes
- **Clean imports**: No circular dependencies or path issues

### Adding New Retailers
1. Create retailer directory in `src/crawlers/`
2. Implement crawler class inheriting from `BaseCrawler`
3. Add configuration to `scripts/crawl.py`
4. Create category hierarchy file

### Testing
```bash
python scripts/test.py
```

## Troubleshooting

### Common Issues
1. **Import errors**: Ensure you're running scripts from the project root
2. **Missing dependencies**: Install all requirements from requirements.txt
3. **Redis connection**: Verify Redis is running and accessible
4. **Supabase errors**: Check your API keys and database setup

### Performance Optimization
- Use `--from-hierarchy-file` mode for fastest crawling
- Adjust `--concurrency` based on your system capabilities
- Use `--mode urls-only` for memory-efficient operation

## License

[Add your license information here]

## Contributing

[Add contribution guidelines here] 
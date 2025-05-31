# Crawler Command Line Interface

The `crawl.py` script provides a unified interface to run different retailer crawlers with various configurations and output modes.

## Quick Start

```bash
# List available retailers
python crawl.py --list-retailers

# Test Redis connection
python crawl.py --test-redis

# Run a basic Amazon crawl
python crawl.py --retailer amazon --mode full

# Run Target crawler for a specific category
python crawl.py --retailer target --mode urls-only --category "Beverages"

# Run Amazon hierarchical crawl with full product data
python crawl.py --retailer amazon --mode full --hierarchical

# Run Target hierarchical crawl with URLs only
python crawl.py --retailer target --mode urls-only --hierarchical --category "Electronics"
```

## Usage

```bash
python crawl.py [OPTIONS]
```

## Options

### Required Arguments

- `--retailer`, `-r`: Retailer to crawl
  - Choices: `amazon`, `target`

### Optional Arguments

- `--mode`, `-m`: Crawling mode (default: `full`)
  - `full`: Extract complete product data (title, price, URL, etc.)
  - `urls-only`: Extract only product URLs (memory efficient, sends to Redis by default)

- `--hierarchical`: Build hierarchical category structure (flag)
  - When used with `--mode full`: Creates hierarchy with full product data at leaf nodes
  - When used with `--mode urls-only`: Creates hierarchy with just URLs at leaf nodes
  - Always outputs to JSON file regardless of mode

- `--category`, `-c`: Specific category to crawl (optional)
  - If not specified, crawls all available categories
  - Category names are case-sensitive

- `--max-pages`, `-p`: Maximum pages to crawl per category (default: 5)
  - Controls depth of crawling within each category

- `--output`, `-o`: Output file prefix (optional)
  - Used for JSON file outputs
  - If not specified, uses default naming with timestamp

- `--log-level`, `-l`: Logging level (default: `INFO`)
  - Choices: `DEBUG`, `INFO`, `WARNING`, `ERROR`

### Utility Arguments

- `--list-retailers`: List available retailers and exit
- `--test-redis`: Test Redis connection and exit

## Examples

### Basic Product Crawling
```bash
# Crawl Amazon products (full data)
python crawl.py --retailer amazon --mode full --max-pages 3

# Crawl Target products with custom output file
python crawl.py --retailer target --mode full --output target_products
```

### URL-Only Mode (Memory Efficient)
```bash
# Extract Amazon URLs to Redis
python crawl.py --retailer amazon --mode urls-only

# Extract Target URLs for specific category
python crawl.py --retailer target --mode urls-only --category "Grocery"
```

### Hierarchical Mode
```bash
# Build complete Amazon category hierarchy with full product data
python crawl.py --retailer amazon --mode full --hierarchical --max-pages 2

# Build Target hierarchy with URLs only for specific category
python crawl.py --retailer target --mode urls-only --hierarchical --category "Electronics"

# Build Amazon hierarchy with custom output file
python crawl.py --retailer amazon --mode full --hierarchical --output amazon_hierarchy
```

### Debug Mode
```bash
# Run with verbose debugging
python crawl.py --retailer amazon --mode full --log-level DEBUG
```

## Output Modes

### Full Mode (Default)
- Extracts complete product data including title, price, URL, and retailer-specific IDs
- Without `--hierarchical`: Outputs to JSON file with one product per line (ND-JSON format)
- With `--hierarchical`: Outputs single JSON file with nested category structure and products at leaf nodes
- File naming: `product_crawl_YYYYMMDD_HHMMSS.json` or `hierarchical_crawl_YYYYMMDD_HHMMSS.json`

### URL-Only Mode
- Extracts only product URLs for memory efficiency
- Without `--hierarchical`: Sends to Redis by default, or JSON file if `--output` specified
- With `--hierarchical`: Always outputs to JSON file with nested structure and URLs at leaf nodes
- File naming: `hierarchical_crawl_YYYYMMDD_HHMMSS.json` (when hierarchical)

### Hierarchical Structure
- The `--hierarchical` flag can be combined with either mode
- Builds complete category tree structure with data attached to leaf nodes
- Always outputs to JSON file with nested structure
- Structure depends on the mode:
  - With `--mode full`: Full product objects at leaf nodes
  - With `--mode urls-only`: Just URL strings at leaf nodes

## Environment Variables

The crawlers respect several environment variables for configuration:

- `CRAWLER_MAX_DEPTH`: Maximum crawling depth (default: 10)
- `CRAWLER_CONCURRENCY`: Number of concurrent workers (default: 3)
- `REDIS_URL`: Redis connection URL
- `AMZ_CATEGORY_CONFIG`: Path to Amazon category configuration file
- `TARGET_CATEGORY_CONFIG`: Path to Target category configuration file

## Error Handling

The script includes comprehensive error handling:

- Invalid retailer names are caught and reported
- Category names are validated against configuration files
- Redis connection issues are detected and reported
- Crawler failures are logged with appropriate detail level
- Graceful handling of Ctrl+C interruption

## Troubleshooting

### Redis Connection Issues
```bash
# Test Redis connection
python crawl.py --test-redis
```

### Category Not Found
```bash
# List available retailers to check spelling
python crawl.py --list-retailers

# Use debug mode to see detailed category resolution
python crawl.py --retailer amazon --category "YourCategory" --log-level DEBUG
```

### Import Errors
Make sure you're running from the correct directory and have all dependencies installed:
```bash
# From the project root directory
python crawl.py --retailer amazon --mode full
```

## Advanced Usage

### Shell Wrapper (`crawl.sh`)

The included shell wrapper provides convenient shortcuts:

```bash
# Quick crawls
./crawl.sh quick-amazon
./crawl.sh quick-target

# URL-only crawls
./crawl.sh urls-amazon
./crawl.sh urls-target --category "Beverages"

# Hierarchical crawls (full data)
./crawl.sh hierarchy-amazon
./crawl.sh hierarchy-target --max-pages 3

# Hierarchical crawls (URLs only)
./crawl.sh hierarchy-urls-amazon --category "Electronics"
./crawl.sh hierarchy-urls-target --output my_hierarchy

# Utility commands
./crawl.sh list
./crawl.sh test-redis

# Direct pass-through
./crawl.sh -- --retailer amazon --mode full --hierarchical --category "Books"
```

### Custom Output Backends
The script automatically selects appropriate output backends based on mode:
- Full mode: JSON file backend
- URL-only mode: Redis backend (or JSON if `--output` specified)
- Hierarchical mode: JSON file backend with hierarchical structure

### Category Filtering
Category names are resolved from the configuration files in each crawler directory:
- Amazon: `crawlers/amazon/amazon_grocery_hierarchy.json`
- Target: `crawlers/target/target_grocery_hierarchy.json`

Category matching is exact and case-sensitive. Use the debug log level to see category resolution details. 
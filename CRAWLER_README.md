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

# Run Amazon crawl from existing hierarchy file with high concurrency
python crawl.py --retailer amazon --from-hierarchy-file --mode urls-only --concurrency 10

# Run Target crawl from custom hierarchy file
python crawl.py --retailer target --from-hierarchy-file my_hierarchy.json --mode full --max-pages 3
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

- `--from-hierarchy-file [FILE]`: **NEW** Load hierarchy from existing JSON file and crawl all leaf categories
  - If `FILE` is specified: Uses the specified hierarchy file
  - If `FILE` is omitted: Uses default hierarchy file for the retailer
  - Cannot be used with `--category`, `--department`, or `--hierarchical`
  - Enables concurrent grid crawling for maximum performance

- `--category`, `-c`: Specific category to crawl (optional)
  - If not specified, crawls all available categories
  - Category names are case-sensitive
  - Cannot be used with `--from-hierarchy-file`

- `--department`, `-d`: Specific department to crawl (optional)
  - Crawls all subcategories within the department
  - Cannot be used with `--from-hierarchy-file`

- `--max-pages`, `-p`: Maximum pages to crawl per category (default: 5)
  - Controls depth of crawling within each category

- `--concurrency`: **NEW** Number of concurrent grid crawlers (default: 5)
  - Only applies to `--from-hierarchy-file` mode
  - Higher values = faster crawling but more resource usage
  - Recommended range: 5-15 depending on your system

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

### Hierarchy File Mode (NEW - High Performance)
```bash
# Use default Amazon hierarchy file with high concurrency
python crawl.py --retailer amazon --from-hierarchy-file --mode urls-only --concurrency 10

# Use custom hierarchy file for Target
python crawl.py --retailer target --from-hierarchy-file my_target_hierarchy.json --mode full --max-pages 2

# Extract URLs from Amazon hierarchy with maximum concurrency
python crawl.py --retailer amazon --from-hierarchy-file --mode urls-only --concurrency 15 --max-pages 5

# Extract full product data from Target hierarchy
python crawl.py --retailer target --from-hierarchy-file --mode full --concurrency 8 --output target_from_hierarchy
```

### Debug Mode
```bash
# Run with verbose debugging
python crawl.py --retailer amazon --from-hierarchy-file --mode urls-only --log-level DEBUG
```

## Output Modes

### Full Mode (Default)
- Extracts complete product data including title, price, URL, and retailer-specific IDs
- Without `--hierarchical`: Outputs to JSON file with one product per line (ND-JSON format)
- With `--hierarchical`: Outputs single JSON file with nested category structure and products at leaf nodes
- With `--from-hierarchy-file`: Processes all leaf categories concurrently, outputs to JSON file
- File naming: `product_crawl_YYYYMMDD_HHMMSS.json` or `hierarchical_crawl_YYYYMMDD_HHMMSS.json`

### URL-Only Mode
- Extracts only product URLs for memory efficiency
- Without `--hierarchical` or `--from-hierarchy-file`: Sends to Redis by default, or JSON file if `--output` specified
- With `--hierarchical`: Always outputs to JSON file with nested structure and URLs at leaf nodes
- With `--from-hierarchy-file`: Always outputs to JSON file with URLs, processes concurrently
- File naming: `hierarchical_crawl_YYYYMMDD_HHMMSS.json` (when hierarchical or from-file)

### Hierarchy File Mode Benefits
- **Maximum Performance**: Processes multiple category grids concurrently
- **Skip Category Discovery**: Uses pre-built hierarchy files, jumps straight to product extraction
- **Resource Efficient**: Better browser session management
- **Scalable**: Adjustable concurrency levels based on your system capabilities

## Environment Variables

The crawlers respect several environment variables for configuration:

- `CRAWLER_MAX_DEPTH`: Maximum crawling depth (default: 10)
- `CRAWLER_CONCURRENCY`: Number of concurrent workers (default: 3)
- `REDIS_URL`: Redis connection URL
- `AMZ_CATEGORY_CONFIG`: Path to Amazon category configuration file
- `TARGET_CATEGORY_CONFIG`: Path to Target category configuration file

## Default Hierarchy Files

Each retailer has a default hierarchy file:
- Amazon: `crawlers/amazon/amazon_grocery_hierarchy.json`
- Target: `crawlers/target/target_grocery_hierarchy.json`

These files contain pre-discovered category structures that can be used with `--from-hierarchy-file` mode.

## Error Handling

The script includes comprehensive error handling:

- Invalid retailer names are caught and reported
- Category names are validated against configuration files
- Hierarchy files are validated for existence and format
- Redis connection issues are detected and reported
- Crawler failures are logged with appropriate detail level
- Graceful handling of Ctrl+C interruption

## Performance Optimization

### For Maximum Speed
```bash
# Use hierarchy file mode with high concurrency
python crawl.py --retailer amazon --from-hierarchy-file --mode urls-only --concurrency 12 --max-pages 3
```

### For Maximum Data Quality
```bash
# Use lower concurrency with full data extraction
python crawl.py --retailer target --from-hierarchy-file --mode full --concurrency 5 --max-pages 5
```

### Memory vs Speed Trade-offs
- **URL-only mode**: Lower memory usage, faster processing
- **Full mode**: Higher memory usage, more complete data
- **Higher concurrency**: Faster but more resource intensive
- **Lower max-pages**: Faster but less comprehensive coverage

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

### Hierarchy File Issues
```bash
# Verify hierarchy file exists and is valid JSON
python -m json.tool your_hierarchy.json

# Use debug mode to see hierarchy loading details
python crawl.py --retailer target --from-hierarchy-file your_file.json --log-level DEBUG
```

### Performance Issues
```bash
# Start with lower concurrency and gradually increase
python crawl.py --retailer amazon --from-hierarchy-file --concurrency 3

# Monitor system resources and adjust accordingly
python crawl.py --retailer target --from-hierarchy-file --concurrency 8 --log-level INFO
```

### Import Errors
Make sure you're running from the correct directory and have all dependencies installed:
```bash
pip install -r requirements.txt
``` 
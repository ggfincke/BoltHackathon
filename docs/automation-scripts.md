# 🤖 Automation Scripts Subsystem

The automation scripts subsystem (`scripts/`) provides command-line interfaces and automation tools for running crawlers, managing data, and performing maintenance tasks. These scripts serve as the primary interface for operating the retail crawling system in production and development environments.

## 🏗️ Architecture Overview

```
scripts/
├── crawl.py                 # 🕷️ Main crawler CLI interface
├── crawl.sh                 # 📜 Shell script wrapper for advanced automation
└── manage_failed_upcs.py    # 🔧 UPC lookup failure management tool
```

## 🕷️ Main Crawler Interface (`crawl.py`)

The primary command-line interface for running retail crawlers across different modes and configurations.

### ✨ Core Features
- 🛍️ **Multi-retailer support**: Amazon, Target, Walmart crawling
- 🔄 **Flexible modes**: Full product data vs. URLs-only extraction
- 🌳 **Hierarchical crawling**: Build and utilize category hierarchies
- ⚡ **Concurrent processing**: Adjustable concurrency for performance optimization
- 📊 **Multiple output backends**: JSON files, Redis queues, Supabase database
- 🛡️ **Comprehensive error handling**: Robust error recovery and logging

### Command Syntax
```bash
python scripts/crawl.py [OPTIONS]
```

### Core Arguments

#### Required Arguments
- `--retailer`, `-r`: Target retailer
  - **Choices**: `amazon`, `target`, `walmart`
  - **Example**: `--retailer amazon`

#### Mode Selection
- `--mode`, `-m`: Crawling mode (default: `full`)
  - **`full`**: Extract complete product data (title, price, URL, UPC, etc.)
  - **`urls-only`**: Extract only product URLs (memory efficient)
  - **Example**: `--mode urls-only`

#### Crawling Strategies
- `--hierarchical`: Build hierarchical category structure
  - Creates nested JSON with categories and products
  - Cannot be used with specific category/department filters
  - **Example**: `--hierarchical`

- `--from-hierarchy-file [FILE]`: Use pre-built hierarchy for crawling
  - If `FILE` specified: Uses custom hierarchy file
  - If `FILE` omitted: Uses default retailer hierarchy
  - Enables high-performance concurrent grid crawling
  - **Example**: `--from-hierarchy-file my_hierarchy.json`

#### Targeting Options
- `--category`, `-c`: Crawl specific category
  - Category names are case-sensitive
  - Cannot be used with `--from-hierarchy-file`
  - **Example**: `--category "Beverages"`

- `--department`, `-d`: Crawl entire department
  - Includes all subcategories within department
  - Cannot be used with `--from-hierarchy-file`
  - **Example**: `--department "Grocery"`

#### Performance Controls
- `--max-pages`, `-p`: Maximum pages per category (default: 5)
  - Controls crawling depth within each category
  - **Example**: `--max-pages 10`

- `--concurrency`: Concurrent crawler threads (default: 5)
  - Only applies to `--from-hierarchy-file` mode
  - Recommended range: 5-15 based on system resources
  - **Example**: `--concurrency 12`

#### Output Configuration
- `--output`, `-o`: Output file prefix
  - Used for JSON file outputs
  - Automatic timestamp appending
  - **Example**: `--output amazon_products`

- `--log-level`, `-l`: Logging verbosity (default: `INFO`)
  - **Choices**: `DEBUG`, `INFO`, `WARNING`, `ERROR`
  - **Example**: `--log-level DEBUG`

#### Utility Commands
- `--list-retailers`: Display available retailers and exit
- `--test-redis`: Test Redis connection and exit
- `--test-upc-lookup`: Test UPC lookup services and exit
- `--validate-config`: Validate crawler configurations and exit

### Usage Examples

#### Basic Product Crawling
```bash
# Crawl Amazon with full product data
python scripts/crawl.py --retailer amazon --mode full --max-pages 3

# Extract Target URLs for memory efficiency
python scripts/crawl.py --retailer target --mode urls-only --category "Grocery"

# Walmart crawl with custom output file
python scripts/crawl.py --retailer walmart --mode full --output walmart_products_$(date +%Y%m%d)
```

#### Hierarchical Mode
```bash
# Build complete Amazon hierarchy with products
python scripts/crawl.py --retailer amazon --mode full --hierarchical --max-pages 2

# Target hierarchy with URLs only
python scripts/crawl.py --retailer target --mode urls-only --hierarchical

# Department-specific hierarchy for Walmart
python scripts/crawl.py --retailer walmart --hierarchical --department "Food"
```

#### High-Performance Mode
```bash
# Use default hierarchy file with maximum concurrency
python scripts/crawl.py --retailer amazon --from-hierarchy-file --mode urls-only --concurrency 15

# Custom hierarchy file with full data extraction
python scripts/crawl.py --retailer target --from-hierarchy-file custom_target.json --mode full --concurrency 8

# Performance-optimized URL extraction
python scripts/crawl.py --retailer walmart --from-hierarchy-file --mode urls-only --concurrency 12 --max-pages 10
```

#### Debug and Testing
```bash
# Verbose debugging
python scripts/crawl.py --retailer amazon --category "Snacks" --log-level DEBUG

# Test system connectivity
python scripts/crawl.py --test-redis
python scripts/crawl.py --test-upc-lookup

# Validate configurations
python scripts/crawl.py --validate-config --retailer target
```

### Output Modes and Destinations

#### Full Mode Output
- **Without hierarchy**: ND-JSON file with one product per line
  - Format: `product_crawl_YYYYMMDD_HHMMSS.json`
  - Content: Complete product data including UPC codes

- **With hierarchy**: Single JSON file with nested structure
  - Format: `hierarchical_crawl_YYYYMMDD_HHMMSS.json`
  - Content: Categories with products at leaf nodes

- **With Supabase**: Direct database storage
  - Real-time insertion with conflict resolution
  - Automatic UPC enrichment and normalization

#### URLs-Only Mode Output
- **Default behavior**: Send to Redis queues
  - Key format: `product_urls:{retailer_id}`
  - Memory efficient for large-scale processing

- **With `--output`**: Save to JSON file
  - Format: `urls_only_YYYYMMDD_HHMMSS.json`
  - Simple array of product URLs

- **With hierarchy**: Hierarchical JSON with URLs at leaves
  - Format: `hierarchical_urls_YYYYMMDD_HHMMSS.json`
  - Category structure with URL arrays

### Configuration and Environment

#### Environment Variables
```bash
# Crawler behavior
CRAWLER_MAX_DEPTH=10          # Maximum crawling depth
CRAWLER_CONCURRENCY=5         # Default concurrent workers
CRAWLER_TIMEOUT=30            # Request timeout in seconds
CRAWLER_USER_AGENT="Custom UA" # Custom user agent string

# Data storage
REDIS_URL="redis://localhost:6379"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"

# UPC lookup
UPC_LOOKUP_ENABLED=true       # Enable UPC enrichment
UPC_API_KEY="your-api-key"    # BarcodeLookup.com API key
UPC_CACHE_SIZE=10000         # UPC cache size

# Category configurations
AMZ_CATEGORY_CONFIG="config/amazon_categories.json"
TARGET_CATEGORY_CONFIG="config/target_categories.json"
WALMART_CATEGORY_CONFIG="config/walmart_categories.json"
```

#### Default Hierarchy Files
Pre-built category hierarchies for optimal performance:
- **Amazon**: `data/processed/amazon_grocery_hierarchy.json`
- **Target**: `data/processed/target_grocery_hierarchy.json`
- **Walmart**: `data/processed/walmart_grocery_hierarchy.json`

### Error Handling and Recovery

#### Automatic Recovery
- **Network failures**: Automatic retry with exponential backoff
- **Rate limiting**: Intelligent delays and session management
- **Parsing errors**: Graceful degradation with partial data
- **Database conflicts**: Automatic conflict resolution and deduplication

#### Error Reporting
```bash
# Enable detailed error logging
python scripts/crawl.py --retailer amazon --log-level DEBUG --output debug_crawl

# Common error patterns
ERROR: Rate limited by retailer (HTTP 429) - automatic retry in 30s
WARNING: UPC lookup failed for product ID 12345 - continuing without UPC
INFO: Hierarchy file loaded successfully: 1,247 categories found
DEBUG: Processing category "Beverages > Soft Drinks" (15 products found)
```

## Shell Script Wrapper (`crawl.sh`)

Advanced automation wrapper providing additional features and convenience functions.

### Features
- **Environment management**: Automatic environment setup and validation
- **Batch processing**: Multiple crawler runs with different configurations
- **Resource monitoring**: System resource tracking and optimization
- **Log management**: Automatic log rotation and archiving
- **Notification system**: Email/Slack notifications for completion/failures
- **Recovery mechanisms**: Automatic restart on system failures

### Usage Examples

#### Basic Operations
```bash
# Single retailer crawl with environment setup
./scripts/crawl.sh --retailer amazon --mode full --setup-env

# Batch crawl all retailers
./scripts/crawl.sh --batch-all --mode urls-only --concurrency 10

# Scheduled crawl with notifications
./scripts/crawl.sh --retailer target --schedule daily --notify slack
```

#### Advanced Automation
```bash
# Resource-monitored crawl
./scripts/crawl.sh --retailer walmart --mode full --monitor-resources --max-memory 8GB

# Distributed crawl across multiple machines
./scripts/crawl.sh --retailer amazon --distributed --nodes "node1,node2,node3"

# Incremental crawl with checkpoint recovery
./scripts/crawl.sh --retailer target --incremental --checkpoint-interval 1000
```

### Configuration Options
```bash
# Environment setup
CRAWL_ENV_CHECK=true          # Validate environment before running
CRAWL_AUTO_INSTALL=false     # Automatically install missing dependencies
CRAWL_VENV_PATH="/opt/crawl"  # Virtual environment path

# Resource limits
CRAWL_MAX_MEMORY="16GB"       # Maximum memory usage
CRAWL_MAX_CPU_PERCENT=80      # Maximum CPU utilization
CRAWL_DISK_SPACE_MIN="10GB"   # Minimum free disk space

# Notifications
SLACK_WEBHOOK_URL="https://hooks.slack.com/..."
EMAIL_RECIPIENTS="admin@company.com,ops@company.com"
NOTIFICATION_THRESHOLD="ERROR"  # Minimum log level for notifications

# Scheduling
CRON_SCHEDULE="0 2 * * *"     # Daily at 2 AM
RETRY_FAILED_JOBS=true        # Retry failed crawl jobs
MAX_RETRY_ATTEMPTS=3          # Maximum retry attempts
```

## UPC Management Tool (`manage_failed_upcs.py`)

Specialized tool for managing and recovering from UPC lookup failures.

### Core Functionality
- **Failure analysis**: Analyze patterns in UPC lookup failures
- **Batch retry**: Retry failed UPC lookups with different strategies
- **Data quality reporting**: Generate reports on UPC coverage and accuracy
- **Manual override**: Manually assign UPC codes to products
- **Service testing**: Test and validate UPC lookup services

### Usage Examples

#### Failure Analysis
```bash
# Analyze recent UPC lookup failures
python scripts/manage_failed_upcs.py --analyze --days 7

# Generate detailed failure report
python scripts/manage_failed_upcs.py --report --output upc_failures_$(date +%Y%m%d).json

# Show failure statistics by retailer
python scripts/manage_failed_upcs.py --stats --group-by retailer
```

#### Batch Recovery
```bash
# Retry all failed lookups from last 24 hours
python scripts/manage_failed_upcs.py --retry --days 1

# Retry specific product IDs
python scripts/manage_failed_upcs.py --retry --product-ids 12345,67890,11111

# Retry with alternative UPC service
python scripts/manage_failed_upcs.py --retry --service alternative --confidence-threshold 0.8
```

#### Manual Management
```bash
# Manually assign UPC to product
python scripts/manage_failed_upcs.py --assign --product-id 12345 --upc 012345678901

# Bulk assign from CSV file
python scripts/manage_failed_upcs.py --bulk-assign --csv-file manual_upcs.csv

# Mark products as no-UPC-available
python scripts/manage_failed_upcs.py --mark-no-upc --product-ids 12345,67890
```

#### Service Testing
```bash
# Test UPC lookup services
python scripts/manage_failed_upcs.py --test-services

# Validate UPC database integrity
python scripts/manage_failed_upcs.py --validate-database

# Benchmark UPC lookup performance
python scripts/manage_failed_upcs.py --benchmark --sample-size 1000
```

### Configuration Options
```bash
# UPC service configuration
UPC_PRIMARY_SERVICE="barcodelookup"
UPC_FALLBACK_SERVICES="upcitemdb,datakick"
UPC_CONFIDENCE_THRESHOLD=0.7
UPC_RETRY_LIMIT=3

# Failure management
FAILED_UPC_RETENTION_DAYS=30
AUTO_RETRY_FAILURES=true
RETRY_INTERVAL_HOURS=24

# Reporting
UPC_REPORT_EMAIL="upc-admin@company.com"
DAILY_UPC_REPORTS=true
UPC_ALERT_THRESHOLD=0.1  # Alert if failure rate > 10%
```

## Automation and Scheduling

### Cron Job Examples
```bash
# Daily full crawl at 2 AM
0 2 * * * /opt/crawl/scripts/crawl.sh --batch-all --mode full --notify email

# Hourly URL collection for price monitoring
0 * * * * /opt/crawl/scripts/crawl.py --retailer amazon --from-hierarchy-file --mode urls-only --concurrency 15

# Weekly UPC cleanup
0 3 * * 0 /opt/crawl/scripts/manage_failed_upcs.py --retry --days 7 --cleanup

# Daily health check
30 1 * * * /opt/crawl/scripts/crawl.py --test-redis --test-upc-lookup --validate-config
```

### Systemd Service Configuration
```ini
# /etc/systemd/system/retail-crawler.service
[Unit]
Description=Retail Product Crawler
After=network.target redis.service

[Service]
Type=simple
User=crawler
Group=crawler
WorkingDirectory=/opt/retail-crawler
Environment=PYTHONPATH=/opt/retail-crawler
ExecStart=/opt/retail-crawler/scripts/crawl.sh --daemon --config /etc/crawler/config.toml
Restart=always
RestartSec=30

[Install]
WantedBy=multi-user.target
```

### Docker Automation
```dockerfile
# Dockerfile for containerized crawling
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

# Run daily crawl
CMD ["python", "scripts/crawl.py", "--retailer", "amazon", "--from-hierarchy-file", "--mode", "full", "--concurrency", "10"]
```

```yaml
# docker-compose.yml for full automation stack
version: '3.8'
services:
  crawler-amazon:
    build: .
    environment:
      - RETAILER=amazon
      - CRAWL_MODE=full
      - CONCURRENCY=10
    depends_on:
      - redis
      - postgres
    restart: unless-stopped

  crawler-target:
    build: .
    environment:
      - RETAILER=target
      - CRAWL_MODE=urls-only
      - CONCURRENCY=8
    depends_on:
      - redis
    restart: unless-stopped

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"

  postgres:
    image: postgres:13
    environment:
      - POSTGRES_DB=retail_crawler
      - POSTGRES_USER=crawler
      - POSTGRES_PASSWORD=secure_password
```

## Monitoring and Alerting

### Performance Metrics
```bash
# Track crawling performance
python scripts/crawl.py --retailer amazon --mode full --metrics --output-metrics metrics.json

# Generate performance report
python scripts/crawl.py --performance-report --days 7 --output performance_report.html
```

### Health Checks
```bash
# Comprehensive system health check
python scripts/crawl.py --health-check --all-systems

# Individual component checks
python scripts/crawl.py --test-redis --test-database --test-upc-lookup --test-storage
```

### Log Analysis
```bash
# Analyze crawl logs for patterns
python scripts/manage_failed_upcs.py --analyze-logs --log-file crawl.log --days 7

# Generate error summary
grep ERROR /var/log/crawler/*.log | python scripts/log_analyzer.py --summarize
```

## Best Practices

### Production Deployment
1. **Resource monitoring**: Monitor CPU, memory, and disk usage
2. **Rate limiting**: Respect retailer terms of service and rate limits
3. **Error handling**: Implement comprehensive error recovery
4. **Data validation**: Validate all extracted data before storage
5. **Backup strategies**: Regular backups of configurations and data

### Performance Optimization
1. **Concurrency tuning**: Adjust based on system resources and retailer limits
2. **Hierarchy utilization**: Use pre-built hierarchies for faster crawling
3. **Batch processing**: Process data in batches for efficiency
4. **Connection pooling**: Reuse connections to reduce overhead
5. **Cache utilization**: Leverage caching for repeated operations

### Maintenance Procedures
1. **Regular updates**: Keep crawler patterns current with site changes
2. **Log rotation**: Implement automatic log cleanup and archiving
3. **Database maintenance**: Regular cleanup of old data and optimization
4. **Configuration reviews**: Periodic review of crawler configurations
5. **Security updates**: Keep all dependencies and systems updated

### Troubleshooting Guide
1. **Connection issues**: Check network connectivity and credentials
2. **Rate limiting**: Reduce concurrency and add delays
3. **Data quality**: Validate extraction patterns and data formats
4. **Performance problems**: Monitor resource usage and optimize
5. **Service failures**: Check external service status and failover options 
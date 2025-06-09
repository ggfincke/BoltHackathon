# Scrapers Subsystem

The scrapers subsystem (`src/scrapers/`) provides direct product page scraping capabilities as an alternative to the crawler-based approach. While crawlers discover products through category navigation, scrapers work with specific product URLs to extract detailed product information directly from individual product pages.

## Architecture Overview

```
src/scrapers/
├── base_scraper.py     # Base scraper class and interfaces
├── __init__.py         # Scraper module initialization
├── amazon/             # Amazon-specific product scraper
├── target/             # Target-specific product scraper
└── walmart/            # Walmart-specific product scraper
```

## Core Concepts

### Scrapers vs Crawlers

| Feature | Scrapers | Crawlers |
|---------|----------|----------|
| **Purpose** | Extract data from known product URLs | Discover and extract from categories |
| **Input** | Specific product URLs | Category URLs or hierarchy |
| **Speed** | Fast for individual products | Optimized for bulk discovery |
| **Use Case** | Targeted product updates | Comprehensive product discovery |
| **Memory Usage** | Low per product | Higher for bulk operations |

### When to Use Scrapers

1. **Product Updates**: Refreshing data for known products
2. **Price Monitoring**: Regular price checks for specific items
3. **Inventory Tracking**: Checking availability for targeted products
4. **Data Validation**: Verifying crawler results for specific products
5. **Real-time Data**: Getting current information for immediate use

## Base Scraper (`base_scraper.py`)

The foundation for all retailer-specific scrapers, providing:

### Core Features
- **Abstract base class**: Standardized interface for all scrapers
- **Error handling**: Robust error handling and retry mechanisms
- **Session management**: Efficient HTTP session handling
- **Response parsing**: Common parsing utilities and patterns
- **Rate limiting**: Built-in rate limiting and respectful scraping

### Key Methods
```python
class BaseScraper:
    def scrape_product(self, url: str) -> dict:
        """Scrape a single product from its URL"""
        pass
    
    def scrape_multiple(self, urls: list) -> list:
        """Scrape multiple products with optimized batching"""
        pass
    
    def validate_url(self, url: str) -> bool:
        """Validate if URL belongs to supported retailer"""
        pass
```

### Common Patterns
- **User-agent rotation**: Prevents blocking through varied headers
- **Response caching**: Reduces redundant requests for debugging
- **HTML parsing**: BeautifulSoup and lxml integration
- **JSON-LD extraction**: Structured data extraction from product pages
- **Image processing**: Product image URL extraction and validation

## Retailer-Specific Scrapers

### Amazon Scraper (`amazon/`)

Specialized for Amazon product pages with:

#### Key Features
- **ASIN extraction**: Amazon Standard Identification Numbers
- **Price parsing**: Regular and sale price detection
- **Review extraction**: Rating scores and review counts
- **Variant handling**: Size, color, and other product variants
- **Availability detection**: In-stock status and shipping info

#### Data Points Extracted
```python
{
    "title": "Product name and description",
    "price": "Current price with currency",
    "original_price": "List price before discounts",
    "asin": "Amazon Standard Identification Number",
    "rating": "Average customer rating",
    "review_count": "Number of customer reviews",
    "availability": "Stock status and shipping",
    "images": ["List of product image URLs"],
    "brand": "Product brand name",
    "categories": ["Product category hierarchy"],
    "features": ["Key product features and bullets"],
    "description": "Detailed product description"
}
```

#### Special Handling
- **Anti-bot detection**: Strategies for avoiding Amazon's bot detection
- **Regional variations**: Handling different Amazon domains
- **Prime pricing**: Special handling for Prime member pricing
- **Subscribe & Save**: Subscription pricing detection

### Target Scraper (`target/`)

Optimized for Target.com product pages:

#### Key Features
- **TCIN extraction**: Target.com Item Numbers
- **Store inventory**: Local store availability checking
- **Circle pricing**: Target Circle member pricing
- **Pickup options**: Store pickup and drive-up availability
- **Product specifications**: Detailed spec table extraction

#### Data Points Extracted
```python
{
    "title": "Product name",
    "price": "Current price",
    "tcin": "Target.com Item Number",
    "dpci": "Department-Class-Item number",
    "upc": "Universal Product Code",
    "brand": "Product brand",
    "rating": "Guest rating average",
    "review_count": "Number of reviews",
    "availability": "Online and store availability",
    "store_pickup": "Pickup availability by store",
    "specifications": {"key": "value pairs of product specs"},
    "images": ["Product image URLs"],
    "categories": ["Category breadcrumbs"]
}
```

#### Special Features
- **Store locator integration**: Finding nearby stores with inventory
- **Guest reviews**: Target's guest review system parsing
- **Promotion detection**: Sale badges and promotional pricing
- **Registry compatibility**: Wedding and baby registry features

### Walmart Scraper (`walmart/`)

Designed for Walmart.com product extraction:

#### Key Features
- **Item ID extraction**: Walmart product identifiers
- **Rollback pricing**: Walmart's rollback price detection
- **Pickup/delivery**: Store pickup and delivery options
- **Third-party sellers**: Marketplace seller information
- **Product variants**: Size, color, and quantity variations

#### Data Points Extracted
```python
{
    "title": "Product name",
    "price": "Current price",
    "item_id": "Walmart item identifier",
    "upc": "Universal Product Code",
    "brand": "Product brand",
    "rating": "Customer rating",
    "review_count": "Number of reviews",
    "availability": "Stock status",
    "seller": "Walmart or marketplace seller",
    "shipping": "Shipping options and costs",
    "pickup_delivery": "Store services availability",
    "specifications": {"Product specifications"},
    "images": ["Product images"],
    "categories": ["Category hierarchy"]
}
```

## Usage Patterns

### Single Product Scraping
```python
from src.scrapers.amazon.amazon_scraper import AmazonScraper

scraper = AmazonScraper()
product_data = scraper.scrape_product("https://amazon.com/dp/B08N5WRWNW")
print(f"Product: {product_data['title']}")
print(f"Price: {product_data['price']}")
```

### Batch Scraping
```python
from src.scrapers.target.target_scraper import TargetScraper

urls = [
    "https://target.com/p/item1",
    "https://target.com/p/item2",
    "https://target.com/p/item3"
]

scraper = TargetScraper()
products = scraper.scrape_multiple(urls, batch_size=5)
for product in products:
    print(f"{product['title']}: {product['price']}")
```

### Error Handling
```python
from src.scrapers.walmart.walmart_scraper import WalmartScraper

scraper = WalmartScraper()
try:
    product = scraper.scrape_product(url)
    if product:
        print("Successfully scraped product")
    else:
        print("Product not found or unavailable")
except Exception as e:
    print(f"Scraping error: {e}")
```

## Configuration and Customization

### Environment Variables
```bash
SCRAPER_USER_AGENT="Custom user agent string"
SCRAPER_TIMEOUT=30               # Request timeout in seconds
SCRAPER_RETRY_COUNT=3           # Number of retry attempts
SCRAPER_RATE_LIMIT=1.0          # Delay between requests
SCRAPER_CACHE_ENABLED=true      # Enable response caching
```

### Custom Headers
```python
custom_headers = {
    'User-Agent': 'Mozilla/5.0 (compatible; ProductScraper/1.0)',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate',
    'Connection': 'keep-alive'
}

scraper = AmazonScraper(headers=custom_headers)
```

### Proxy Support
```python
proxy_config = {
    'http': 'http://proxy-server:port',
    'https': 'https://proxy-server:port'
}

scraper = TargetScraper(proxies=proxy_config)
```

## Performance Optimization

### Concurrent Scraping
```python
import asyncio
from src.scrapers.base_scraper import AsyncBaseScraper

async def scrape_products_async(urls):
    scraper = AsyncBaseScraper()
    tasks = [scraper.scrape_product(url) for url in urls]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return results
```

### Response Caching
- **Memory caching**: Fast access for repeated URLs
- **File-based caching**: Persistent cache across sessions
- **Cache invalidation**: Time-based and manual cache clearing
- **Selective caching**: Cache only successful responses

### Request Optimization
- **Connection pooling**: Reuse HTTP connections
- **Compression**: GZIP response handling
- **Keep-alive**: Persistent connections for batch operations
- **DNS caching**: Reduce DNS lookup overhead

## Data Quality and Validation

### Product Data Validation
```python
def validate_product_data(product):
    required_fields = ['title', 'price', 'url']
    for field in required_fields:
        if not product.get(field):
            raise ValueError(f"Missing required field: {field}")
    
    if not isinstance(product['price'], (int, float, str)):
        raise ValueError("Invalid price format")
    
    return True
```

### Price Parsing
- **Currency detection**: Automatic currency symbol handling
- **Decimal formatting**: Proper decimal place handling
- **Sale price extraction**: Regular vs. discounted pricing
- **Range pricing**: Handling price ranges for variants

### Image URL Validation
- **URL format checking**: Valid HTTP/HTTPS URLs
- **Image accessibility**: Verify images are accessible
- **Size detection**: Extract image dimensions when available
- **Fallback images**: Handle missing or broken images

## Error Handling and Resilience

### Common Error Types
1. **Network errors**: Connection timeouts and failures
2. **Rate limiting**: HTTP 429 responses and blocking
3. **Page structure changes**: HTML layout modifications
4. **Missing products**: Discontinued or unavailable items
5. **Geographic restrictions**: Region-locked content

### Retry Strategies
```python
import time
import random

def retry_with_backoff(func, max_retries=3):
    for attempt in range(max_retries):
        try:
            return func()
        except Exception as e:
            if attempt == max_retries - 1:
                raise e
            delay = (2 ** attempt) + random.uniform(0, 1)
            time.sleep(delay)
```

### Graceful Degradation
- **Partial data extraction**: Return available data when some fields fail
- **Fallback parsing**: Alternative extraction methods
- **Error reporting**: Detailed error logging for debugging
- **Recovery mechanisms**: Automatic retry and recovery

## Integration with Other Subsystems

### Crawler Integration
- **URL feeding**: Scrapers process URLs discovered by crawlers
- **Data validation**: Cross-verify crawler results with scraper data
- **Update cycles**: Regular updates for products found by crawlers

### Database Integration
- **Direct storage**: Store scraped data directly to database
- **Batch operations**: Efficient bulk data insertion
- **Conflict resolution**: Handle duplicate products and updates
- **History tracking**: Maintain product change history

### UPC Enrichment
- **UPC extraction**: Extract UPC codes from product pages
- **Validation**: Verify UPC format and checksums
- **Lookup integration**: Enhance with external UPC services
- **Confidence scoring**: Rate UPC extraction reliability

## Best Practices

### Development Guidelines
1. **Respect robots.txt**: Check and follow site scraping policies
2. **Rate limiting**: Implement appropriate delays between requests
3. **User-agent identification**: Use descriptive and honest user agents
4. **Error handling**: Robust error handling for all scenarios
5. **Data validation**: Validate all extracted data before use

### Operational Guidelines
1. **Monitor success rates**: Track scraping success and failure rates
2. **Update selectors**: Keep CSS selectors current with site changes
3. **Test regularly**: Validate scrapers against live sites
4. **Log comprehensively**: Detailed logging for debugging and monitoring
5. **Backup strategies**: Have fallback methods for critical data

### Legal and Ethical Considerations
1. **Terms of service**: Comply with website terms of service
2. **Rate limiting**: Don't overload servers with requests
3. **Data usage**: Use scraped data responsibly and ethically
4. **Privacy**: Respect user privacy and data protection laws
5. **Attribution**: Properly attribute data sources when required

## Troubleshooting

### Common Issues
- **Selector failures**: CSS selectors no longer match elements
- **Rate limiting**: Getting blocked by anti-bot measures
- **Data format changes**: Product page structure modifications
- **JavaScript rendering**: Pages requiring JavaScript execution
- **Geographic blocking**: Region-specific access restrictions

### Debug Tools
```bash
# Test individual product scraping
python -c "from src.scrapers.amazon.amazon_scraper import AmazonScraper; print(AmazonScraper().scrape_product('URL'))"

# Validate scraper configuration
python -c "from src.scrapers.base_scraper import BaseScraper; BaseScraper().test_configuration()"

# Check response caching
python -c "from src.scrapers.target.target_scraper import TargetScraper; TargetScraper().clear_cache()"
```

### Performance Monitoring
- **Response times**: Track average response times per retailer
- **Success rates**: Monitor successful vs. failed scraping attempts
- **Data completeness**: Measure percentage of complete product records
- **Error patterns**: Identify recurring error types and patterns 
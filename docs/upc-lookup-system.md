# 🏷️ UPC Lookup System

The UPC lookup system (`src/crawlers/upc_lookup/`) provides sophisticated UPC/barcode enrichment capabilities for product data. It integrates multiple UPC lookup services with intelligent fallback mechanisms, confidence scoring, and efficient caching to enhance product data with Universal Product Codes.

## 🏗️ Architecture Overview

```
src/crawlers/upc_lookup/
├── base_upc_lookup.py       # 🧱 Abstract base class for UPC services
├── barcode_lookup.py        # 🔍 BarcodeLookup.com service integration
├── upc_manager.py           # 🎯 Multi-service UPC management orchestrator
└── __init__.py             # 🔧 Module initialization
```

## 🔧 Core Components

### 🧱 Base UPC Lookup (`base_upc_lookup.py`)

Abstract interface defining the contract for all UPC lookup services:

#### ✨ Key Features
- 🔌 **Standardized interface**: Consistent API across all UPC services
- 🛡️ **Error handling**: Common error patterns and exception handling
- ⏱️ **Rate limiting**: Built-in rate limiting and retry mechanisms
- 💾 **Caching support**: Abstract caching interface for implementations
- 📊 **Confidence scoring**: Standardized confidence rating system

#### Abstract Methods
```python
class BaseUPCLookup:
    async def lookup_upc_by_name(self, product_name: str, brand: str = None) -> dict:
        """Find UPC by product name with optional brand filtering"""
        
    async def lookup_product_by_upc(self, upc_code: str) -> dict:
        """Get product information by UPC code"""
        
    async def validate_upc(self, upc_code: str) -> bool:
        """Validate UPC format and checksum"""
        
    def calculate_confidence(self, product_name: str, found_name: str) -> float:
        """Calculate confidence score for name matching"""
```

### BarcodeLookup Service (`barcode_lookup.py`)

Primary UPC lookup service using BarcodeLookup.com API:

#### Key Features
- **Fuzzy name matching**: Advanced string similarity algorithms
- **Brand-aware searching**: Enhanced accuracy with brand information
- **Multiple UPC formats**: Support for UPC-A, UPC-E, EAN-13, etc.
- **Rate limit compliance**: Respects API rate limits and quotas
- **Intelligent caching**: Reduces redundant API calls

#### API Integration
```python
class BarcodeLookupService(BaseUPCLookup):
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.barcodelookup.com/v3"
        self.session = aiohttp.ClientSession()
        self.cache = LRUCache(maxsize=10000)
        
    async def search_products(self, query: str, brand: str = None) -> list:
        """Search for products using text query"""
        
    async def get_product_by_upc(self, upc: str) -> dict:
        """Retrieve product data by UPC code"""
```

#### Fuzzy Matching Algorithm
```python
def calculate_similarity(self, name1: str, name2: str) -> float:
    """Calculate similarity between product names"""
    # Normalize names for comparison
    norm1 = self.normalize_product_name(name1)
    norm2 = self.normalize_product_name(norm2)
    
    # Multiple similarity metrics
    ratio = fuzz.ratio(norm1, norm2) / 100.0
    token_sort = fuzz.token_sort_ratio(norm1, norm2) / 100.0
    token_set = fuzz.token_set_ratio(norm1, norm2) / 100.0
    
    # Weighted combination
    return (ratio * 0.4 + token_sort * 0.3 + token_set * 0.3)

def normalize_product_name(self, name: str) -> str:
    """Normalize product name for consistent matching"""
    # Remove common retail suffixes/prefixes
    normalized = re.sub(r'\b(pack|ct|count|oz|lb|ml|gal)\b', '', name.lower())
    normalized = re.sub(r'[^\w\s]', ' ', normalized)
    normalized = re.sub(r'\s+', ' ', normalized).strip()
    
    return normalized
```

### UPC Manager (`upc_manager.py`)

Orchestrates multiple UPC lookup services with intelligent fallback and caching:

#### Core Functionality
- **Multi-service coordination**: Manages multiple UPC lookup services
- **Intelligent fallback**: Automatic failover between services
- **Result aggregation**: Combines results from multiple sources
- **Confidence-based selection**: Chooses best result based on confidence scores
- **Persistent caching**: Long-term caching of successful lookups

#### Service Configuration
```python
class UPCManager:
    def __init__(self):
        self.services = [
            BarcodeLookupService(api_key=os.getenv('BARCODE_LOOKUP_API_KEY')),
            # Additional services can be added here
        ]
        self.cache = PersistentCache('upc_cache.db')
        self.confidence_threshold = 0.7
        
    async def lookup_upc_comprehensive(self, product_name: str, brand: str = None) -> dict:
        """Comprehensive UPC lookup using all available services"""
```

#### Fallback Strategy
```python
async def lookup_with_fallback(self, product_name: str, brand: str = None) -> dict:
    """Try multiple services with intelligent fallback"""
    results = []
    
    for service in self.services:
        try:
            result = await service.lookup_upc_by_name(product_name, brand)
            if result and result.get('confidence', 0) >= self.confidence_threshold:
                return result
            if result:
                results.append(result)
        except Exception as e:
            logger.warning(f"Service {service.__class__.__name__} failed: {e}")
            continue
    
    # Return best result if no high-confidence match found
    if results:
        return max(results, key=lambda r: r.get('confidence', 0))
    
    return None
```

## Data Structures and Formats

### UPC Lookup Result
```python
{
    "upc": "012345678901",           # UPC code (12-14 digits)
    "upc_type": "UPC-A",             # UPC format type
    "product_name": "Coca Cola 12oz", # Standardized product name
    "brand": "Coca-Cola",            # Brand name
    "confidence": 0.85,              # Confidence score (0.0-1.0)
    "source": "barcodelookup",       # Lookup service used
    "category": "Beverages",         # Product category
    "description": "...",            # Product description
    "image_url": "https://...",      # Product image URL
    "manufacturer": "The Coca-Cola Company",
    "country": "US",                 # Country of origin
    "last_updated": "2023-12-01T10:30:00Z"
}
```

### UPC Cache Entry
```python
{
    "query": "coca cola 12oz",       # Original search query
    "brand": "coca-cola",            # Brand filter used
    "result": {                      # UPC lookup result
        "upc": "012345678901",
        "confidence": 0.85,
        # ... other result fields
    },
    "timestamp": "2023-12-01T10:30:00Z",
    "ttl": 86400,                    # Cache TTL in seconds
    "hits": 5                       # Number of cache hits
}
```

## Configuration and Environment

### Environment Variables
```bash
# Primary service configuration
BARCODE_LOOKUP_API_KEY="your-api-key-here"
UPC_LOOKUP_ENABLED=true

# Service behavior
UPC_CONFIDENCE_THRESHOLD=0.7      # Minimum confidence score
UPC_CACHE_TTL=86400              # Cache TTL in seconds (24 hours)
UPC_CACHE_SIZE=50000             # Maximum cache entries
UPC_RATE_LIMIT=100               # API calls per minute

# Fallback services (future expansion)
UPCITEMDB_API_KEY="backup-service-key"
DATAKICK_API_KEY="another-backup-key"

# Performance tuning
UPC_TIMEOUT=10                   # Request timeout in seconds
UPC_RETRY_ATTEMPTS=3             # Number of retry attempts
UPC_BATCH_SIZE=50                # Batch processing size
```

### Service Configuration
```python
# config/upc_services.json
{
    "barcodelookup": {
        "api_key": "${BARCODE_LOOKUP_API_KEY}",
        "base_url": "https://api.barcodelookup.com/v3",
        "rate_limit": 100,
        "priority": 1,
        "enabled": true
    },
    "upcitemdb": {
        "api_key": "${UPCITEMDB_API_KEY}",
        "base_url": "https://api.upcitemdb.com/prod/trial",
        "rate_limit": 50,
        "priority": 2,
        "enabled": false
    }
}
```

## Usage Patterns

### Basic UPC Lookup
```python
from src.crawlers.upc_lookup.upc_manager import UPCManager

# Initialize UPC manager
upc_manager = UPCManager()

# Look up UPC by product name
result = await upc_manager.lookup_upc_by_name("Coca Cola 12oz")
if result:
    print(f"UPC: {result['upc']}")
    print(f"Confidence: {result['confidence']}")
    print(f"Brand: {result['brand']}")
```

### Batch UPC Processing
```python
async def process_products_batch(products: list):
    """Process multiple products for UPC lookup"""
    upc_manager = UPCManager()
    
    tasks = []
    for product in products:
        task = upc_manager.lookup_upc_by_name(
            product['name'], 
            product.get('brand')
        )
        tasks.append(task)
    
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            logger.error(f"UPC lookup failed for {products[i]['name']}: {result}")
        elif result:
            products[i]['upc'] = result['upc']
            products[i]['upc_confidence'] = result['confidence']
```

### Integration with Crawlers
```python
# In crawler code
class ProductCrawler:
    def __init__(self):
        self.upc_manager = UPCManager()
    
    async def enrich_product_with_upc(self, product: dict) -> dict:
        """Enrich product data with UPC information"""
        if not product.get('upc'):  # Only lookup if UPC not already present
            upc_result = await self.upc_manager.lookup_upc_by_name(
                product['name'], 
                product.get('brand')
            )
            
            if upc_result and upc_result['confidence'] >= 0.7:
                product['upc'] = upc_result['upc']
                product['upc_confidence'] = upc_result['confidence']
                product['upc_source'] = upc_result['source']
        
        return product
```

## Caching Strategy

### Multi-Level Caching
1. **Memory Cache**: Fast in-memory LRU cache for recent lookups
2. **Database Cache**: Persistent cache for long-term storage
3. **Negative Cache**: Cache failed lookups to avoid repeated attempts

### Cache Implementation
```python
class UPCCache:
    def __init__(self, db_path: str = 'upc_cache.db'):
        self.memory_cache = LRUCache(maxsize=5000)
        self.db_cache = sqlite3.connect(db_path)
        self.setup_database()
    
    async def get(self, query: str, brand: str = None) -> dict:
        """Get cached UPC result"""
        cache_key = self.make_cache_key(query, brand)
        
        # Try memory cache first
        if cache_key in self.memory_cache:
            return self.memory_cache[cache_key]
        
        # Try database cache
        result = self.get_from_db(cache_key)
        if result and not self.is_expired(result):
            self.memory_cache[cache_key] = result
            return result
        
        return None
    
    async def set(self, query: str, brand: str, result: dict) -> None:
        """Cache UPC lookup result"""
        cache_key = self.make_cache_key(query, brand)
        
        # Store in both caches
        self.memory_cache[cache_key] = result
        self.store_in_db(cache_key, result)
```

## Performance Optimization

### Rate Limiting
```python
class RateLimiter:
    def __init__(self, calls_per_minute: int = 100):
        self.calls_per_minute = calls_per_minute
        self.calls = deque()
    
    async def acquire(self):
        """Acquire rate limit token"""
        now = time.time()
        
        # Remove calls older than 1 minute
        while self.calls and self.calls[0] < now - 60:
            self.calls.popleft()
        
        # Check if we can make a call
        if len(self.calls) >= self.calls_per_minute:
            sleep_time = 60 - (now - self.calls[0])
            await asyncio.sleep(sleep_time)
        
        self.calls.append(now)
```

### Batch Processing
```python
async def batch_lookup_upcs(products: list, batch_size: int = 50) -> list:
    """Process UPC lookups in batches to optimize performance"""
    results = []
    
    for i in range(0, len(products), batch_size):
        batch = products[i:i + batch_size]
        
        # Process batch concurrently
        batch_tasks = [
            upc_manager.lookup_upc_by_name(
                product['name'], 
                product.get('brand')
            ) for product in batch
        ]
        
        batch_results = await asyncio.gather(
            *batch_tasks, 
            return_exceptions=True
        )
        
        results.extend(batch_results)
        
        # Add delay between batches to respect rate limits
        if i + batch_size < len(products):
            await asyncio.sleep(1.0)
    
    return results
```

## Error Handling and Resilience

### Common Error Types
1. **API Rate Limiting**: HTTP 429 responses and quota exceeded
2. **Network Errors**: Connection timeouts and service unavailability
3. **Authentication Errors**: Invalid API keys or expired credentials
4. **Data Format Errors**: Invalid UPC formats or malformed responses
5. **Service Degradation**: Partial service failures or reduced accuracy

### Error Recovery Strategies
```python
class UPCErrorHandler:
    def __init__(self):
        self.error_counts = defaultdict(int)
        self.last_errors = defaultdict(list)
    
    async def handle_error(self, service_name: str, error: Exception, query: str):
        """Handle UPC lookup errors with appropriate recovery"""
        self.error_counts[service_name] += 1
        self.last_errors[service_name].append({
            'error': str(error),
            'query': query,
            'timestamp': time.time()
        })
        
        if isinstance(error, RateLimitError):
            # Back off and retry later
            backoff_time = min(300, 30 * (2 ** self.error_counts[service_name]))
            await asyncio.sleep(backoff_time)
            
        elif isinstance(error, AuthenticationError):
            # Disable service and notify administrators
            logger.critical(f"Authentication failed for {service_name}")
            self.disable_service(service_name)
            
        elif isinstance(error, NetworkError):
            # Exponential backoff for network issues
            backoff_time = min(60, 2 ** self.error_counts[service_name])
            await asyncio.sleep(backoff_time)
```

### Circuit Breaker Pattern
```python
class CircuitBreaker:
    def __init__(self, failure_threshold: int = 5, timeout: int = 60):
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.failure_count = 0
        self.last_failure_time = None
        self.state = 'CLOSED'  # CLOSED, OPEN, HALF_OPEN
    
    async def call(self, func, *args, **kwargs):
        """Execute function with circuit breaker protection"""
        if self.state == 'OPEN':
            if time.time() - self.last_failure_time > self.timeout:
                self.state = 'HALF_OPEN'
            else:
                raise CircuitBreakerOpenError("Circuit breaker is open")
        
        try:
            result = await func(*args, **kwargs)
            self.on_success()
            return result
        except Exception as e:
            self.on_failure()
            raise e
    
    def on_success(self):
        """Reset circuit breaker on successful call"""
        self.failure_count = 0
        self.state = 'CLOSED'
    
    def on_failure(self):
        """Handle failure in circuit breaker"""
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        if self.failure_count >= self.failure_threshold:
            self.state = 'OPEN'
```

## Quality Assurance and Validation

### UPC Validation
```python
def validate_upc_checksum(upc: str) -> bool:
    """Validate UPC checksum digit"""
    if len(upc) not in [12, 13, 14]:
        return False
    
    # UPC-A validation (12 digits)
    if len(upc) == 12:
        check_digit = int(upc[-1])
        sum_odd = sum(int(upc[i]) for i in range(0, 11, 2))
        sum_even = sum(int(upc[i]) for i in range(1, 11, 2))
        total = sum_odd * 3 + sum_even
        calculated_check = (10 - (total % 10)) % 10
        return check_digit == calculated_check
    
    # EAN-13 validation (13 digits)
    elif len(upc) == 13:
        check_digit = int(upc[-1])
        sum_odd = sum(int(upc[i]) for i in range(0, 12, 2))
        sum_even = sum(int(upc[i]) for i in range(1, 12, 2))
        total = sum_odd + sum_even * 3
        calculated_check = (10 - (total % 10)) % 10
        return check_digit == calculated_check
    
    return False
```

### Confidence Scoring
```python
def calculate_match_confidence(original_name: str, found_name: str, brand_match: bool = False) -> float:
    """Calculate confidence score for UPC match"""
    # Base similarity score
    similarity = calculate_similarity(original_name, found_name)
    
    # Boost for exact brand match
    brand_boost = 0.1 if brand_match else 0.0
    
    # Penalty for significant length difference
    length_ratio = min(len(original_name), len(found_name)) / max(len(original_name), len(found_name))
    length_penalty = 0.1 if length_ratio < 0.5 else 0.0
    
    # Final confidence score
    confidence = min(1.0, similarity + brand_boost - length_penalty)
    
    return round(confidence, 2)
```

## Monitoring and Analytics

### Performance Metrics
```python
class UPCMetrics:
    def __init__(self):
        self.lookup_count = 0
        self.success_count = 0
        self.cache_hits = 0
        self.average_confidence = 0.0
        self.service_usage = defaultdict(int)
        self.response_times = []
    
    def record_lookup(self, success: bool, confidence: float, service: str, response_time: float):
        """Record UPC lookup metrics"""
        self.lookup_count += 1
        if success:
            self.success_count += 1
            self.average_confidence = (
                (self.average_confidence * (self.success_count - 1) + confidence) / 
                self.success_count
            )
        
        self.service_usage[service] += 1
        self.response_times.append(response_time)
    
    def get_statistics(self) -> dict:
        """Get comprehensive UPC lookup statistics"""
        return {
            'total_lookups': self.lookup_count,
            'success_rate': self.success_count / self.lookup_count if self.lookup_count > 0 else 0,
            'cache_hit_rate': self.cache_hits / self.lookup_count if self.lookup_count > 0 else 0,
            'average_confidence': self.average_confidence,
            'average_response_time': sum(self.response_times) / len(self.response_times) if self.response_times else 0,
            'service_usage': dict(self.service_usage)
        }
```

### Health Monitoring
```python
async def health_check() -> dict:
    """Comprehensive UPC system health check"""
    health_status = {
        'overall': 'healthy',
        'services': {},
        'cache': {},
        'performance': {}
    }
    
    # Test each UPC service
    for service in upc_manager.services:
        try:
            test_result = await service.lookup_upc_by_name("test product")
            health_status['services'][service.__class__.__name__] = 'healthy'
        except Exception as e:
            health_status['services'][service.__class__.__name__] = f'unhealthy: {e}'
            health_status['overall'] = 'degraded'
    
    # Check cache performance
    cache_stats = upc_manager.cache.get_statistics()
    health_status['cache'] = {
        'size': cache_stats['size'],
        'hit_rate': cache_stats['hit_rate'],
        'memory_usage': cache_stats['memory_usage']
    }
    
    # Performance metrics
    metrics = upc_manager.metrics.get_statistics()
    health_status['performance'] = {
        'success_rate': metrics['success_rate'],
        'average_response_time': metrics['average_response_time'],
        'average_confidence': metrics['average_confidence']
    }
    
    return health_status
```

## Best Practices

### Development Guidelines
1. **Service abstraction**: Use base classes for consistent interfaces
2. **Error handling**: Implement comprehensive error recovery
3. **Rate limiting**: Respect API limits and implement backoff
4. **Caching**: Implement multi-level caching for performance
5. **Monitoring**: Track metrics and performance indicators

### Operational Guidelines
1. **API key management**: Secure and rotate API keys regularly
2. **Service monitoring**: Monitor UPC service health and performance
3. **Data quality**: Validate UPC data and confidence scores
4. **Cost optimization**: Monitor API usage and optimize costs
5. **Backup strategies**: Maintain multiple UPC service providers

### Integration Guidelines
1. **Async processing**: Use asynchronous operations for better performance
2. **Batch processing**: Process multiple lookups efficiently
3. **Confidence thresholds**: Set appropriate confidence levels
4. **Graceful degradation**: Handle service failures gracefully
5. **Data enrichment**: Use UPC data to enhance product information 
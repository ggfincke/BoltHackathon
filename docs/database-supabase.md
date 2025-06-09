# Supabase Database Subsystem

The Supabase database subsystem provides a robust, scalable backend for storing and managing product data, categories, brands, pricing history, and UPC mappings. Built on PostgreSQL with real-time capabilities, it serves as the central data repository for the retail crawling system.

## Architecture Overview

```
supabase/
├── migrations/              # Database schema migrations
├── .branches/              # Supabase branch management
├── .temp/                  # Temporary files
├── config.toml             # Supabase project configuration
└── .gitignore             # Git ignore rules

src/crawlers/
└── supabase_backend.py     # Database integration layer
```

## Database Schema

### Core Tables

#### Products Table
The central table storing normalized product information:
```sql
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(500) NOT NULL,
    brand_id INTEGER REFERENCES brands(id),
    category_id INTEGER REFERENCES categories(id),
    upc_id INTEGER REFERENCES upcs(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Listings Table
Retailer-specific product listings with pricing and availability:
```sql
CREATE TABLE listings (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id),
    retailer_id INTEGER REFERENCES retailers(id),
    external_id VARCHAR(100),        -- ASIN, TCIN, Item ID, etc.
    title VARCHAR(1000),
    price DECIMAL(10,2),
    original_price DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',
    url TEXT,
    image_url TEXT,
    availability_status VARCHAR(50),
    rating DECIMAL(2,1),
    review_count INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Categories Table
Hierarchical category structure with retailer-specific mappings:
```sql
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    normalized_name VARCHAR(200),
    parent_id INTEGER REFERENCES categories(id),
    retailer_id INTEGER REFERENCES retailers(id),
    level INTEGER,
    path TEXT,                       -- Full category path
    is_leaf BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Brands Table
Product brand information with normalization:
```sql
CREATE TABLE brands (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    normalized_name VARCHAR(200),
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### UPCs Table
Universal Product Code mappings:
```sql
CREATE TABLE upcs (
    id SERIAL PRIMARY KEY,
    upc_code VARCHAR(14) UNIQUE NOT NULL,
    upc_type VARCHAR(10),            -- UPC-A, UPC-E, EAN-13, etc.
    confidence_score DECIMAL(3,2),
    source VARCHAR(50),              -- lookup service used
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Price Histories Table
Historical pricing data for trend analysis:
```sql
CREATE TABLE price_histories (
    id SERIAL PRIMARY KEY,
    listing_id INTEGER REFERENCES listings(id),
    price DECIMAL(10,2),
    original_price DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',
    availability_status VARCHAR(50),
    recorded_at TIMESTAMP DEFAULT NOW()
);
```

#### Retailers Table
Retailer information and configuration:
```sql
CREATE TABLE retailers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    domain VARCHAR(100),
    country_code VARCHAR(2),
    currency VARCHAR(3),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Indexes and Performance

#### Primary Indexes
```sql
-- Product lookup optimization
CREATE INDEX idx_products_brand_category ON products(brand_id, category_id);
CREATE INDEX idx_products_upc ON products(upc_id);

-- Listing queries
CREATE INDEX idx_listings_product_retailer ON listings(product_id, retailer_id);
CREATE INDEX idx_listings_external_id ON listings(external_id);
CREATE INDEX idx_listings_updated_at ON listings(updated_at);

-- Category hierarchy
CREATE INDEX idx_categories_parent ON categories(parent_id);
CREATE INDEX idx_categories_retailer_level ON categories(retailer_id, level);

-- UPC lookups
CREATE INDEX idx_upcs_code ON upcs(upc_code);
CREATE INDEX idx_upcs_confidence ON upcs(confidence_score DESC);

-- Price history analysis
CREATE INDEX idx_price_histories_listing_date ON price_histories(listing_id, recorded_at);
```

#### Full-Text Search
```sql
-- Product name search
CREATE INDEX idx_products_name_fts ON products USING gin(to_tsvector('english', name));

-- Listing title search
CREATE INDEX idx_listings_title_fts ON listings USING gin(to_tsvector('english', title));
```

## Supabase Backend (`supabase_backend.py`)

The integration layer providing Python access to the database:

### Core Features
- **Connection management**: Automatic connection pooling and failover
- **Data validation**: Input validation and sanitization
- **Batch operations**: Efficient bulk insert and update operations
- **Conflict resolution**: Intelligent handling of duplicate data
- **Real-time subscriptions**: Live data updates via Supabase realtime
- **Row Level Security**: Fine-grained access control

### Key Methods

#### Product Management
```python
class SupabaseBackend:
    def insert_product(self, product_data: dict) -> int:
        """Insert new product with automatic normalization"""
        
    def update_product(self, product_id: int, updates: dict) -> bool:
        """Update existing product information"""
        
    def find_product_by_name(self, name: str, brand: str = None) -> dict:
        """Find product using fuzzy name matching"""
        
    def merge_products(self, primary_id: int, duplicate_ids: list) -> bool:
        """Merge duplicate products intelligently"""
```

#### Listing Operations
```python
    def insert_listing(self, listing_data: dict) -> int:
        """Insert retailer-specific product listing"""
        
    def update_listing_price(self, listing_id: int, price: float, availability: str) -> bool:
        """Update listing price and availability with history tracking"""
        
    def find_listing(self, retailer: str, external_id: str) -> dict:
        """Find listing by retailer and external ID"""
        
    def batch_insert_listings(self, listings: list) -> list:
        """Efficiently insert multiple listings"""
```

#### Category Management
```python
    def insert_category_hierarchy(self, hierarchy: dict, retailer: str) -> int:
        """Insert complete category hierarchy"""
        
    def normalize_category(self, category_name: str) -> str:
        """Normalize category name across retailers"""
        
    def find_or_create_category(self, name: str, parent_id: int = None) -> int:
        """Find existing category or create new one"""
```

#### UPC Operations
```python
    def insert_upc(self, upc_code: str, confidence: float, source: str) -> int:
        """Insert UPC with confidence scoring"""
        
    def link_product_upc(self, product_id: int, upc_id: int) -> bool:
        """Associate product with UPC code"""
        
    def find_products_by_upc(self, upc_code: str) -> list:
        """Find all products matching UPC"""
```

### Data Normalization

#### Brand Normalization
```python
def normalize_brand_name(brand_name: str) -> str:
    """Normalize brand names for consistency"""
    # Remove common suffixes
    suffixes = ['inc', 'llc', 'corp', 'company', 'co']
    normalized = brand_name.lower().strip()
    
    for suffix in suffixes:
        if normalized.endswith(f' {suffix}'):
            normalized = normalized[:-len(f' {suffix}')]
    
    return normalized.title()
```

#### Category Normalization
```python
def normalize_category_name(category: str) -> str:
    """Standardize category names across retailers"""
    # Mapping of retailer-specific to standard categories
    category_mappings = {
        'target': {
            'grocery': 'Food & Beverages',
            'health & beauty': 'Health & Personal Care',
            'household essentials': 'Household & Cleaning'
        },
        'amazon': {
            'amazon fresh': 'Food & Beverages',
            'beauty & personal care': 'Health & Personal Care'
        },
        'walmart': {
            'food': 'Food & Beverages',
            'personal care': 'Health & Personal Care'
        }
    }
    
    return category_mappings.get(retailer, {}).get(category.lower(), category)
```

## Configuration Management

### Environment Variables
```bash
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
DATABASE_MAX_CONNECTIONS=20
DATABASE_TIMEOUT=30
ENABLE_REALTIME=true
```

### Connection Configuration
```python
from supabase import create_client
import os

supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_ANON_KEY")
supabase = create_client(supabase_url, supabase_key)

# Configure connection pool
supabase.postgrest.session.headers.update({
    "connection": "keep-alive",
    "prefer": "return=minimal"
})
```

### Row Level Security (RLS)

#### Product Access Policy
```sql
-- Allow read access to all products
CREATE POLICY "products_select_policy" ON products
    FOR SELECT USING (true);

-- Restrict product modifications to authenticated users
CREATE POLICY "products_modify_policy" ON products
    FOR ALL USING (auth.role() = 'authenticated');
```

#### Listing Access Policy
```sql
-- Public read access to listings
CREATE POLICY "listings_select_policy" ON listings
    FOR SELECT USING (true);

-- Insert/update only for service role
CREATE POLICY "listings_modify_policy" ON listings
    FOR ALL USING (auth.role() = 'service_role');
```

## Database Operations

### Migration Management

#### Creating Migrations
```bash
# Create new migration
supabase migration new add_product_variants_table

# Apply migrations
supabase db push

# Reset database (development only)
supabase db reset
```

#### Example Migration
```sql
-- Migration: 20231201_add_product_variants.sql
CREATE TABLE product_variants (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id),
    variant_type VARCHAR(50), -- size, color, flavor, etc.
    variant_value VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_variants_product ON product_variants(product_id);
```

### Data Import/Export

#### Bulk Data Import
```python
def bulk_import_products(products_data: list):
    """Import large datasets efficiently"""
    batch_size = 1000
    
    for i in range(0, len(products_data), batch_size):
        batch = products_data[i:i + batch_size]
        
        # Use upsert for conflict resolution
        result = supabase.table('products').upsert(
            batch,
            on_conflict='external_id'
        ).execute()
        
        print(f"Imported batch {i//batch_size + 1}, {len(result.data)} records")
```

#### Data Export
```python
def export_products_to_json(retailer: str = None):
    """Export product data for analysis"""
    query = supabase.table('products').select(
        'id, name, brand:brands(name), category:categories(name), listings(*)'
    )
    
    if retailer:
        query = query.eq('listings.retailer.name', retailer)
    
    result = query.execute()
    return result.data
```

### Performance Optimization

#### Query Optimization
```python
# Efficient product search with related data
def search_products(query: str, retailer: str = None):
    """Optimized product search with minimal queries"""
    base_query = supabase.table('products').select(
        '''
        id, name,
        brand:brands(name),
        category:categories(name, path),
        listings(price, url, availability_status, retailer:retailers(name))
        '''
    ).textSearch('name', query)
    
    if retailer:
        base_query = base_query.eq('listings.retailer.name', retailer)
    
    return base_query.limit(50).execute()
```

#### Connection Pooling
```python
import threading
from concurrent.futures import ThreadPoolExecutor

class SupabasePool:
    def __init__(self, max_connections=10):
        self.pool = ThreadPoolExecutor(max_workers=max_connections)
        self.connections = threading.local()
    
    def get_connection(self):
        if not hasattr(self.connections, 'client'):
            self.connections.client = create_client(
                supabase_url, supabase_key
            )
        return self.connections.client
```

## Real-time Features

### Live Data Updates
```python
# Subscribe to product price changes
def subscribe_to_price_changes(callback):
    """Subscribe to real-time price updates"""
    supabase.table('price_histories').on(
        'INSERT',
        callback
    ).subscribe()

# Example callback
def price_change_handler(payload):
    new_record = payload['record']
    print(f"Price changed for listing {new_record['listing_id']}: ${new_record['price']}")
```

### Real-time Analytics
```python
# Live crawling progress tracking
def track_crawl_progress(crawl_id: str):
    """Track real-time crawling progress"""
    def progress_callback(payload):
        progress = payload['record']
        print(f"Crawl {crawl_id}: {progress['completed']}/{progress['total']} products")
    
    supabase.table('crawl_progress').on(
        'UPDATE',
        progress_callback
    ).eq('crawl_id', crawl_id).subscribe()
```

## Data Analytics and Reporting

### Price Trend Analysis
```sql
-- Calculate price trends over time
SELECT 
    p.name,
    b.name as brand,
    AVG(ph.price) as avg_price,
    MIN(ph.price) as min_price,
    MAX(ph.price) as max_price,
    COUNT(*) as price_points
FROM price_histories ph
JOIN listings l ON ph.listing_id = l.id
JOIN products p ON l.product_id = p.id
JOIN brands b ON p.brand_id = b.id
WHERE ph.recorded_at >= NOW() - INTERVAL '30 days'
GROUP BY p.id, p.name, b.name
ORDER BY avg_price DESC;
```

### Category Performance
```sql
-- Analyze product distribution by category
SELECT 
    c.name as category,
    c.path as category_path,
    COUNT(DISTINCT p.id) as product_count,
    COUNT(DISTINCT l.id) as listing_count,
    AVG(l.price) as avg_price,
    r.name as retailer
FROM categories c
JOIN products p ON p.category_id = c.id
JOIN listings l ON l.product_id = p.id
JOIN retailers r ON l.retailer_id = r.id
GROUP BY c.id, c.name, c.path, r.name
ORDER BY product_count DESC;
```

### UPC Coverage Analysis
```sql
-- Measure UPC coverage across products
SELECT 
    r.name as retailer,
    COUNT(*) as total_products,
    COUNT(p.upc_id) as products_with_upc,
    ROUND(
        COUNT(p.upc_id)::DECIMAL / COUNT(*)::DECIMAL * 100, 2
    ) as upc_coverage_percent
FROM listings l
JOIN products p ON l.product_id = p.id
JOIN retailers r ON l.retailer_id = r.id
GROUP BY r.id, r.name
ORDER BY upc_coverage_percent DESC;
```

## Backup and Recovery

### Database Backups
```bash
# Manual backup
supabase db dump --file backup_$(date +%Y%m%d).sql

# Automated backup script
#!/bin/bash
BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
supabase db dump --file "$BACKUP_DIR/backup_$DATE.sql"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "backup_*.sql" -mtime +7 -delete
```

### Data Recovery
```bash
# Restore from backup
supabase db reset
psql -h your-db-host -d your-database -f backup_20231201.sql
```

## Monitoring and Maintenance

### Performance Monitoring
```sql
-- Monitor slow queries
SELECT 
    query,
    mean_time,
    calls,
    total_time
FROM pg_stat_statements
WHERE mean_time > 1000  -- queries taking > 1 second
ORDER BY mean_time DESC;
```

### Database Health Checks
```python
def database_health_check():
    """Comprehensive database health check"""
    checks = {
        'connection': test_connection(),
        'table_sizes': get_table_sizes(),
        'recent_activity': check_recent_activity(),
        'index_usage': analyze_index_usage(),
        'replication_lag': check_replication_lag()
    }
    
    return checks

def test_connection():
    """Test basic database connectivity"""
    try:
        result = supabase.table('retailers').select('count').execute()
        return {'status': 'healthy', 'retailers': len(result.data)}
    except Exception as e:
        return {'status': 'error', 'message': str(e)}
```

### Maintenance Tasks
```python
# Regular maintenance tasks
def run_maintenance():
    """Execute routine maintenance tasks"""
    tasks = [
        cleanup_old_price_histories,
        update_category_statistics,
        refresh_materialized_views,
        reindex_large_tables,
        update_upc_confidence_scores
    ]
    
    for task in tasks:
        try:
            task()
            print(f"✓ Completed: {task.__name__}")
        except Exception as e:
            print(f"✗ Failed: {task.__name__} - {e}")

def cleanup_old_price_histories(days=90):
    """Remove price history records older than specified days"""
    cutoff_date = datetime.now() - timedelta(days=days)
    
    result = supabase.table('price_histories').delete().lt(
        'recorded_at', cutoff_date.isoformat()
    ).execute()
    
    print(f"Deleted {len(result.data)} old price history records")
```

## Best Practices

### Data Integrity
1. **Use transactions**: Wrap related operations in database transactions
2. **Validate inputs**: Always validate data before database operations
3. **Handle conflicts**: Use upsert operations for potentially duplicate data
4. **Monitor constraints**: Regularly check foreign key and unique constraints
5. **Backup regularly**: Maintain consistent backup schedules

### Performance Guidelines
1. **Index strategically**: Create indexes for frequently queried columns
2. **Batch operations**: Use bulk operations for large datasets
3. **Limit result sets**: Always use appropriate LIMIT clauses
4. **Connection pooling**: Reuse database connections efficiently
5. **Monitor queries**: Track slow queries and optimize as needed

### Security Considerations
1. **Row Level Security**: Implement appropriate RLS policies
2. **API key management**: Secure Supabase API keys and rotate regularly
3. **Data encryption**: Ensure sensitive data is encrypted at rest
4. **Access logging**: Monitor database access patterns
5. **Regular updates**: Keep Supabase and dependencies updated 
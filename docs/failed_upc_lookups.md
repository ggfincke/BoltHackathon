# Failed UPC Lookups System

This system provides automatic tracking and manual review capabilities for UPC lookup failures during product crawling.

## Overview

When the UPC lookup service fails to find a UPC for a product, the failure is automatically logged to the `failed_upc_lookups` table for manual review. This allows for:

- **Tracking**: Monitor which products are consistently failing UPC lookups
- **Manual Resolution**: Human reviewers can manually find and assign UPCs
- **Retry Logic**: Automatic retry of failed lookups over time
- **Analytics**: Understanding success rates and common failure patterns

## Database Schema

The `failed_upc_lookups` table includes:

```sql
CREATE TABLE failed_upc_lookups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL, -- For deduplication
    retailer_source VARCHAR(100),
    original_url TEXT,
    failure_reason TEXT,
    services_tried JSONB, -- Array of services attempted
    last_error TEXT,
    retry_count INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_review, resolved, ignored
    assigned_to UUID REFERENCES users(id),
    manual_upc VARCHAR(20), -- UPC added by manual review
    confidence_override DECIMAL(3,2), -- Manual confidence score
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);
```

## Status Flow

1. **pending** - New failed lookup, awaiting review
2. **in_review** - Assigned to a user for manual resolution
3. **resolved** - UPC manually found and assigned
4. **ignored** - Marked as not resolvable

## Integration

### Automatic Failure Tracking

The system is automatically integrated into the `SupabaseBackend` when UPC lookup is enabled:

```python
# UPC lookup enabled by default
backend = create_supabase_backend(enable_upc_lookup=True)

# Process products - failures automatically tracked
backend.send(product_records)
```

### Manual Usage

```python
from crawlers.upc_lookup import create_failed_upc_manager, create_upc_manager

# Create managers
supabase = create_client(url, key)
failed_upc_manager = create_failed_upc_manager(supabase)
upc_manager = create_upc_manager(supabase_client=supabase)

# Get pending reviews
pending = failed_upc_manager.get_pending_reviews(limit=10)

# Assign for review
failed_upc_manager.assign_for_review(lookup_id, user_id)

# Resolve with manual UPC
failed_upc_manager.resolve_with_upc(
    lookup_id=lookup_id,
    manual_upc="012345678901",
    confidence=0.95,
    notes="Found on manufacturer website"
)

# Retry failed lookups
results = failed_upc_manager.retry_failed_lookups(
    upc_manager=upc_manager,
    max_retries=3,
    limit=10
)
```

## Command Line Management

Use the `scripts/manage_failed_upcs.py` script for command-line management:

```bash
# List pending failed lookups
python scripts/manage_failed_upcs.py list --limit 20

# Show statistics
python scripts/manage_failed_upcs.py stats

# Assign lookup to user
python scripts/manage_failed_upcs.py assign <lookup_id> <user_id>

# Resolve with manual UPC
python scripts/manage_failed_upcs.py resolve <lookup_id> <upc> <confidence> --notes "Manual research"

# Mark as ignored
python scripts/manage_failed_upcs.py ignore <lookup_id> --reason "Product discontinued"

# Retry failed lookups
python scripts/manage_failed_upcs.py retry --max-retries 3 --limit 10

# Search by product name
python scripts/manage_failed_upcs.py search "coca cola"
```

## FailedUPCManager API

### Core Methods

#### `get_pending_reviews(limit=50, offset=0)`
Get failed lookups needing manual review.

**Returns:** `{"success": bool, "data": list, "count": int}`

#### `assign_for_review(lookup_id, user_id)`
Assign a failed lookup to a user for review.

**Returns:** `{"success": bool, "data": dict}`

#### `resolve_with_upc(lookup_id, manual_upc, confidence, notes=None)`
Resolve a failed lookup with manually found UPC.

**Parameters:**
- `lookup_id`: UUID of the failed lookup
- `manual_upc`: UPC code (must be numeric)
- `confidence`: Float between 0.0 and 1.0
- `notes`: Optional notes about the resolution

**Returns:** `{"success": bool, "data": dict}`

#### `mark_as_ignored(lookup_id, reason=None)`
Mark a failed lookup as ignored (not resolvable).

**Returns:** `{"success": bool, "data": dict}`

#### `retry_failed_lookups(upc_manager, max_retries=3, limit=10)`
Automatically retry failed lookups that haven't exceeded max retries.

**Returns:** `{"success": bool, "data": {"attempted": int, "successful": int, "failed": int, "details": list}}`

#### `get_statistics()`
Get comprehensive statistics about failed UPC lookups.

**Returns:** Statistics including counts by status, success rate, retry metrics

#### `search_failed_lookups(search_term, limit=50)`
Search failed lookups by product name.

**Returns:** `{"success": bool, "data": list, "count": int}`

## Workflow Examples

### Manual Review Workflow

1. **Get Pending Reviews**
   ```python
   pending = failed_upc_manager.get_pending_reviews(limit=10)
   ```

2. **Assign to Reviewer**
   ```python
   failed_upc_manager.assign_for_review(lookup_id, reviewer_user_id)
   ```

3. **Manual Research**
   - Reviewer searches manufacturer websites
   - Checks product packaging images
   - Uses alternative UPC databases

4. **Resolve or Ignore**
   ```python
   # If UPC found
   failed_upc_manager.resolve_with_upc(
       lookup_id, manual_upc, confidence, notes
   )
   
   # If not resolvable
   failed_upc_manager.mark_as_ignored(lookup_id, reason)
   ```

### Automatic Retry Workflow

Set up a scheduled job (e.g., daily cron job) to retry failed lookups:

```python
def daily_retry_job():
    upc_manager = create_upc_manager(supabase_client=supabase)
    failed_upc_manager = create_failed_upc_manager(supabase)
    
    # Retry up to 10 lookups that have been retried < 3 times
    results = failed_upc_manager.retry_failed_lookups(
        upc_manager=upc_manager,
        max_retries=3,
        limit=10
    )
    
    if results["success"]:
        data = results["data"]
        print(f"Retry results: {data['successful']}/{data['attempted']} successful")
```

### Integration with Product Updates

When a UPC is manually resolved, you may want to update the original product:

```python
def update_product_with_resolved_upc():
    # Get recently resolved lookups
    resolved = supabase.table('failed_upc_lookups')\
        .select('*')\
        .eq('status', 'resolved')\
        .is_('updated_product', 'null')\
        .execute()
    
    for lookup in resolved.data:
        # Find the product by name/URL and update with UPC
        products = supabase.table('products')\
            .select('id')\
            .eq('name', lookup['product_name'])\
            .execute()
        
        if products.data:
            # Update product with resolved UPC
            supabase.table('products')\
                .update({'upc': lookup['manual_upc']})\
                .eq('id', products.data[0]['id'])\
                .execute()
            
            # Mark lookup as product updated
            supabase.table('failed_upc_lookups')\
                .update({'updated_product': True})\
                .eq('id', lookup['id'])\
                .execute()
```

## Best Practices

### Deduplication
- The system uses `normalized_name` (lowercase, trimmed) to prevent duplicate entries
- Multiple failures for the same product increment `retry_count`

### Confidence Scoring
- Use confidence scores to prioritize manual reviews
- Higher confidence manual UPCs can be trusted more for automated processes

### Batch Processing
- Process manual reviews in batches for efficiency
- Use pagination for large datasets

### Error Handling
- All methods return structured responses with success/error status
- Log errors for debugging and monitoring

### Performance
- Indexes are created on key columns (status, created_at, assigned_to)
- Use appropriate limits when querying large datasets

## Monitoring and Analytics

### Key Metrics to Track

1. **Success Rate**: `resolved_count / total_count`
2. **Review Efficiency**: Average time from pending to resolved
3. **Retry Effectiveness**: Success rate of automatic retries
4. **Common Failure Patterns**: Most frequent failure reasons
5. **User Performance**: Resolution rates by reviewer

### Example Monitoring Queries

```sql
-- Success rate by retailer
SELECT 
    retailer_source,
    COUNT(*) as total,
    COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved,
    ROUND(COUNT(CASE WHEN status = 'resolved' THEN 1 END) * 100.0 / COUNT(*), 2) as success_rate
FROM failed_upc_lookups 
GROUP BY retailer_source
ORDER BY total DESC;

-- Average time to resolution
SELECT 
    AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as avg_hours_to_resolution
FROM failed_upc_lookups 
WHERE status = 'resolved';

-- Most prolific reviewers
SELECT 
    assigned_to,
    COUNT(*) as reviews_completed,
    AVG(confidence_override) as avg_confidence
FROM failed_upc_lookups 
WHERE status = 'resolved' AND assigned_to IS NOT NULL
GROUP BY assigned_to
ORDER BY reviews_completed DESC;
```

## Troubleshooting

### Common Issues

1. **Async/Sync Context Issues**
   - The UPC manager handles both async and sync contexts automatically
   - If you encounter asyncio errors, ensure proper event loop handling

2. **Database Permissions**
   - Ensure the Supabase client has read/write access to `failed_upc_lookups` table
   - Check RLS policies if using row-level security

3. **Memory Usage**
   - For large datasets, use pagination and appropriate limits
   - Clear UPC manager cache periodically if memory usage is high

4. **Performance**
   - Monitor retry job performance and adjust batch sizes
   - Consider adding additional indexes for custom query patterns

### Environment Setup

Ensure environment variables are set:
```bash
export SUPABASE_URL="your_supabase_url"
export SUPABASE_ANON_KEY="your_supabase_anon_key"
```

### Testing

Run the example script to test the system:
```bash
python scripts/example_usage.py
```

This will demonstrate the complete workflow and help verify everything is working correctly. 
-- Migration: supabase/migrations/20250609000001_failed_upc_lookups.sql
-- failed_upc_lookups table
-- stores UPC lookup failures for manual review

CREATE TABLE failed_upc_lookups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL,
    retailer_source VARCHAR(100),
    original_url TEXT,
    failure_reason TEXT,
    services_tried JSONB, 
    last_error TEXT,
    retry_count INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending',
    assigned_to UUID REFERENCES users(id),
    manual_upc VARCHAR(20), 
    confidence_override DECIMAL(3,2), 
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    
    UNIQUE(normalized_name) 
);

-- indexes
CREATE INDEX idx_failed_upc_status ON failed_upc_lookups(status);
CREATE INDEX idx_failed_upc_created ON failed_upc_lookups(created_at);
CREATE INDEX idx_failed_upc_assigned ON failed_upc_lookups(assigned_to);
CREATE INDEX idx_failed_upc_retailer ON failed_upc_lookups(retailer_source);
CREATE INDEX idx_failed_upc_retry_count ON failed_upc_lookups(retry_count);

-- trigger for updated_at
CREATE TRIGGER update_failed_upc_lookups_updated_at 
    BEFORE UPDATE ON failed_upc_lookups 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- comment
COMMENT ON TABLE failed_upc_lookups IS 'Stores failed UPC lookup attempts for manual review and resolution'; 
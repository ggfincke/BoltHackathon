-- Migration: supabase/migrations/20250615000001_make_listings_price_nullable
-- Make price nullable in listings table

BEGIN;

-- Make price nullable in listings table only
-- Keep price_histories.price as NOT NULL since we only insert when price exists
ALTER TABLE listings ALTER COLUMN price DROP NOT NULL;

-- Add a comment to document the business logic
COMMENT ON COLUMN listings.price IS 'Price can be NULL when extraction fails or price is not available. price_histories only stores actual prices.';

-- Optional: Add an index for listings without prices for monitoring
CREATE INDEX idx_listings_missing_prices ON listings (id) WHERE price IS NULL;

COMMIT;
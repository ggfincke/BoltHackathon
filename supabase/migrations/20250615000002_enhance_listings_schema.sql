-- Migration: supabase/migrations/20250615000002_enhance_listings_schema
-- Add image_url, rating, review_count, and availability_status to listings

-- add image_url to listings table for retailer-specific product images
ALTER TABLE listings ADD COLUMN image_url TEXT;

-- add rating field for retailer-specific ratings
ALTER TABLE listings ADD COLUMN rating DECIMAL(2,1);

-- add review_count for retailer-specific review counts
ALTER TABLE listings ADD COLUMN review_count INTEGER;

-- add availability_status for more granular stock tracking
ALTER TABLE listings ADD COLUMN availability_status VARCHAR(50) DEFAULT 'in_stock';

-- create indexes for the new fields to improve query performance
CREATE INDEX idx_listings_rating ON listings(rating) WHERE rating IS NOT NULL;
CREATE INDEX idx_listings_review_count ON listings(review_count) WHERE review_count IS NOT NULL;
CREATE INDEX idx_listings_availability_status ON listings(availability_status);

-- add check constraint for rating to ensure valid range (0.0 to 5.0)
ALTER TABLE listings ADD CONSTRAINT chk_listings_rating 
CHECK (rating IS NULL OR (rating >= 0.0 AND rating <= 5.0));

-- add check constraint for review_count to ensure non-negative values
ALTER TABLE listings ADD CONSTRAINT chk_listings_review_count 
CHECK (review_count IS NULL OR review_count >= 0);

-- add check constraint for availability_status to ensure valid values
ALTER TABLE listings ADD CONSTRAINT chk_listings_availability_status 
CHECK (availability_status IN ('in_stock', 'out_of_stock', 'limited_stock', 'backorder', 'discontinued'));

-- comment on the new columns for documentation
COMMENT ON COLUMN listings.image_url IS 'Retailer-specific product image URL';
COMMENT ON COLUMN listings.rating IS 'Retailer-specific product rating (0.0-5.0)';
COMMENT ON COLUMN listings.review_count IS 'Number of reviews for this product at this retailer';
COMMENT ON COLUMN listings.availability_status IS 'Granular availability status: in_stock, out_of_stock, limited_stock, backorder, discontinued'; 
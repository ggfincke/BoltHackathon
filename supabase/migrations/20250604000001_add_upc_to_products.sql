-- Add UPC field to products table
-- Migration: 20250604000001_add_upc_to_products.sql

-- Add UPC column to products table
ALTER TABLE products 
ADD COLUMN upc VARCHAR(20);

-- Add index on UPC for fast lookups
CREATE INDEX idx_products_upc ON products(upc) WHERE upc IS NOT NULL;

-- Add comment explaining the UPC field
COMMENT ON COLUMN products.upc IS 'Universal Product Code (UPC) for product identification';
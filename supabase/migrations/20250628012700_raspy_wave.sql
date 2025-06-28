/*
  # Add fuzzy search function for products

  1. Functions
    - `fuzzy_search_products` - Trigram similarity search for product names
  
  2. Extensions
    - Enable pg_trgm extension for trigram similarity
*/

-- Enable trigram extension for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create fuzzy search function
CREATE OR REPLACE FUNCTION fuzzy_search_products(
  search_term TEXT,
  similarity_threshold REAL DEFAULT 0.3,
  result_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  similarity REAL
)
LANGUAGE SQL
STABLE
AS $$
  SELECT 
    p.id,
    p.name,
    p.slug,
    SIMILARITY(p.name, search_term) as similarity
  FROM products p
  WHERE 
    p.is_active = true
    AND SIMILARITY(p.name, search_term) > similarity_threshold
  ORDER BY similarity DESC
  LIMIT result_limit;
$$;

-- Create index for better trigram performance
CREATE INDEX IF NOT EXISTS idx_products_name_trgm ON products USING gin (name gin_trgm_ops);
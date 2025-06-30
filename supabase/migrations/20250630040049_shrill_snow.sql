/*
  # Add Price Deals Functions

  1. New Functions
    - `get_price_gap_deals`: Finds products with significant price differences between retailers
    - `get_price_history_deals`: Finds products with significant price changes over time
    
  2. Purpose
    - These functions support the "Best Deals" feature on the homepage
    - They identify products with the biggest savings opportunities
*/

-- Function to find products with significant price differences between retailers
CREATE OR REPLACE FUNCTION get_price_gap_deals(min_percent_diff float, limit_count int)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  product_slug text,
  best_price numeric,
  worst_price numeric,
  best_retailer_name text,
  worst_retailer_name text,
  image_url text
) AS $$
BEGIN
  RETURN QUERY
  WITH product_price_ranges AS (
    SELECT 
      p.id AS product_id,
      p.name AS product_name,
      p.slug AS product_slug,
      MIN(l.price) AS min_price,
      MAX(l.price) AS max_price,
      (MAX(l.price) - MIN(l.price)) / NULLIF(MAX(l.price), 0) * 100 AS price_diff_percent
    FROM products p
    JOIN listings l ON p.id = l.product_id
    WHERE 
      l.price IS NOT NULL AND 
      l.in_stock = true
    GROUP BY p.id, p.name, p.slug
    HAVING COUNT(DISTINCT l.retailer_id) > 1
      AND (MAX(l.price) - MIN(l.price)) / NULLIF(MAX(l.price), 0) * 100 >= min_percent_diff
    ORDER BY price_diff_percent DESC
    LIMIT limit_count
  ),
  best_listings AS (
    SELECT 
      ppr.product_id,
      l.price AS best_price,
      r.name AS best_retailer_name,
      l.image_url
    FROM product_price_ranges ppr
    JOIN listings l ON ppr.product_id = l.product_id
    JOIN retailers r ON l.retailer_id = r.id
    WHERE l.price = ppr.min_price
    ORDER BY l.image_url NULLS LAST
    LIMIT 1
  ),
  worst_listings AS (
    SELECT 
      ppr.product_id,
      l.price AS worst_price,
      r.name AS worst_retailer_name
    FROM product_price_ranges ppr
    JOIN listings l ON ppr.product_id = l.product_id
    JOIN retailers r ON l.retailer_id = r.id
    WHERE l.price = ppr.max_price
    LIMIT 1
  )
  SELECT 
    ppr.product_id,
    ppr.product_name,
    ppr.product_slug,
    bl.best_price,
    wl.worst_price,
    bl.best_retailer_name,
    wl.worst_retailer_name,
    COALESCE(bl.image_url, (
      SELECT l.image_url 
      FROM listings l 
      WHERE l.product_id = ppr.product_id AND l.image_url IS NOT NULL 
      LIMIT 1
    )) AS image_url
  FROM product_price_ranges ppr
  JOIN best_listings bl ON ppr.product_id = bl.product_id
  JOIN worst_listings wl ON ppr.product_id = wl.product_id
  ORDER BY ppr.price_diff_percent DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to find products with significant price changes over time
CREATE OR REPLACE FUNCTION get_price_history_deals(min_percent_change float, limit_count int)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  product_slug text,
  current_price numeric,
  old_price numeric,
  retailer_name text,
  image_url text
) AS $$
BEGIN
  RETURN QUERY
  WITH current_prices AS (
    SELECT DISTINCT ON (l.product_id, l.retailer_id)
      l.product_id,
      l.retailer_id,
      l.price AS current_price,
      r.name AS retailer_name,
      l.image_url
    FROM listings l
    JOIN retailers r ON l.retailer_id = r.id
    WHERE l.price IS NOT NULL
    ORDER BY l.product_id, l.retailer_id, l.updated_at DESC
  ),
  historical_prices AS (
    SELECT DISTINCT ON (ph.listing_id)
      l.product_id,
      l.retailer_id,
      ph.price AS old_price,
      ph.timestamp
    FROM price_histories ph
    JOIN listings l ON ph.listing_id = l.id
    WHERE 
      ph.timestamp < (NOW() - INTERVAL '7 days')
    ORDER BY ph.listing_id, ph.timestamp DESC
  ),
  price_changes AS (
    SELECT 
      cp.product_id,
      p.name AS product_name,
      p.slug AS product_slug,
      cp.current_price,
      hp.old_price,
      cp.retailer_name,
      cp.image_url,
      (hp.old_price - cp.current_price) / NULLIF(hp.old_price, 0) * 100 AS price_change_percent
    FROM current_prices cp
    JOIN historical_prices hp ON cp.product_id = hp.product_id AND cp.retailer_id = hp.retailer_id
    JOIN products p ON cp.product_id = p.id
    WHERE 
      cp.current_price < hp.old_price AND
      (hp.old_price - cp.current_price) / NULLIF(hp.old_price, 0) * 100 >= min_percent_change
  )
  SELECT 
    pc.product_id,
    pc.product_name,
    pc.product_slug,
    pc.current_price,
    pc.old_price,
    pc.retailer_name,
    COALESCE(pc.image_url, (
      SELECT l.image_url 
      FROM listings l 
      WHERE l.product_id = pc.product_id AND l.image_url IS NOT NULL 
      LIMIT 1
    )) AS image_url
  FROM price_changes pc
  ORDER BY pc.price_change_percent DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to find products with fuzzy name matching (for search)
CREATE OR REPLACE FUNCTION fuzzy_search_products(search_term text, similarity_threshold float, result_limit int)
RETURNS TABLE (
  id uuid,
  name text,
  slug text,
  similarity float
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.name,
    p.slug,
    similarity(p.name, search_term) AS sim
  FROM products p
  WHERE 
    similarity(p.name, search_term) > similarity_threshold
  ORDER BY sim DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;
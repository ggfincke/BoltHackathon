-- Fix security and permission issues for the Best Deals helper functions
-- by making them SECURITY DEFINER and ensuring the public search_path.
-- This avoids RLS/privilege errors when anonymous users call the RPCs
-- from the web client.

-- NOTE: We use the same SQL logic as the previous migration but add
-- SECURITY DEFINER, search_path, and explicit GRANT EXECUTE.

-------------------------------------------------------------------------------
-- Redeclare get_price_gap_deals ------------------------------------------------
-------------------------------------------------------------------------------
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
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
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
    SELECT DISTINCT ON (l.product_id)
      ppr.product_id,
      l.price AS best_price,
      r.name AS best_retailer_name,
      l.image_url
    FROM product_price_ranges ppr
    JOIN listings l ON ppr.product_id = l.product_id
    JOIN retailers r ON l.retailer_id = r.id
    WHERE l.price = ppr.min_price
    ORDER BY l.product_id, l.image_url NULLS LAST
  ),
  worst_listings AS (
    SELECT DISTINCT ON (l.product_id)
      ppr.product_id,
      l.price AS worst_price,
      r.name AS worst_retailer_name
    FROM product_price_ranges ppr
    JOIN listings l ON ppr.product_id = l.product_id
    JOIN retailers r ON l.retailer_id = r.id
    WHERE l.price = ppr.max_price
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
  ORDER BY (wl.worst_price - bl.best_price) / NULLIF(wl.worst_price, 0) DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_price_gap_deals(float, int) TO anon, authenticated;

-------------------------------------------------------------------------------
-- Redeclare get_price_history_deals -------------------------------------------
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_price_history_deals(min_percent_change float, limit_count int)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  product_slug text,
  current_price numeric,
  old_price numeric,
  retailer_name text,
  image_url text
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
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
  ORDER BY (pc.old_price - pc.current_price) / NULLIF(pc.old_price, 0) DESC
  LIMIT limit_count;
END;
$$;

GRANT EXECUTE ON FUNCTION get_price_history_deals(float, int) TO anon, authenticated; 
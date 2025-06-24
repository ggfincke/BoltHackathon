-- Migration: supabase/migrations/20250624000001_allow_upc_updates.sql
-- Allows crawler/service_role to update UPC values in products and listings tables

-- Products table: permit service_role to update any column (UPC included)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename   = 'products' 
          AND policyname  = 'Service role can update products'
    ) THEN
        CREATE POLICY "Service role can update products" ON products
            FOR UPDATE USING ( (select auth.role()) = 'service_role' );
    END IF;
END $$;

-- Listings table: permit service_role to update any column (UPC included)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename   = 'listings' 
          AND policyname  = 'Service role can update listings'
    ) THEN
        CREATE POLICY "Service role can update listings" ON listings
            FOR UPDATE USING ( (select auth.role()) = 'service_role' );
    END IF;
END $$; 
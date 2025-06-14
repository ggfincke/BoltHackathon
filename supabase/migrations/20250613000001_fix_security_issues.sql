-- Migration: supabase/migrations/20250613000001_fix_security_issues.sql
-- Fixes missing RLS policies & function security issues

-- Enable RLS on missing tables
ALTER TABLE IF EXISTS retailer_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS failed_upc_lookups ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for crawler backend tables (these tables are primarily written by crawlers, not end users)

-- Allow service role to manage retailer_metrics (for crawlers)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'retailer_metrics' 
        AND policyname = 'Service role can manage retailer_metrics'
    ) THEN
        CREATE POLICY "Service role can manage retailer_metrics" ON retailer_metrics
            FOR ALL USING (
                auth.role() = 'service_role' OR 
                auth.role() = 'authenticated'
            );
    END IF;
END $$;

-- Allow service role to manage failed UPC lookups (for crawlers)  
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'failed_upc_lookups' 
        AND policyname = 'Service role can manage failed_upc_lookups'
    ) THEN
        CREATE POLICY "Service role can manage failed_upc_lookups" ON failed_upc_lookups
            FOR ALL USING (
                auth.role() = 'service_role' OR 
                auth.role() = 'authenticated'
            );
    END IF;
END $$;

-- Fix function search path security issue
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;
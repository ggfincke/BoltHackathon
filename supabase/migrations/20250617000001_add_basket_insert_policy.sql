-- Migration: supabase/migrations/20250617000001_add_basket_insert_policy.sql
-- Add missing INSERT policy for baskets table; this allows authenticated users to create new baskets

CREATE POLICY "Users can create baskets" ON baskets
    FOR INSERT WITH CHECK ((select auth.uid()) IS NOT NULL); 
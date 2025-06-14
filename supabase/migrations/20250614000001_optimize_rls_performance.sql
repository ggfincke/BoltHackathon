-- Migration: supabase/migrations/20250614000001_optimize_rls_performance
-- Optimizes RLS policies to prevent auth function re-evaluation per row

-- Drop existing policies that have performance issues
DROP POLICY IF EXISTS "Users can view their own profile" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON subscriptions;
DROP POLICY IF EXISTS "Users can view their own notification preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can manage their own baskets" ON basket_users;
DROP POLICY IF EXISTS "Users can view baskets they have access to" ON baskets;
DROP POLICY IF EXISTS "Users can update baskets they own" ON baskets;
DROP POLICY IF EXISTS "Users can manage basket items for their baskets" ON basket_items;
DROP POLICY IF EXISTS "Users can view their own basket trackings" ON basket_trackings;
DROP POLICY IF EXISTS "Users can view their own product trackings" ON product_trackings;
DROP POLICY IF EXISTS "Service role can manage retailer_metrics" ON retailer_metrics;
DROP POLICY IF EXISTS "Service role can manage failed_upc_lookups" ON failed_upc_lookups;

-- Recreate all policies with optimized auth function calls
-- Key change: auth.uid() becomes (select auth.uid()) for better performance

-- Users table policies
CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING ((select auth.uid()) = id);

CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING ((select auth.uid()) = id);

-- Subscriptions table policies  
CREATE POLICY "Users can view their own subscriptions" ON subscriptions
    FOR SELECT USING ((select auth.uid()) = user_id);

-- Notification preferences table policies
CREATE POLICY "Users can view their own notification preferences" ON notification_preferences
    FOR ALL USING ((select auth.uid()) = user_id);

-- Notifications table policies
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR ALL USING ((select auth.uid()) = user_id);

-- Basket users table policies
CREATE POLICY "Users can manage their own baskets" ON basket_users
    FOR ALL USING ((select auth.uid()) = user_id);

-- Baskets table policies
CREATE POLICY "Users can view baskets they have access to" ON baskets
    FOR SELECT USING (
        is_public = true OR 
        id IN (SELECT basket_id FROM basket_users WHERE user_id = (select auth.uid()))
    );

CREATE POLICY "Users can update baskets they own" ON baskets
    FOR UPDATE USING (
        id IN (SELECT basket_id FROM basket_users WHERE user_id = (select auth.uid()) AND role = 'owner')
    );

-- Basket items table policies
CREATE POLICY "Users can manage basket items for their baskets" ON basket_items
    FOR ALL USING (
        basket_id IN (SELECT basket_id FROM basket_users WHERE user_id = (select auth.uid()))
    );

-- Basket trackings table policies
CREATE POLICY "Users can view their own basket trackings" ON basket_trackings
    FOR ALL USING ((select auth.uid()) = user_id);

-- Product trackings table policies  
CREATE POLICY "Users can view their own product trackings" ON product_trackings
    FOR ALL USING ((select auth.uid()) = user_id);

-- Crawler/Backend table policies (optimized)
CREATE POLICY "Service role can manage retailer_metrics" ON retailer_metrics
    FOR ALL USING (
        (select auth.role()) = 'service_role' OR 
        (select auth.role()) = 'authenticated'
    );

CREATE POLICY "Service role can manage failed_upc_lookups" ON failed_upc_lookups
    FOR ALL USING (
        (select auth.role()) = 'service_role' OR 
        (select auth.role()) = 'authenticated'
    );
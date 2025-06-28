-- Migration: supabase/migrations/20250628012901_add_basket_delete_policy.sql
-- Add missing DELETE policy for baskets table; this allows basket owners to delete their baskets.

CREATE POLICY "Users can delete baskets they own" ON baskets
    FOR DELETE USING (
        id IN (
            SELECT basket_id
            FROM basket_users
            WHERE user_id = (select auth.uid()) AND role = 'owner'
        )
    ); 
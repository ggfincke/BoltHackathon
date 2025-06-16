-- Migration: supabase/migrations/20250615000004_migrate_existing_users.sql
-- Migrate existing auth users to public.users table
-- This handles users that were created before the trigger was set up

-- Insert existing auth users into public.users if they don't already exist (if they have a confirmed email)
INSERT INTO public.users (id, email, first_name, last_name, username, created_at)
SELECT 
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'first_name', '') as first_name,
  COALESCE(au.raw_user_meta_data->>'last_name', '') as last_name,
  COALESCE(au.raw_user_meta_data->>'username', split_part(au.email, '@', 1)) as username,
  au.created_at
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL  -- Only insert users that don't already exist in public.users
  AND au.email_confirmed_at IS NOT NULL;  -- Only confirmed users 
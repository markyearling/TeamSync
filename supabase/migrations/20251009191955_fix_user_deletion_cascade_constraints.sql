/*
  # Fix User Deletion with Proper CASCADE Constraints

  ## Overview
  This migration fixes the delete user account functionality by adding ON DELETE CASCADE
  to foreign key constraints that were missing it. When a user is deleted from auth.users,
  all related data should be automatically removed.

  ## Changes Made

  ### 1. profiles table
  - Drop existing foreign key constraint on user_id
  - Recreate with ON DELETE CASCADE
  - Ensures all child profiles are deleted when user is deleted

  ### 2. user_settings table
  - Drop existing foreign key constraint on user_id
  - Recreate with ON DELETE CASCADE
  - Ensures user settings are deleted when user is deleted

  ### 3. platform_teams table
  - Drop existing foreign key constraint on user_id
  - Recreate with ON DELETE CASCADE
  - Ensures platform connections are deleted when user is deleted

  ## Data Integrity
  - All existing data relationships are preserved
  - Only the deletion behavior is changed
  - Existing cascades on other tables (friendships, notifications, etc.) remain unchanged

  ## Security
  - No changes to RLS policies
  - User data deletion is now properly cascaded throughout the database
  - When a user is deleted, they are automatically removed from friend lists via existing cascades
*/

-- ============================================================================
-- FIX profiles TABLE CASCADE
-- ============================================================================

-- First, get the name of the existing constraint
DO $$
DECLARE
  constraint_name text;
BEGIN
  -- Find the existing foreign key constraint name
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'profiles'
    AND con.contype = 'f'
    AND con.confrelid = 'auth.users'::regclass
    AND array_position(ARRAY(
      SELECT a.attname
      FROM pg_attribute a
      WHERE a.attrelid = con.conrelid
        AND a.attnum = ANY(con.conkey)
    ), 'user_id') IS NOT NULL;

  -- Drop the existing constraint if found
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT IF EXISTS %I', constraint_name);
    RAISE NOTICE 'Dropped constraint % from profiles table', constraint_name;
  END IF;

  -- Add the new constraint with ON DELETE CASCADE
  ALTER TABLE profiles
    ADD CONSTRAINT profiles_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

  RAISE NOTICE 'Added CASCADE constraint to profiles.user_id';
END $$;

-- ============================================================================
-- FIX user_settings TABLE CASCADE
-- ============================================================================

DO $$
DECLARE
  constraint_name text;
BEGIN
  -- Find the existing foreign key constraint name
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'user_settings'
    AND con.contype = 'f'
    AND con.confrelid = 'auth.users'::regclass
    AND array_position(ARRAY(
      SELECT a.attname
      FROM pg_attribute a
      WHERE a.attrelid = con.conrelid
        AND a.attnum = ANY(con.conkey)
    ), 'user_id') IS NOT NULL;

  -- Drop the existing constraint if found
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE user_settings DROP CONSTRAINT IF EXISTS %I', constraint_name);
    RAISE NOTICE 'Dropped constraint % from user_settings table', constraint_name;
  END IF;

  -- Add the new constraint with ON DELETE CASCADE
  ALTER TABLE user_settings
    ADD CONSTRAINT user_settings_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

  RAISE NOTICE 'Added CASCADE constraint to user_settings.user_id';
END $$;

-- ============================================================================
-- FIX platform_teams TABLE CASCADE
-- ============================================================================

DO $$
DECLARE
  constraint_name text;
BEGIN
  -- Find the existing foreign key constraint name
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'platform_teams'
    AND con.contype = 'f'
    AND con.confrelid = 'auth.users'::regclass
    AND array_position(ARRAY(
      SELECT a.attname
      FROM pg_attribute a
      WHERE a.attrelid = con.conrelid
        AND a.attnum = ANY(con.conkey)
    ), 'user_id') IS NOT NULL;

  -- Drop the existing constraint if found
  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE platform_teams DROP CONSTRAINT IF EXISTS %I', constraint_name);
    RAISE NOTICE 'Dropped constraint % from platform_teams table', constraint_name;
  END IF;

  -- Add the new constraint with ON DELETE CASCADE
  ALTER TABLE platform_teams
    ADD CONSTRAINT platform_teams_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

  RAISE NOTICE 'Added CASCADE constraint to platform_teams.user_id';
END $$;

-- ============================================================================
-- VERIFY CASCADE CONSTRAINTS
-- ============================================================================

-- Create a view to verify all CASCADE constraints are in place
CREATE OR REPLACE VIEW public.user_deletion_cascade_check AS
SELECT
  con.conname AS constraint_name,
  rel.relname AS table_name,
  a.attname AS column_name,
  confrel.relname AS referenced_table,
  CASE con.confdeltype
    WHEN 'a' THEN 'NO ACTION'
    WHEN 'r' THEN 'RESTRICT'
    WHEN 'c' THEN 'CASCADE'
    WHEN 'n' THEN 'SET NULL'
    WHEN 'd' THEN 'SET DEFAULT'
  END AS on_delete_action
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_class confrel ON confrel.oid = con.confrelid
JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY(con.conkey)
WHERE con.contype = 'f'
  AND confrel.relname = 'users'
  AND confrel.relnamespace = 'auth'::regnamespace
  AND rel.relnamespace = 'public'::regnamespace
ORDER BY rel.relname, con.conname;

-- Grant access to authenticated users for verification purposes
GRANT SELECT ON public.user_deletion_cascade_check TO authenticated;

COMMENT ON VIEW public.user_deletion_cascade_check IS
'View to verify all foreign key constraints to auth.users have proper ON DELETE CASCADE rules.
All constraints should show CASCADE for proper user deletion functionality.';

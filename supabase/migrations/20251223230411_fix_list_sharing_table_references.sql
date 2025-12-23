/*
  # Fix List Sharing Table References

  1. Updates
    - Fix `get_administrator_friends` function to use correct table name `profiles` instead of `user_profiles`
    - Map column names from `profiles` schema (name, photo_url) to expected output (full_name, avatar_url)
    
  2. Changes
    - Updates the function to correctly join with `profiles` table
    - Ensures proper column name mapping for frontend compatibility
*/

-- Drop and recreate the function with correct table references
DROP FUNCTION IF EXISTS get_administrator_friends();

CREATE OR REPLACE FUNCTION get_administrator_friends()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  avatar_url text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id as user_id,
    u.email,
    p.name as full_name,
    p.photo_url as avatar_url
  FROM friendships f
  JOIN auth.users u ON u.id = f.friend_id
  LEFT JOIN profiles p ON p.user_id = u.id
  WHERE f.user_id = auth.uid()
    AND f.role = 'administrator';
END;
$$;
/*
  # Fix get_administrator_friends Email Type Cast

  1. Changes
    - Add explicit cast of `u.email` to `text` type
    - PostgreSQL requires exact type matching between declared return type and actual return type
    - `auth.users.email` is `character varying(255)` but function declares `text`
    
  2. Impact
    - Fixes "structure of query does not match function result type" error
    - Function will now properly return friend data without type mismatch errors
*/

-- Drop and recreate the function with proper type casting
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
    u.email::text,  -- Explicitly cast to text to match return type
    COALESCE(us.full_name, '') as full_name,
    us.profile_photo_url as avatar_url
  FROM friendships f
  JOIN auth.users u ON u.id = f.friend_id
  LEFT JOIN user_settings us ON us.user_id = u.id
  WHERE f.user_id = auth.uid()
    AND f.role = 'administrator';
END;
$$;
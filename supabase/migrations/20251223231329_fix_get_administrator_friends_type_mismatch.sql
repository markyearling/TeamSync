/*
  # Fix get_administrator_friends Type Mismatch
  
  1. Problem
    - The function returns `email text` but `auth.users.email` is `character varying(255)`
    - PostgreSQL requires exact type matching between function signature and returned columns
    - This causes a 400 error: "Returned type character varying(255) does not match expected type text"
    
  2. Solution
    - Add explicit cast to `text` for the email column in the SELECT statement
    - This ensures the returned type matches the function signature exactly
*/

-- Drop and recreate the function with correct type casting
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
    u.email::text,
    p.name as full_name,
    p.photo_url as avatar_url
  FROM friendships f
  JOIN auth.users u ON u.id = f.friend_id
  LEFT JOIN profiles p ON p.user_id = u.id
  WHERE f.user_id = auth.uid()
    AND f.role = 'administrator';
END;
$$;

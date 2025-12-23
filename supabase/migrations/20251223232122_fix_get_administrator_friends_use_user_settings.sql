/*
  # Fix get_administrator_friends to use user_settings

  1. Changes
    - Update `get_administrator_friends` function to query `user_settings` instead of `profiles`
    - `profiles` table is for child profiles, `user_settings` is for account holders
    - Map column names from `user_settings` (full_name, profile_photo_url) to expected output
    
  2. Impact
    - Function will now correctly return administrator friend data from user account settings
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
    COALESCE(us.full_name, '') as full_name,
    us.profile_photo_url as avatar_url
  FROM friendships f
  JOIN auth.users u ON u.id = f.friend_id
  LEFT JOIN user_settings us ON us.user_id = u.id
  WHERE f.user_id = auth.uid()
    AND f.role = 'administrator';
END;
$$;
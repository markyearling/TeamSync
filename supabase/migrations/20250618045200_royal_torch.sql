/*
  # Force refresh friendships data and fix potential caching issues

  1. Changes
    - Add a function to manually refresh friendship data
    - Update the updated_at timestamp on all friendships to force cache invalidation
    - Add better indexing for friendship queries

  2. Security
    - Maintain existing RLS policies
    - Add function to help debug friendship issues
*/

-- Update all friendships to force cache refresh
UPDATE friendships 
SET updated_at = now() 
WHERE updated_at IS NOT NULL;

-- Create a function to refresh a specific user's friendship cache
CREATE OR REPLACE FUNCTION refresh_user_friendships(user_uuid uuid)
RETURNS void
SECURITY DEFINER
AS $$
BEGIN
  -- Update the updated_at timestamp for all friendships involving this user
  UPDATE friendships 
  SET updated_at = now() 
  WHERE user_id = user_uuid OR friend_id = user_uuid;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION refresh_user_friendships(uuid) TO authenticated;

-- Add better indexes for friendship queries
CREATE INDEX IF NOT EXISTS idx_friendships_user_role ON friendships(user_id, role);
CREATE INDEX IF NOT EXISTS idx_friendships_updated_at ON friendships(updated_at DESC);

-- Create a comprehensive debug function
CREATE OR REPLACE FUNCTION debug_friendship_details(user_uuid uuid)
RETURNS TABLE (
  friendship_id uuid,
  user_id uuid,
  friend_id uuid,
  role text,
  created_at timestamptz,
  updated_at timestamptz,
  friend_name text,
  friend_email text
) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    f.id,
    f.user_id,
    f.friend_id,
    f.role,
    f.created_at,
    f.updated_at,
    COALESCE(us.full_name, 'No name') as friend_name,
    COALESCE(au.email, 'No email') as friend_email
  FROM friendships f
  LEFT JOIN user_settings us ON us.user_id = f.friend_id
  LEFT JOIN auth.users au ON au.id = f.friend_id
  WHERE f.user_id = user_uuid
  ORDER BY f.updated_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION debug_friendship_details(uuid) TO authenticated;
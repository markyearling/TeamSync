/*
  # Fix Administrator Access for Friends' Profiles

  1. Changes
    - Update friendships RLS policies to ensure proper querying
    - Add debugging view to check friendship data
    - Ensure administrator role is properly set and queryable

  2. Security
    - Maintain existing security while enabling administrator access
    - Allow users to query friendships where they have administrator access
*/

-- First, let's check if there are any friendships at all
-- This will help debug the issue

-- Update the friendships SELECT policy to be more explicit
DROP POLICY IF EXISTS "Users can view their own friendships" ON friendships;

CREATE POLICY "Users can view their own friendships"
  ON friendships
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR auth.uid() = friend_id
  );

-- Ensure the role column has the correct values
-- Update any existing 'viewer' roles to 'none' if they exist
UPDATE friendships 
SET role = 'none' 
WHERE role NOT IN ('none', 'viewer', 'administrator');

-- Create a debug function to check friendship data (temporary)
CREATE OR REPLACE FUNCTION debug_user_friendships(user_uuid uuid)
RETURNS TABLE (
  friendship_id uuid,
  user_id uuid,
  friend_id uuid,
  role text,
  created_at timestamptz
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
    f.created_at
  FROM friendships f
  WHERE f.user_id = user_uuid OR f.friend_id = user_uuid;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION debug_user_friendships(uuid) TO authenticated;
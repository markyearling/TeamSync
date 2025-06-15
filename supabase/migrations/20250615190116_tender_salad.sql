/*
  # Fix friendships table RLS policy for friend requests

  1. Changes
    - Update the INSERT policy on friendships table to allow users to create both sides of a friendship
    - This allows accepting friend requests to work properly by permitting insertion of reciprocal friendship records

  2. Security
    - Policy ensures users can only insert friendship records where they are either the user_id or friend_id
    - Maintains security while allowing proper friendship creation
*/

-- Drop the existing restrictive policy for managing friendships
DROP POLICY IF EXISTS "Users can manage their own friendships" ON friendships;

-- Create separate policies for better control
CREATE POLICY "Users can insert friendships where they are involved"
  ON friendships
  FOR INSERT
  TO authenticated
  WITH CHECK ((auth.uid() = user_id) OR (auth.uid() = friend_id));

CREATE POLICY "Users can update their own friendships"
  ON friendships
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own friendships"
  ON friendships
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
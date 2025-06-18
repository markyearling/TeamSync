/*
  # Fix profiles RLS policy to allow viewing all profiles

  1. Changes
    - Update profiles RLS policy to allow authenticated users to view all profiles
    - This is necessary for the friends feature to work properly
    - Users can still only manage (insert/update/delete) their own profiles

  2. Security
    - Maintains security by only allowing users to modify their own profiles
    - Allows viewing all profiles for friend discovery and sharing features
*/

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can manage their own profiles" ON profiles;

-- Create separate policies for better control
CREATE POLICY "Users can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own profiles"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profiles"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own profiles"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
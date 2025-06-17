/*
  # Fix searchable_users view permissions

  1. Changes
    - Add policy to user_settings table to allow authenticated users to search for other users
    - Grant proper permissions on the searchable_users view
    
  2. Security
    - Allow authenticated users to search for other users by name
    - Maintain privacy by only exposing necessary fields through the view
*/

-- Add policy to user_settings table to allow authenticated users to search for other users
CREATE POLICY "Authenticated users can search for other users"
  ON user_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Ensure the view has the correct permissions
GRANT SELECT ON searchable_users TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
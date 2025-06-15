/*
  # Fix searchable_users view permissions (handle existing policy)

  1. Changes
    - Drop existing policy if it exists before creating new one
    - Grant necessary permissions on the view
    - Ensure schema permissions are set

  2. Security
    - Allow authenticated users to search for other users through the view
    - Maintain existing security constraints
*/

-- Drop the policy if it exists to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can search for other users" ON user_settings;

-- Add policy to user_settings table to allow authenticated users to search for other users
CREATE POLICY "Authenticated users can search for other users"
  ON user_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Ensure the view has the correct permissions
GRANT SELECT ON searchable_users TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;
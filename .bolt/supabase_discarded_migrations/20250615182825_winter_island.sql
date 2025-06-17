/*
  # Fix searchable_users view permissions

  1. Security Updates
    - Add RLS policy for searchable_users view to allow authenticated users to search
    - Ensure the view has proper permissions for user search functionality

  2. Changes
    - Create policy "Allow authenticated users to search users" on searchable_users view
    - Grant SELECT permission to authenticated users on the view
*/

-- Enable RLS on the searchable_users view if not already enabled
ALTER TABLE searchable_users ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to search for other users
CREATE POLICY "Allow authenticated users to search users"
  ON searchable_users
  FOR SELECT
  TO authenticated
  USING (true);

-- Ensure the view has the correct permissions
GRANT SELECT ON searchable_users TO authenticated;
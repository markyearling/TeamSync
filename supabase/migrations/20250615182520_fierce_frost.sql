/*
  # Fix searchable_users view permissions

  1. Security Changes
    - Grant SELECT permission on searchable_users view to authenticated role
    - This allows logged-in users to search for other users in the friends system

  2. Notes
    - The searchable_users view was missing proper permissions for authenticated users
    - This fixes the "permission denied for table users" error when searching users
*/

-- Grant SELECT permission on searchable_users view to authenticated users
GRANT SELECT ON public.searchable_users TO authenticated;
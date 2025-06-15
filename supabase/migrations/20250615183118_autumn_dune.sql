/*
  # Fix searchable_users view permissions

  1. Security
    - Grant SELECT permission on searchable_users view to authenticated users
    - This allows the friend search functionality to work properly

  2. Changes
    - Add SELECT permission for authenticated role on searchable_users view
    - Ensures users can search for other users to send friend requests
*/

-- Grant SELECT permission on searchable_users view to authenticated users
GRANT SELECT ON public.searchable_users TO authenticated;
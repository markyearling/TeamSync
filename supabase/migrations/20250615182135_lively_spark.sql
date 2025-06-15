/*
  # Fix friends search to find all users

  1. Create a view that safely exposes user information for search
  2. The view combines auth.users with user_settings for complete user info
  3. Only exposes safe fields (no sensitive auth data)

  2. Security
    - View is accessible to authenticated users only
    - Only exposes id, email, full_name, and profile_photo_url
    - No sensitive authentication data is exposed
*/

-- Create a view that combines auth.users with user_settings for search
CREATE OR REPLACE VIEW public.searchable_users AS
SELECT 
  au.id,
  au.email,
  COALESCE(us.full_name, '') as full_name,
  us.profile_photo_url
FROM auth.users au
LEFT JOIN public.user_settings us ON au.id = us.user_id
WHERE au.email_confirmed_at IS NOT NULL; -- Only include confirmed users

-- Enable RLS on the view
ALTER VIEW public.searchable_users SET (security_invoker = true);

-- Grant access to authenticated users
GRANT SELECT ON public.searchable_users TO authenticated;

-- Create a policy for the view (this applies to the underlying tables)
CREATE POLICY "Authenticated users can search for other users"
  ON public.user_settings
  FOR SELECT
  TO authenticated
  USING (true);
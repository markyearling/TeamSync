/*
  # Add support for pull-to-refresh functionality

  1. Changes
    - Add function to refresh all platform teams for a user
    - Add function to mark all teams as refreshing
    - Add function to get last refresh time for a user
    
  2. Security
    - Functions are security definer to ensure proper permissions
    - Only authenticated users can execute the functions
*/

-- Create a function to refresh all platform teams for a user
CREATE OR REPLACE FUNCTION refresh_all_platform_teams(user_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the last_synced timestamp for all teams owned by this user
  UPDATE platform_teams
  SET 
    sync_status = 'pending',
    last_synced = now()
  WHERE user_id = user_uuid;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION refresh_all_platform_teams(uuid) TO authenticated;

-- Create a function to get the last refresh time for a user
CREATE OR REPLACE FUNCTION get_last_refresh_time(user_uuid uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  last_refresh timestamptz;
BEGIN
  -- Get the most recent last_synced timestamp for any team owned by this user
  SELECT MAX(last_synced) INTO last_refresh
  FROM platform_teams
  WHERE user_id = user_uuid;
  
  RETURN last_refresh;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_last_refresh_time(uuid) TO authenticated;

-- Create an index to improve performance of the last refresh query
CREATE INDEX IF NOT EXISTS idx_platform_teams_user_id_last_synced 
ON platform_teams(user_id, last_synced DESC);
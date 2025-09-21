/*
  # Fix get_user_timezone RPC function

  1. Function Updates
    - Create or replace the `get_user_timezone` function
    - Fix the SQL query to properly access user_settings.user_id
    - Add proper error handling for missing records
    - Return 'UTC' as default when no timezone is found

  2. Security
    - Function is accessible to authenticated users
    - Uses security definer to ensure proper access
*/

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS get_user_timezone(uuid);

-- Create the corrected get_user_timezone function
CREATE OR REPLACE FUNCTION get_user_timezone(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_timezone text := 'UTC';
BEGIN
    -- Get the timezone from user_settings table
    SELECT COALESCE(timezone, 'UTC')
    INTO user_timezone
    FROM user_settings
    WHERE user_id = p_user_id;
    
    -- If no record found, user_timezone will remain 'UTC'
    IF user_timezone IS NULL THEN
        user_timezone := 'UTC';
    END IF;
    
    RETURN user_timezone;
EXCEPTION
    WHEN OTHERS THEN
        -- Return UTC as fallback for any errors
        RETURN 'UTC';
END;
$$;
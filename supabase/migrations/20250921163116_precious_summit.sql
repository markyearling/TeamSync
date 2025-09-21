/*
  # Create get_user_timezone function

  1. New Functions
    - `get_user_timezone(p_user_id uuid)` - Returns timezone for a given user_id
  
  2. Security
    - Function uses SECURITY DEFINER to bypass RLS
    - Returns NULL if user not found instead of throwing error
*/

-- Create function to get user timezone
CREATE OR REPLACE FUNCTION get_user_timezone(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_timezone text;
BEGIN
  -- Get timezone from user_settings table
  SELECT timezone INTO user_timezone
  FROM user_settings
  WHERE user_id = p_user_id;
  
  -- Return timezone or default to UTC if not found
  RETURN COALESCE(user_timezone, 'UTC');
EXCEPTION
  WHEN OTHERS THEN
    -- Return UTC as fallback if any error occurs
    RETURN 'UTC';
END;
$$;
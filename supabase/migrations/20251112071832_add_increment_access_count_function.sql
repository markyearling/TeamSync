/*
  # Add increment access count function for calendar feed tokens
  
  1. New Functions
    - `increment_access_count` - Safely increments the access_count for a calendar feed token
    
  2. Security
    - Function is SECURITY DEFINER to allow anonymous access
    - Only increments the counter, doesn't expose sensitive data
    - Used by the edge function to track calendar feed usage
    
  3. Notes
    - This replaces the broken RPC call in the edge function
    - Returns void as the caller doesn't need the result
    - Uses atomic increment to avoid race conditions
*/

CREATE OR REPLACE FUNCTION increment_access_count(token_value uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE calendar_feed_tokens
  SET access_count = access_count + 1
  WHERE token = token_value;
END;
$$;
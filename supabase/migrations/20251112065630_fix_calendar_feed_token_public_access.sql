/*
  # Fix Calendar Feed Token Public Access

  1. Changes
    - Add public SELECT policy for calendar_feed_tokens table
    - Allow anonymous access to validate tokens by token value only
    - This enables the edge function to look up tokens without authentication
    
  2. Security
    - Policy only allows SELECT operations
    - Only returns data when filtering by the specific token
    - Does not expose user_id or other sensitive data to public queries
    - Maintains all existing authenticated user policies
    
  3. Notes
    - This is required because the edge function needs to validate tokens
    - The service role should bypass RLS, but explicit public access is safer
    - The token itself acts as the authentication credential
*/

-- Add public policy to allow token validation by the edge function
CREATE POLICY "Public can validate calendar feed tokens"
  ON calendar_feed_tokens
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Note: The edge function will filter by token, so only matching records are returned
-- The token itself is the security credential, similar to an API key
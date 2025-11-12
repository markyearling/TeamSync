/*
  # Create calendar feed tokens table for ICS calendar integration

  1. New Tables
    - `calendar_feed_tokens`
      - `id` (uuid, primary key) - Unique identifier for the token record
      - `user_id` (uuid, references auth.users) - The user who owns this calendar feed
      - `token` (uuid) - Unique token used in the ICS feed URL
      - `created_at` (timestamptz) - When the token was created
      - `last_accessed_at` (timestamptz) - When the feed was last accessed
      - `access_count` (integer) - How many times the feed has been accessed
      
  2. Security
    - Enable RLS on `calendar_feed_tokens` table
    - Users can only view and manage their own calendar feed tokens
    - Public can access feeds via valid tokens (handled in edge function)
    
  3. Indexes
    - Add unique index on token for fast lookups
    - Add index on user_id for efficient user queries
*/

CREATE TABLE IF NOT EXISTS calendar_feed_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  token uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now() NOT NULL,
  last_accessed_at timestamptz,
  access_count integer DEFAULT 0 NOT NULL
);

-- Enable RLS
ALTER TABLE calendar_feed_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own calendar tokens"
  ON calendar_feed_tokens
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own calendar tokens"
  ON calendar_feed_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own calendar tokens"
  ON calendar_feed_tokens
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own calendar tokens"
  ON calendar_feed_tokens
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes
CREATE UNIQUE INDEX IF NOT EXISTS calendar_feed_tokens_token_idx 
  ON calendar_feed_tokens(token);

CREATE INDEX IF NOT EXISTS calendar_feed_tokens_user_id_idx 
  ON calendar_feed_tokens(user_id);

-- Function to get or create calendar token for a user
CREATE OR REPLACE FUNCTION get_or_create_calendar_token(p_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_token uuid;
BEGIN
  -- Check if user already has a token
  SELECT token INTO v_token
  FROM calendar_feed_tokens
  WHERE user_id = p_user_id
  LIMIT 1;
  
  -- If no token exists, create one
  IF v_token IS NULL THEN
    INSERT INTO calendar_feed_tokens (user_id)
    VALUES (p_user_id)
    RETURNING token INTO v_token;
  END IF;
  
  RETURN v_token;
END;
$$;
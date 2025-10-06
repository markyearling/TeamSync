/*
  # Add Active Conversations Tracking
  
  1. New Tables
    - `active_conversations`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users) - User who is viewing the conversation
      - `conversation_id` (uuid, references conversations) - Conversation being viewed
      - `last_active_at` (timestamptz) - Last heartbeat timestamp
      - `device_type` (text) - 'web' or 'mobile'
      - `created_at` (timestamptz) - When user opened the conversation
  
  2. Indexes
    - Index on user_id and conversation_id for fast lookups
    - Index on last_active_at for cleanup operations
  
  3. Security
    - Enable RLS on active_conversations table
    - Users can only insert/update/delete their own active conversation entries
    - Users can read all active conversation entries (needed for notification checks)
  
  4. Functions
    - `is_user_actively_viewing_conversation` - Check if user is actively viewing a conversation
    - `cleanup_stale_active_conversations` - Remove entries older than 5 minutes
  
  5. Notes
    - Active status is considered valid if last_active_at is within the last 2 minutes
    - Cleanup function should be called periodically to prevent database bloat
    - This enables smart notifications that only send when recipient is not actively viewing
*/

-- Create active_conversations table
CREATE TABLE IF NOT EXISTS active_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  last_active_at timestamptz DEFAULT now(),
  device_type text DEFAULT 'web',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, conversation_id)
);

-- Enable RLS
ALTER TABLE active_conversations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can insert their own active conversation status"
  ON active_conversations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own active conversation status"
  ON active_conversations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own active conversation status"
  ON active_conversations
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can read active conversation status"
  ON active_conversations
  FOR SELECT
  TO authenticated
  USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_active_conversations_user_id ON active_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_active_conversations_conversation_id ON active_conversations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_active_conversations_last_active_at ON active_conversations(last_active_at);
CREATE INDEX IF NOT EXISTS idx_active_conversations_user_conversation ON active_conversations(user_id, conversation_id);

-- Function to check if user is actively viewing conversation
-- Returns true if user has been active in the conversation within the last 2 minutes
CREATE OR REPLACE FUNCTION is_user_actively_viewing_conversation(
  p_user_id uuid,
  p_conversation_id uuid
) RETURNS boolean AS $$
DECLARE
  v_last_active timestamptz;
  v_active_threshold interval := interval '2 minutes';
BEGIN
  -- Get the last active timestamp for this user and conversation
  SELECT last_active_at INTO v_last_active
  FROM active_conversations
  WHERE user_id = p_user_id
    AND conversation_id = p_conversation_id;
  
  -- If no record found, user is not actively viewing
  IF v_last_active IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if last active time is within threshold
  RETURN (now() - v_last_active) < v_active_threshold;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup stale active conversation entries
-- Removes entries older than 5 minutes
CREATE OR REPLACE FUNCTION cleanup_stale_active_conversations()
RETURNS integer AS $$
DECLARE
  v_deleted_count integer;
BEGIN
  DELETE FROM active_conversations
  WHERE last_active_at < (now() - interval '5 minutes');
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments
COMMENT ON TABLE active_conversations IS 'Tracks which users are actively viewing which conversations for smart notification delivery';
COMMENT ON FUNCTION is_user_actively_viewing_conversation IS 'Check if user is actively viewing a conversation (active within last 2 minutes)';
COMMENT ON FUNCTION cleanup_stale_active_conversations IS 'Remove stale active conversation entries older than 5 minutes';

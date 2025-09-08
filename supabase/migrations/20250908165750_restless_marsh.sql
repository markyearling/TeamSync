/*
  # Create event_messages table

  1. New Tables
    - `event_messages`
      - `id` (uuid, primary key)
      - `event_id` (uuid, foreign key to events.id)
      - `sender_id` (uuid, foreign key to auth.users.id)
      - `content` (text, message content)
      - `created_at` (timestamp with time zone)
      - `updated_at` (timestamp with time zone)

  2. Security
    - Enable RLS on `event_messages` table
    - Add policy for users to view messages if they can view the associated event
    - Add policy for users to insert messages if they can view the associated event
    - Add policy for users to update their own messages
    - Add policy for users to delete their own messages

  3. Indexes
    - Add index on event_id for efficient message retrieval
    - Add index on sender_id for efficient sender queries
    - Add index on created_at for chronological ordering

  4. Triggers
    - Add trigger to automatically update updated_at timestamp
*/

-- Create the event_messages table
CREATE TABLE IF NOT EXISTS event_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Foreign key constraints
  CONSTRAINT event_messages_event_id_fkey 
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  CONSTRAINT event_messages_sender_id_fkey 
    FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable Row Level Security
ALTER TABLE event_messages ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_event_messages_event_id 
  ON event_messages(event_id);

CREATE INDEX IF NOT EXISTS idx_event_messages_sender_id 
  ON event_messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_event_messages_created_at 
  ON event_messages(created_at DESC);

-- Create composite index for efficient event message queries
CREATE INDEX IF NOT EXISTS idx_event_messages_event_created 
  ON event_messages(event_id, created_at DESC);

-- RLS Policies

-- SELECT Policy: Users can view messages if they can view the associated event
CREATE POLICY "Users can view event messages if they can view the event"
  ON event_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM events 
      WHERE events.id = event_messages.event_id
    )
  );

-- INSERT Policy: Users can insert messages if they can view the associated event
CREATE POLICY "Users can insert event messages if they can view the event"
  ON event_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 
      FROM events 
      WHERE events.id = event_messages.event_id
    )
  );

-- UPDATE Policy: Users can update their own messages
CREATE POLICY "Users can update their own event messages"
  ON event_messages
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

-- DELETE Policy: Users can delete their own messages
CREATE POLICY "Users can delete their own event messages"
  ON event_messages
  FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_event_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_event_messages_updated_at
  BEFORE UPDATE ON event_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_event_messages_updated_at();
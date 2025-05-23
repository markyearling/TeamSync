/*
  # Create events table

  1. New Tables
    - `events`
      - `id` (uuid, primary key)
      - `profile_id` (uuid, references profiles)
      - `title` (text)
      - `description` (text)
      - `start_time` (timestamptz)
      - `end_time` (timestamptz)
      - `location` (text)
      - `sport` (text)
      - `color` (text)
      - `platform` (text)
      - `platform_color` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on events table
    - Add policies for authenticated users to manage their events
*/

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  location text,
  sport text NOT NULL,
  color text NOT NULL,
  platform text NOT NULL DEFAULT 'Manual',
  platform_color text NOT NULL DEFAULT '#64748B',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own events"
  ON events
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = events.profile_id
    AND profiles.user_id = auth.uid()
  ));

-- Create trigger for updated_at
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
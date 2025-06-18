/*
  # Fix RLS for events to allow querying friend profiles

  1. Changes
    - Drop the existing restrictive policy on events table
    - Create separate policies for better control:
      - Allow users to view all events (needed for friends feature)
      - Allow users to insert events only for their own profiles
      - Allow users to update events only for their own profiles
      - Allow users to delete events only for their own profiles

  2. Security
    - Maintains security by only allowing modifications to own profile events
    - Enables viewing of friend events for users with appropriate access
*/

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Users can manage their own events" ON events;

-- Create separate policies for better control
CREATE POLICY "Users can view all events"
  ON events
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert events for their own profiles"
  ON events
  FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = events.profile_id
    AND profiles.user_id = auth.uid()
  ));

CREATE POLICY "Users can update events for their own profiles"
  ON events
  FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = events.profile_id
    AND profiles.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = events.profile_id
    AND profiles.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete events for their own profiles"
  ON events
  FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = events.profile_id
    AND profiles.user_id = auth.uid()
  ));
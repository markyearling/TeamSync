/*
  # Add Event Visibility Feature

  1. Schema Changes
    - Add `visibility` column to `events` table with default 'public'
    - Add check constraint to ensure only 'public' or 'private' values

  2. Security Updates
    - Update RLS policies to enforce visibility rules
    - Private events only visible to owners and administrators
    - Public events visible to all authenticated users with existing access

  3. Notes
    - Default visibility is 'public' to maintain backward compatibility
    - Administrators can see private events of profiles they manage
    - Event owners can always see their own events regardless of visibility
*/

-- Add visibility column to events table
ALTER TABLE events 
ADD COLUMN visibility text DEFAULT 'public' NOT NULL;

-- Add check constraint to ensure only valid visibility values
ALTER TABLE events 
ADD CONSTRAINT events_visibility_check 
CHECK (visibility IN ('public', 'private'));

-- Drop existing RLS policies for events
DROP POLICY IF EXISTS "Users can view all events" ON events;
DROP POLICY IF EXISTS "Users can insert events for their own profiles or as administra" ON events;
DROP POLICY IF EXISTS "Users can update events for their own profiles or as administra" ON events;
DROP POLICY IF EXISTS "Users can delete events for their own profiles or as administra" ON events;

-- Create new RLS policies with visibility enforcement

-- SELECT policy: Users can view events based on visibility and access rights
CREATE POLICY "Users can view events based on visibility and access"
  ON events
  FOR SELECT
  TO authenticated
  USING (
    -- Always allow viewing public events if user has profile access
    (visibility = 'public' AND (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = events.profile_id 
        AND (
          profiles.user_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM friendships
            WHERE friendships.friend_id = auth.uid() 
            AND friendships.user_id = profiles.user_id 
            AND friendships.role IN ('viewer', 'administrator')
          )
        )
      )
    ))
    OR
    -- Allow viewing private events only for owners and administrators
    (visibility = 'private' AND (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = events.profile_id 
        AND (
          profiles.user_id = auth.uid() OR
          EXISTS (
            SELECT 1 FROM friendships
            WHERE friendships.friend_id = auth.uid() 
            AND friendships.user_id = profiles.user_id 
            AND friendships.role = 'administrator'
          )
        )
      )
    ))
  );

-- INSERT policy: Users can insert events for profiles they own or have admin access to
CREATE POLICY "Users can insert events for profiles they manage"
  ON events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = events.profile_id 
      AND (
        profiles.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM friendships
          WHERE friendships.friend_id = auth.uid() 
          AND friendships.user_id = profiles.user_id 
          AND friendships.role = 'administrator'
        )
      )
    )
  );

-- UPDATE policy: Users can update events for profiles they own or have admin access to
CREATE POLICY "Users can update events for profiles they manage"
  ON events
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = events.profile_id 
      AND (
        profiles.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM friendships
          WHERE friendships.friend_id = auth.uid() 
          AND friendships.user_id = profiles.user_id 
          AND friendships.role = 'administrator'
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = events.profile_id 
      AND (
        profiles.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM friendships
          WHERE friendships.friend_id = auth.uid() 
          AND friendships.user_id = profiles.user_id 
          AND friendships.role = 'administrator'
        )
      )
    )
  );

-- DELETE policy: Users can delete events for profiles they own or have admin access to
CREATE POLICY "Users can delete events for profiles they manage"
  ON events
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = events.profile_id 
      AND (
        profiles.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM friendships
          WHERE friendships.friend_id = auth.uid() 
          AND friendships.user_id = profiles.user_id 
          AND friendships.role = 'administrator'
        )
      )
    )
  );
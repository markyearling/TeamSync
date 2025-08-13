/*
  # Add event visibility feature

  1. New Column
    - Add `visibility` column to `events` table with default 'public'
    - Add check constraint to ensure only 'public' or 'private' values

  2. Security Updates
    - Update RLS policy to handle visibility rules
    - Public events: visible to users with profile access
    - Private events: only visible to profile owners and administrators

  3. Notes
    - Existing events will default to 'public' visibility
    - Platform-synced events default to 'public'
*/

-- Add visibility column to events table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'visibility'
  ) THEN
    ALTER TABLE events ADD COLUMN visibility text DEFAULT 'public'::text NOT NULL;
  END IF;
END $$;

-- Add check constraint for visibility values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'events' AND constraint_name = 'events_visibility_check'
  ) THEN
    ALTER TABLE events ADD CONSTRAINT events_visibility_check 
    CHECK (visibility = ANY (ARRAY['public'::text, 'private'::text]));
  END IF;
END $$;

-- Drop existing RLS policy for SELECT operations
DROP POLICY IF EXISTS "Users can view events based on visibility and access" ON events;

-- Create updated RLS policy that handles visibility
CREATE POLICY "Users can view events based on visibility and access" ON events
  FOR SELECT
  TO authenticated
  USING (
    (
      -- Public events: visible to users with profile access (owners + friends with viewer/admin access)
      visibility = 'public'::text AND
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = events.profile_id
        AND (
          profiles.user_id = uid() OR
          EXISTS (
            SELECT 1 FROM friendships
            WHERE friendships.friend_id = uid()
            AND friendships.user_id = profiles.user_id
            AND friendships.role = ANY (ARRAY['viewer'::text, 'administrator'::text])
          )
        )
      )
    ) OR (
      -- Private events: only visible to profile owners and administrators
      visibility = 'private'::text AND
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = events.profile_id
        AND (
          profiles.user_id = uid() OR
          EXISTS (
            SELECT 1 FROM friendships
            WHERE friendships.friend_id = uid()
            AND friendships.user_id = profiles.user_id
            AND friendships.role = 'administrator'::text
          )
        )
      )
    )
  );
/*
  # Add event visibility feature

  1. Schema Changes
    - Add `visibility` column to `events` table with 'public'/'private' constraint
    - Set default value to 'public' for existing events
    - Add index for better query performance

  2. Security Updates
    - Update RLS policy to respect visibility settings
    - Public events: visible to friends with viewer/administrator access
    - Private events: only visible to profile owner and friends with administrator access

  3. Data Migration
    - All existing events will default to 'public' visibility
    - Platform-synced events will continue to be public by default
*/

-- Add visibility column to events table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'visibility'
  ) THEN
    ALTER TABLE events ADD COLUMN visibility text DEFAULT 'public' NOT NULL;
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
    CHECK (visibility IN ('public', 'private'));
  END IF;
END $$;

-- Add index for visibility column for better query performance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'events' AND indexname = 'idx_events_visibility'
  ) THEN
    CREATE INDEX idx_events_visibility ON events(visibility);
  END IF;
END $$;

-- Update the RLS policy to respect visibility settings
DROP POLICY IF EXISTS "Users can view events based on visibility and access" ON events;

CREATE POLICY "Users can view events based on visibility and access" ON events
FOR SELECT TO authenticated
USING (
  (
    -- Public events: visible to profile owner and friends with viewer/administrator access
    visibility = 'public' AND (
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
    )
  ) OR (
    -- Private events: only visible to profile owner and friends with administrator access
    visibility = 'private' AND (
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
  )
);
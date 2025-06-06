/*
  # Add platform_team_id to events table

  1. Changes
    - Add platform_team_id column to events table
    - Add foreign key constraint to platform_teams table
    - Add composite unique constraint for platform events

  2. Security
    - No changes to RLS policies needed
*/

-- Add platform_team_id column if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'events' AND column_name = 'platform_team_id'
  ) THEN
    ALTER TABLE events 
    ADD COLUMN platform_team_id uuid REFERENCES platform_teams(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add composite unique constraint if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'events_platform_platform_team_id_start_time_end_time_key'
  ) THEN
    ALTER TABLE events 
    ADD CONSTRAINT events_platform_platform_team_id_start_time_end_time_key 
    UNIQUE (platform, platform_team_id, start_time, end_time);
  END IF;
END $$;
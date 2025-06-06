/*
  # Add Playmetrics ICS calendar integration

  1. Changes
    - Add ics_url column to platform_teams table
    - Add last_synced column to platform_teams table
    - Add sync_status column to platform_teams table
    
  2. Security
    - Maintain existing RLS policies
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'platform_teams' AND column_name = 'ics_url'
  ) THEN
    ALTER TABLE platform_teams ADD COLUMN ics_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'platform_teams' AND column_name = 'last_synced'
  ) THEN
    ALTER TABLE platform_teams ADD COLUMN last_synced timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'platform_teams' AND column_name = 'sync_status'
  ) THEN
    ALTER TABLE platform_teams ADD COLUMN sync_status text DEFAULT 'pending';
  END IF;
END $$;
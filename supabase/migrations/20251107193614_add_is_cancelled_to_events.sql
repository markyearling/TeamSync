/*
  # Add is_cancelled column to events table

  1. Schema Changes
    - Add `is_cancelled` boolean column to `events` table with default false
    - Add index on `is_cancelled` for query performance
    
  2. Notes
    - Default value is false to maintain backward compatibility
    - Existing events will not be marked as cancelled by default
    - Event sync functions should detect cancelled keywords and set this flag
    - This column enables clear visual indicators for cancelled events in the UI
*/

-- Add is_cancelled column to events table
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'events' AND column_name = 'is_cancelled'
  ) THEN
    ALTER TABLE events 
    ADD COLUMN is_cancelled boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Add index for better query performance when filtering cancelled events
CREATE INDEX IF NOT EXISTS idx_events_is_cancelled ON events(is_cancelled);
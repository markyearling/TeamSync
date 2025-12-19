/*
  # Add all-day event support

  1. Changes
    - Add `all_day` boolean column to `events` table
      - Default: false (existing events are timed events)
      - NOT NULL constraint for data integrity
    - Add index on `all_day` column for query optimization
  
  2. Purpose
    - Support proper display of all-day events (e.g., from SportsEngine)
    - Prevent timezone-related date shifting for all-day events
    - Enable users to create manual all-day events
  
  3. Notes
    - All-day events should be stored with time set to noon UTC (12:00:00)
    - Frontend will display "All Day" instead of times for these events
    - Calendar sync functions will detect and flag all-day events automatically
*/

-- Add all_day column to events table
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS all_day boolean DEFAULT false NOT NULL;

-- Add index for query optimization
CREATE INDEX IF NOT EXISTS idx_events_all_day ON events(all_day);

-- Add comment to document the column
COMMENT ON COLUMN events.all_day IS 'Indicates if this is an all-day event (no specific time). All-day events are stored at noon UTC to avoid timezone boundary issues.';
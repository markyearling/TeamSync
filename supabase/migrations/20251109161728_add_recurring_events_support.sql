/*
  # Add Recurring Events Support

  1. Schema Changes
    - Add `recurring_group_id` (uuid) - Links related recurring events together
    - Add `recurrence_pattern` (text) - Stores frequency type (daily, weekly, biweekly, monthly)
    - Add `recurrence_end_date` (timestamptz) - When the recurring series ends
    - Add `is_recurring` (boolean) - Flag to easily identify recurring events
    - Add `parent_event_id` (uuid) - Tracks the original event in the series

  2. Notes
    - All fields are nullable to maintain backward compatibility with existing events
    - recurring_group_id will be the same for all events in a recurring series
    - parent_event_id references the first event created in the recurring series
    - is_recurring defaults to false for non-recurring events
*/

DO $$
BEGIN
  -- Add recurring_group_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'recurring_group_id'
  ) THEN
    ALTER TABLE events ADD COLUMN recurring_group_id uuid;
  END IF;

  -- Add recurrence_pattern column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'recurrence_pattern'
  ) THEN
    ALTER TABLE events ADD COLUMN recurrence_pattern text;
  END IF;

  -- Add recurrence_end_date column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'recurrence_end_date'
  ) THEN
    ALTER TABLE events ADD COLUMN recurrence_end_date timestamptz;
  END IF;

  -- Add is_recurring column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'is_recurring'
  ) THEN
    ALTER TABLE events ADD COLUMN is_recurring boolean DEFAULT false;
  END IF;

  -- Add parent_event_id column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'parent_event_id'
  ) THEN
    ALTER TABLE events ADD COLUMN parent_event_id uuid REFERENCES events(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Create an index on recurring_group_id for faster queries
CREATE INDEX IF NOT EXISTS idx_events_recurring_group_id ON events(recurring_group_id);

-- Create an index on parent_event_id for faster queries
CREATE INDEX IF NOT EXISTS idx_events_parent_event_id ON events(parent_event_id);

-- Create an index on is_recurring for filtering
CREATE INDEX IF NOT EXISTS idx_events_is_recurring ON events(is_recurring);

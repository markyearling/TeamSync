/*
  # Add Calendar Imports Table for External Calendar Integration

  1. New Tables
    - `calendar_imports`
      - `id` (uuid, primary key) - Unique identifier for the calendar import
      - `user_id` (uuid, foreign key) - References auth.users
      - `profile_id` (uuid, foreign key) - References profiles table
      - `calendar_url` (text) - The ICS feed URL to import from
      - `calendar_name` (text) - User-friendly name for the calendar
      - `last_synced_at` (timestamptz) - When the calendar was last successfully synced
      - `sync_status` (text) - Current sync status: 'pending', 'syncing', 'success', 'error'
      - `error_message` (text) - Error message if sync failed
      - `is_active` (boolean) - Whether automatic syncing is enabled
      - `created_at` (timestamptz) - When the import was created
      - `updated_at` (timestamptz) - When the import was last modified

  2. Changes to Events Table
    - Add `external_source` (text) - Identifies if event is imported ('calendar_import') or manual (null)
    - Add `external_event_id` (text) - Original event ID from the external calendar
    - Add `calendar_import_id` (uuid) - Foreign key to calendar_imports table
    - Add `is_read_only` (boolean) - Whether the event can be edited by users

  3. Security
    - Enable RLS on `calendar_imports` table
    - Add policies for authenticated users to manage their own calendar imports
    - Users can only see calendar imports for their own profiles

  4. Indexes
    - Index on user_id for efficient queries
    - Index on profile_id for filtering by child
    - Index on calendar_import_id in events table for cascading operations
    - Composite index on external_source and external_event_id for duplicate detection
*/

-- Create calendar_imports table
CREATE TABLE IF NOT EXISTS calendar_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  calendar_url text NOT NULL,
  calendar_name text NOT NULL,
  last_synced_at timestamptz DEFAULT NULL,
  sync_status text NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'success', 'error')),
  error_message text DEFAULT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for calendar_imports
CREATE INDEX IF NOT EXISTS idx_calendar_imports_user_id ON calendar_imports(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_imports_profile_id ON calendar_imports(profile_id);
CREATE INDEX IF NOT EXISTS idx_calendar_imports_sync_status ON calendar_imports(sync_status) WHERE is_active = true;

-- Enable RLS on calendar_imports
ALTER TABLE calendar_imports ENABLE ROW LEVEL SECURITY;

-- RLS Policies for calendar_imports
CREATE POLICY "Users can view their own calendar imports"
  ON calendar_imports FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
  );

CREATE POLICY "Users can insert their own calendar imports"
  ON calendar_imports FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = calendar_imports.profile_id
      AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own calendar imports"
  ON calendar_imports FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = calendar_imports.profile_id
      AND profiles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own calendar imports"
  ON calendar_imports FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Add new columns to events table for external calendar support
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'external_source'
  ) THEN
    ALTER TABLE events ADD COLUMN external_source text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'external_event_id'
  ) THEN
    ALTER TABLE events ADD COLUMN external_event_id text DEFAULT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'calendar_import_id'
  ) THEN
    ALTER TABLE events ADD COLUMN calendar_import_id uuid DEFAULT NULL REFERENCES calendar_imports(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'events' AND column_name = 'is_read_only'
  ) THEN
    ALTER TABLE events ADD COLUMN is_read_only boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Add indexes for imported events
CREATE INDEX IF NOT EXISTS idx_events_calendar_import_id ON events(calendar_import_id) WHERE calendar_import_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_events_external_event_id ON events(external_source, external_event_id) WHERE external_source IS NOT NULL;

-- Add comment to document the external_source field values
COMMENT ON COLUMN events.external_source IS 'Source of the event: NULL for manual events, ''calendar_import'' for imported calendar events';
COMMENT ON COLUMN events.external_event_id IS 'Original event UID from the external calendar source';
COMMENT ON COLUMN events.is_read_only IS 'Whether the event can be edited by users (true for imported events)';

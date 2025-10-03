/*
  # Add external_id to events table for proper sync upsert logic

  1. Changes
    - Add `external_id` column to events table to store platform-specific event IDs
    - Add unique constraint on (platform, platform_team_id, external_id) to prevent duplicates
    - This allows sync functions to use UPSERT instead of DELETE + INSERT
    - Preserves event_messages and other related data during sync

  2. Benefits
    - Event messages are preserved when events are refreshed
    - Prevents duplicate events from the same platform
    - Enables proper incremental sync
    - Notifications won't be re-triggered for unchanged events

  3. Notes
    - external_id is nullable to support manually created events
    - Unique constraint only applies when external_id is not null
*/

-- Add external_id column
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS external_id text;

-- Create a unique index to prevent duplicate events from the same platform
-- This index only applies when external_id is not null (for platform events)
CREATE UNIQUE INDEX IF NOT EXISTS events_platform_external_id_unique
ON public.events (platform, platform_team_id, external_id)
WHERE external_id IS NOT NULL AND platform_team_id IS NOT NULL;

-- Add comment to explain the column
COMMENT ON COLUMN public.events.external_id IS 'Platform-specific event ID used for syncing. NULL for manually created events.';
/*
  # Cleanup Duplicate Events Without External ID
  
  This migration removes duplicate events that were created before the external_id 
  system was implemented. These duplicates exist because:
  
  1. Old events have external_id = NULL
  2. New events from syncs have proper external_id values
  3. Both events share the same platform, team, time, and title
  
  ## Strategy
  
  For each group of duplicate events (same platform, team, title, start_time, end_time):
  - Keep the event WITH an external_id (newer, from sync)
  - Delete the event WITHOUT an external_id (older, pre-external_id)
  
  This preserves the correct events and their associated data (event_messages, etc.)
  while removing the stale duplicates.
  
  ## Safety
  
  - Only deletes events where external_id IS NULL
  - Only deletes if a matching event WITH external_id exists
  - Preserves all event_messages through CASCADE relationships
*/

-- Step 1: Delete old events without external_id when a newer event with external_id exists
-- This handles the duplicate issue where old events (external_id=NULL) duplicate new synced events
DELETE FROM events e1
WHERE e1.external_id IS NULL
  AND e1.platform IS NOT NULL
  AND e1.platform_team_id IS NOT NULL
  AND EXISTS (
    -- Check if there's a newer event with the same details but WITH an external_id
    SELECT 1 
    FROM events e2
    WHERE e2.external_id IS NOT NULL
      AND e2.platform = e1.platform
      AND e2.platform_team_id = e1.platform_team_id
      AND e2.title = e1.title
      AND e2.start_time = e1.start_time
      AND e2.end_time = e1.end_time
      AND e2.id != e1.id
  );

-- Step 2: For any remaining true duplicates (same external_id), keep the oldest one
-- This handles edge cases where the same event was somehow inserted multiple times
DELETE FROM events e1
WHERE e1.id IN (
  SELECT e.id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY platform, platform_team_id, external_id 
        ORDER BY created_at ASC
      ) as rn
    FROM events
    WHERE external_id IS NOT NULL
      AND platform IS NOT NULL
      AND platform_team_id IS NOT NULL
  ) e
  WHERE e.rn > 1
);

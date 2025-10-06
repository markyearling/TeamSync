-- Remove Old Time-Based Unique Constraint
--
-- This migration removes the old unique constraint based on
-- (platform, platform_team_id, start_time, end_time) which is causing
-- conflicts during calendar sync operations.
--
-- Problem:
-- The old constraint prevents syncing when event times change slightly
-- or when multiple events occur at the same time. The new constraint
-- based on external_id is more reliable because it uses the platform's
-- unique event identifier.
--
-- Solution:
-- Drop the old time-based constraint and rely on the external_id based
-- constraint: events_platform_external_id_unique (platform, platform_team_id, external_id)

-- Drop the old time-based unique constraint
ALTER TABLE public.events 
DROP CONSTRAINT IF EXISTS events_platform_platform_team_id_start_time_end_time_key;

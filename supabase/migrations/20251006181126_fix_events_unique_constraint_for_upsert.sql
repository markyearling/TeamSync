-- Fix Events Table Unique Constraint for Upsert Operations
--
-- This migration fixes the calendar sync error by replacing the partial unique index
-- with a proper unique constraint that can be used in UPSERT operations.
--
-- The error "there is no unique or exclusion constraint matching the on conflict specification"
-- occurs because PostgreSQL's ON CONFLICT clause cannot use partial indexes with WHERE clauses.
--
-- Changes:
-- 1. Drop the partial unique index that can't be used for UPSERT
-- 2. Add a proper unique constraint on (platform, platform_team_id, external_id)
-- 3. This allows sync functions to use: onConflict: 'platform,platform_team_id,external_id'

-- Drop the partial unique index
DROP INDEX IF EXISTS events_platform_external_id_unique;

-- Add a proper unique constraint that works with ON CONFLICT
-- Note: This constraint allows NULL values, so manually created events
-- (with NULL external_id or platform_team_id) won't cause conflicts
ALTER TABLE public.events 
ADD CONSTRAINT events_platform_external_id_unique 
UNIQUE (platform, platform_team_id, external_id);

/*
  # Fix platform_teams unique constraints

  1. Changes
    - Remove the global unique constraint on (platform, team_id) 
    - Keep the user-specific unique constraint on (user_id, platform, team_id)
    - This allows multiple users to connect to the same team while preventing duplicate connections per user

  2. Security
    - No changes to RLS policies
    - Maintains data integrity at the user level
*/

-- Remove the conflicting global unique constraint
ALTER TABLE platform_teams DROP CONSTRAINT IF EXISTS platform_teams_platform_team_id_key;

-- Ensure the user-specific unique constraint exists
-- (This may already exist from the previous migration, but we'll add it safely)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'platform_teams_user_platform_team_unique' 
    AND table_name = 'platform_teams'
  ) THEN
    ALTER TABLE platform_teams ADD CONSTRAINT platform_teams_user_platform_team_unique UNIQUE (user_id, platform, team_id);
  END IF;
END $$;
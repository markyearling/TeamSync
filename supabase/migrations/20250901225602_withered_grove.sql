/*
  # Add unique constraint for user platform team combinations

  1. Database Changes
    - Add unique constraint on `platform_teams` table for `(user_id, platform, team_id)`
    - This allows multiple users to connect to the same team while preventing duplicate connections per user

  2. Impact
    - Enables proper upsert operations in the frontend
    - Allows multiple users to connect to the same team calendar
    - Prevents users from adding the same team multiple times
*/

-- Add unique constraint to allow each user to have their own record for the same team
ALTER TABLE platform_teams 
ADD CONSTRAINT platform_teams_user_platform_team_unique 
UNIQUE (user_id, platform, team_id);
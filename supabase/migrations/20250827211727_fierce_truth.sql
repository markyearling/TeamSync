/*
  # Add sport_color column to platform_teams table

  1. Schema Changes
    - Add `sport_color` column to `platform_teams` table
    - This will store the user-designated color for each team's sport
    - Defaults to NULL so existing teams can use default sport colors

  2. Notes
    - Existing teams will use default colors from utils/sports.ts
    - New teams or updated teams can have custom colors
    - This enables per-team sport color customization
*/

-- Add sport_color column to platform_teams table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'platform_teams' AND column_name = 'sport_color'
  ) THEN
    ALTER TABLE platform_teams ADD COLUMN sport_color text;
  END IF;
END $$;
/*
  # Add last_dashboard_refresh to user_settings

  1. Changes
    - Add last_dashboard_refresh column to user_settings table
    - This column will store the timestamp of the last successful dashboard refresh
    - Used to display when data was last refreshed on the dashboard

  2. Security
    - No changes to RLS policies needed
    - Uses existing user_settings permissions
*/

-- Add last_dashboard_refresh column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_settings' AND column_name = 'last_dashboard_refresh'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN last_dashboard_refresh timestamptz;
  END IF;
END $$;
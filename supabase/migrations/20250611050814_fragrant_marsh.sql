/*
  # Add TeamSnap token storage to user_settings

  1. Changes
    - Add teamsnap_access_token column to user_settings table
    - Add teamsnap_refresh_token column to user_settings table
  
  2. Security
    - These columns will store encrypted tokens for TeamSnap API access
    - Only accessible by the user who owns the settings record
*/

-- Add TeamSnap token columns to user_settings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'teamsnap_access_token'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN teamsnap_access_token text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'teamsnap_refresh_token'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN teamsnap_refresh_token text;
  END IF;
END $$;
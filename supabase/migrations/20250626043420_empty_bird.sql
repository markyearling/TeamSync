/*
  # Add timezone to user_settings

  1. Changes
    - Add timezone column to user_settings table
    - Set default timezone to 'UTC'
    - Update existing rows to use UTC if timezone is not set
    
  2. Security
    - No changes to RLS policies needed
*/

-- Add timezone column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_settings' AND column_name = 'timezone'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN timezone text DEFAULT 'UTC';
  END IF;
END $$;

-- Update existing rows to use UTC if timezone is not set
UPDATE user_settings
SET timezone = 'UTC'
WHERE timezone IS NULL;
/*
  # Add user profile fields

  1. Changes
    - Add full_name and phone_number columns to user_settings table
    - Add profile_photo_url column to user_settings table
    
  2. Security
    - Maintain existing RLS policies
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_settings' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN full_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_settings' AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN phone_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_settings' AND column_name = 'profile_photo_url'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN profile_photo_url text;
  END IF;
END $$;
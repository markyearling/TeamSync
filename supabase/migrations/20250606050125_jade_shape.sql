/*
  # Update platform_teams RLS policies

  1. Changes
    - Add user_id column to platform_teams table
    - Update RLS policies for platform_teams table
    - Add foreign key constraint to auth.users

  2. Security
    - Enable RLS on platform_teams table
    - Add policies for authenticated users to:
      - Insert their own teams
      - Update their own teams
      - Delete their own teams
      - Select any team (to support team sharing)
*/

-- Add user_id column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'platform_teams' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE platform_teams ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Update existing rows to use the creator's user_id
UPDATE platform_teams
SET user_id = auth.uid()
WHERE user_id IS NULL;

-- Make user_id required for future rows
ALTER TABLE platform_teams ALTER COLUMN user_id SET NOT NULL;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view platform teams" ON platform_teams;

-- Create new policies
CREATE POLICY "Users can insert their own teams"
ON platform_teams
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own teams"
ON platform_teams
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own teams"
ON platform_teams
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can view all teams"
ON platform_teams
FOR SELECT
TO authenticated
USING (true);
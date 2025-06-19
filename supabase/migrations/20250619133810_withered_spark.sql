/*
  # Temporarily modify messages RLS policy for debugging

  1. Changes
    - Drop existing SELECT policy for messages table
    - Create a temporary debug policy that allows all authenticated users to view all messages
    - This is ONLY for debugging purposes and should be reverted after testing

  2. Security
    - WARNING: This policy is insecure and should NOT be used in production
    - After debugging, this should be replaced with a proper policy
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;

-- Create temporary debug policy
CREATE POLICY "DEBUG: Allow all authenticated users to view messages"
  ON messages
  FOR SELECT
  TO authenticated
  USING (true);

-- Log this change for auditing purposes
DO $$
BEGIN
  RAISE NOTICE 'SECURITY ALERT: Temporary debug policy added to messages table. This should be reverted after testing.';
END $$;
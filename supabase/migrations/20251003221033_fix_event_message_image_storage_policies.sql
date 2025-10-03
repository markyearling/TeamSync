/*
  # Fix Event Message Image Storage Policies

  1. Changes
    - Fix the SELECT policy for viewing event message images
    - The policy was incorrectly referencing p.name instead of objects.name
    - Correct the folder path checking logic

  2. Security
    - Maintains the same security model
    - Users can view images if they can view the associated event
*/

-- Drop the incorrect policy
DROP POLICY IF EXISTS "Users can view event message images if they can view the event" ON storage.objects;

-- Recreate with correct logic
CREATE POLICY "Users can view event message images if they can view the event"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'event-message-images' AND
    EXISTS (
      SELECT 1 
      FROM events e
      JOIN profiles p ON p.id = e.profile_id
      WHERE (storage.foldername(name))[1] = e.id::text
      AND (
        p.user_id = auth.uid() OR
        EXISTS (
          SELECT 1 
          FROM friendships f
          WHERE f.user_id = p.user_id
          AND f.friend_id = auth.uid()
          AND f.role IN ('viewer', 'administrator')
        )
      )
    )
  );
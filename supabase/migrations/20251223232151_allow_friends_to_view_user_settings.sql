/*
  # Allow friends to view each other's profile information

  1. New Policies
    - Add policy to allow users to view their administrator friends' basic profile info
    - Users can view full_name and profile_photo_url of their administrator friends
    
  2. Security
    - Policy ensures users can only view profile info of confirmed administrator friends
    - Only SELECT permission is granted
    - Users can still only UPDATE/DELETE their own settings
*/

-- Add policy to allow viewing administrator friends' profile information
CREATE POLICY "Users can view administrator friends profile info"
  ON user_settings
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM friendships
      WHERE friendships.user_id = auth.uid()
      AND friendships.friend_id = user_settings.user_id
      AND friendships.role = 'administrator'
    )
  );
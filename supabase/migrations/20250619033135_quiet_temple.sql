/*
  # Update RLS policies for administrator access

  1. Changes
    - Update events policies to allow administrator friends to manage events
    - Update profile_teams policies to allow administrator friends to manage team mappings
    - Update profile_sports policies to allow administrator friends to manage sports

  2. Security
    - Maintain existing RLS policies for own profiles
    - Add administrator access checks to relevant policies
    - Ensure proper access control for all operations
*/

-- Drop existing events policies
DROP POLICY IF EXISTS "Users can view all events" ON events;
DROP POLICY IF EXISTS "Users can insert events for their own profiles" ON events;
DROP POLICY IF EXISTS "Users can update events for their own profiles" ON events;
DROP POLICY IF EXISTS "Users can delete events for their own profiles" ON events;

-- Create updated events policies with administrator access
CREATE POLICY "Users can view all events"
  ON events
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert events for their own profiles or as administrator"
  ON events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = events.profile_id
      AND (
        -- User owns the profile
        profiles.user_id = auth.uid()
        OR
        -- User has administrator access to the profile's owner
        EXISTS (
          SELECT 1 FROM friendships
          WHERE friendships.friend_id = auth.uid()
          AND friendships.user_id = profiles.user_id
          AND friendships.role = 'administrator'
        )
      )
    )
  );

CREATE POLICY "Users can update events for their own profiles or as administrator"
  ON events
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = events.profile_id
      AND (
        -- User owns the profile
        profiles.user_id = auth.uid()
        OR
        -- User has administrator access to the profile's owner
        EXISTS (
          SELECT 1 FROM friendships
          WHERE friendships.friend_id = auth.uid()
          AND friendships.user_id = profiles.user_id
          AND friendships.role = 'administrator'
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = events.profile_id
      AND (
        -- User owns the profile
        profiles.user_id = auth.uid()
        OR
        -- User has administrator access to the profile's owner
        EXISTS (
          SELECT 1 FROM friendships
          WHERE friendships.friend_id = auth.uid()
          AND friendships.user_id = profiles.user_id
          AND friendships.role = 'administrator'
        )
      )
    )
  );

CREATE POLICY "Users can delete events for their own profiles or as administrator"
  ON events
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = events.profile_id
      AND (
        -- User owns the profile
        profiles.user_id = auth.uid()
        OR
        -- User has administrator access to the profile's owner
        EXISTS (
          SELECT 1 FROM friendships
          WHERE friendships.friend_id = auth.uid()
          AND friendships.user_id = profiles.user_id
          AND friendships.role = 'administrator'
        )
      )
    )
  );

-- Update profile_teams policy
DROP POLICY IF EXISTS "Users can manage their profile teams" ON profile_teams;

CREATE POLICY "Users can manage their profile teams or as administrator"
  ON profile_teams
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = profile_teams.profile_id
      AND (
        -- User owns the profile
        profiles.user_id = auth.uid()
        OR
        -- User has administrator access to the profile's owner
        EXISTS (
          SELECT 1 FROM friendships
          WHERE friendships.friend_id = auth.uid()
          AND friendships.user_id = profiles.user_id
          AND friendships.role = 'administrator'
        )
      )
    )
  );

-- Update profile_sports policy
DROP POLICY IF EXISTS "Users can manage their profile sports" ON profile_sports;

CREATE POLICY "Users can manage their profile sports or as administrator"
  ON profile_sports
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = profile_sports.profile_id
      AND (
        -- User owns the profile
        profiles.user_id = auth.uid()
        OR
        -- User has administrator access to the profile's owner
        EXISTS (
          SELECT 1 FROM friendships
          WHERE friendships.friend_id = auth.uid()
          AND friendships.user_id = profiles.user_id
          AND friendships.role = 'administrator'
        )
      )
    )
  );

-- Update profiles policies for administrator access
DROP POLICY IF EXISTS "Users can update their own profiles" ON profiles;
DROP POLICY IF EXISTS "Users can delete their own profiles" ON profiles;

CREATE POLICY "Users can update their own profiles or as administrator"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM friendships
      WHERE friendships.friend_id = auth.uid()
      AND friendships.user_id = profiles.user_id
      AND friendships.role = 'administrator'
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM friendships
      WHERE friendships.friend_id = auth.uid()
      AND friendships.user_id = profiles.user_id
      AND friendships.role = 'administrator'
    )
  );

CREATE POLICY "Users can delete their own profiles or as administrator"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM friendships
      WHERE friendships.friend_id = auth.uid()
      AND friendships.user_id = profiles.user_id
      AND friendships.role = 'administrator'
    )
  );
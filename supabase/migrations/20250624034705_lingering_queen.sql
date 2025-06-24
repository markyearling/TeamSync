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

-- First, drop all existing policies that might conflict
DO $$
BEGIN
  -- Drop events policies if they exist
  BEGIN
    DROP POLICY IF EXISTS "Users can view all events" ON events;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Users can insert events for their own profiles" ON events;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Users can insert events for their own profiles or as administra" ON events;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Users can update events for their own profiles" ON events;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Users can update events for their own profiles or as administra" ON events;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Users can delete events for their own profiles" ON events;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Users can delete events for their own profiles or as administra" ON events;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;

  -- Drop profile_teams policies if they exist
  BEGIN
    DROP POLICY IF EXISTS "Users can manage their profile teams" ON profile_teams;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Users can manage their profile teams or as administrator" ON profile_teams;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;

  -- Drop profile_sports policies if they exist
  BEGIN
    DROP POLICY IF EXISTS "Users can manage their profile sports" ON profile_sports;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Users can manage their profile sports or as administrator" ON profile_sports;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;

  -- Drop profiles policies if they exist
  BEGIN
    DROP POLICY IF EXISTS "Users can update their own profiles" ON profiles;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Users can update their own profiles or as administrator" ON profiles;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Users can delete their own profiles" ON profiles;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  
  BEGIN
    DROP POLICY IF EXISTS "Users can delete their own profiles or as administrator" ON profiles;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
END $$;

-- Create updated events policies with administrator access
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'events' AND policyname = 'Users can view all events') THEN
    CREATE POLICY "Users can view all events"
      ON events
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'events' AND policyname = 'Users can insert events for their own profiles or as administrator') THEN
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
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'events' AND policyname = 'Users can update events for their own profiles or as administrator') THEN
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
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'events' AND policyname = 'Users can delete events for their own profiles or as administrator') THEN
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
  END IF;
END $$;

-- Update profile_teams policy
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profile_teams' AND policyname = 'Users can manage their profile teams or as administrator') THEN
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
  END IF;
END $$;

-- Update profile_sports policy
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profile_sports' AND policyname = 'Users can manage their profile sports or as administrator') THEN
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
  END IF;
END $$;

-- Update profiles policies for administrator access
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can update their own profiles or as administrator') THEN
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
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'profiles' AND policyname = 'Users can delete their own profiles or as administrator') THEN
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
  END IF;
END $$;
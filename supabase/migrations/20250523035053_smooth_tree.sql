/*
  # Add team mapping tables

  1. New Tables
    - `platform_teams`
      - `id` (uuid, primary key)
      - `platform` (text)
      - `team_id` (text)
      - `team_name` (text)
      - `sport` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `profile_teams`
      - `id` (uuid, primary key)
      - `profile_id` (uuid, references profiles)
      - `platform_team_id` (uuid, references platform_teams)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create platform_teams table
CREATE TABLE IF NOT EXISTS platform_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL,
  team_id text NOT NULL,
  team_name text NOT NULL,
  sport text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (platform, team_id)
);

-- Create profile_teams table
CREATE TABLE IF NOT EXISTS profile_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  platform_team_id uuid REFERENCES platform_teams ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (profile_id, platform_team_id)
);

-- Enable RLS
ALTER TABLE platform_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_teams ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view platform teams"
  ON platform_teams
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can manage their profile teams"
  ON profile_teams
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = profile_teams.profile_id
    AND profiles.user_id = auth.uid()
  ));

-- Create trigger for updated_at
CREATE TRIGGER update_platform_teams_updated_at
  BEFORE UPDATE ON platform_teams
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
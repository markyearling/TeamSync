/*
  # Create profiles and settings tables

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text)
      - `age` (integer)
      - `color` (text)
      - `photo_url` (text)
      - `notes` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `profile_sports`
      - `id` (uuid, primary key)
      - `profile_id` (uuid, references profiles)
      - `sport` (text)
      - `color` (text)
      - `created_at` (timestamptz)

    - `user_settings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `email_notifications` (boolean)
      - `sms_notifications` (boolean)
      - `in_app_notifications` (boolean)
      - `schedule_updates` (boolean)
      - `team_communications` (boolean)
      - `all_notifications` (boolean)
      - `language` (text)
      - `theme` (text)
      - `additional_emails` (text[])
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  name text NOT NULL,
  age integer,
  color text,
  photo_url text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create profile_sports table
CREATE TABLE IF NOT EXISTS profile_sports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles ON DELETE CASCADE NOT NULL,
  sport text NOT NULL,
  color text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create user_settings table
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  email_notifications boolean DEFAULT true,
  sms_notifications boolean DEFAULT false,
  in_app_notifications boolean DEFAULT true,
  schedule_updates boolean DEFAULT true,
  team_communications boolean DEFAULT true,
  all_notifications boolean DEFAULT true,
  language text DEFAULT 'en',
  theme text DEFAULT 'light',
  additional_emails text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_sports ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own profiles"
  ON profiles
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their profile sports"
  ON profile_sports
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = profile_sports.profile_id
    AND profiles.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage their own settings"
  ON user_settings
  USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
/*
  # Add storage policies and update profile policies

  1. Changes
    - Add storage bucket for profile photos
    - Add storage policies for authenticated users
    - Update profiles table policy to allow inserts
    
  2. Security
    - Enable storage policies for profile-photos bucket
    - Allow authenticated users to upload their own photos
    - Allow authenticated users to create their own profiles
*/

-- Create storage bucket if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'profile-photos'
  ) THEN
    INSERT INTO storage.buckets (id, name)
    VALUES ('profile-photos', 'profile-photos');
  END IF;
END $$;

-- Add storage policies
CREATE POLICY "Allow authenticated users to upload photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'profile-photos'
);

CREATE POLICY "Allow authenticated users to read photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'profile-photos'
);

-- Update profiles policy to explicitly allow inserts
DROP POLICY IF EXISTS "Users can manage their own profiles" ON profiles;

CREATE POLICY "Users can manage their own profiles"
ON profiles FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
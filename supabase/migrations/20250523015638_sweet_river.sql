/*
  # Update storage policies for profile photos

  1. Changes
    - Make profile-photos bucket public
    - Add storage policies for photo access
    - Update profile management policies
    
  2. Security
    - Allow public access to profile photos
    - Maintain authenticated user upload restrictions
    - Update profile management permissions
*/

-- Create storage bucket if it doesn't exist and make it public
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'profile-photos'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('profile-photos', 'profile-photos', true);
  ELSE
    UPDATE storage.buckets
    SET public = true
    WHERE id = 'profile-photos';
  END IF;
END $$;

-- Drop existing policies to avoid conflicts
DO $$
BEGIN
  DROP POLICY IF EXISTS "Allow authenticated users to upload photos" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated users to read photos" ON storage.objects;
  DROP POLICY IF EXISTS "Allow public access to photos" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN
    NULL;
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

CREATE POLICY "Allow public access to photos"
ON storage.objects FOR SELECT TO public
USING (
  bucket_id = 'profile-photos'
);

-- Update profiles policy to explicitly allow inserts
DROP POLICY IF EXISTS "Users can manage their own profiles" ON profiles;

CREATE POLICY "Users can manage their own profiles"
ON profiles FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
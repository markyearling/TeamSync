/*
  # Add Image Support to Friend Messages

  1. Changes
    - Add `image_url` column to messages table for storing image URLs
    - Add `has_image` boolean column for efficient filtering
    - Create `message-images` storage bucket for friend message images
    - Add storage policies for authenticated users

  2. Security
    - Bucket is public for reading (images can be viewed)
    - Only authenticated users can upload
    - Users can only upload to their own conversation folders
    - Users can only delete their own uploaded images

  3. Indexes
    - Add index on has_image column for efficient queries
*/

-- Add columns to messages table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE messages ADD COLUMN image_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'has_image'
  ) THEN
    ALTER TABLE messages ADD COLUMN has_image boolean DEFAULT false;
  END IF;
END $$;

-- Add index for messages with images
CREATE INDEX IF NOT EXISTS idx_messages_has_image
  ON messages(has_image)
  WHERE has_image = true;

-- Create storage bucket for friend message images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-images',
  'message-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for message-images bucket

-- Allow authenticated users to upload images to their own conversation folders
CREATE POLICY "Users can upload message images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'message-images' AND
  -- Check if user is participant in the conversation
  (
    SELECT COUNT(*) FROM conversations
    WHERE id::text = (string_to_array(name, '/'))[1]
    AND (participant_1_id = auth.uid() OR participant_2_id = auth.uid())
  ) > 0
);

-- Allow anyone to view message images (public bucket)
CREATE POLICY "Anyone can view message images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'message-images');

-- Allow users to delete their own uploaded images
CREATE POLICY "Users can delete their own message images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'message-images' AND
  -- Check if user is participant in the conversation
  (
    SELECT COUNT(*) FROM conversations
    WHERE id::text = (string_to_array(name, '/'))[1]
    AND (participant_1_id = auth.uid() OR participant_2_id = auth.uid())
  ) > 0
);
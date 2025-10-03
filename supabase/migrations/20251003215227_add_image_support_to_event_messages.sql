/*
  # Add Image Support to Event Messages

  1. Changes
    - Add `image_url` column to store uploaded image URLs from Supabase Storage
    - Add `has_image` boolean column for quick filtering of messages with images
    - Add index on `has_image` for efficient queries
    - Create storage bucket for event message images with proper RLS policies

  2. Security
    - Users can upload images if they can view the associated event
    - Users can view images if they can view the associated event
    - Users can delete their own message images
    - Event owners and administrators can delete any message images in their events

  3. Storage
    - Bucket name: `event-message-images`
    - File path format: `{event_id}/{message_id}/{filename}`
    - Public access: false (requires authentication and event access)
*/

-- Add columns to event_messages table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_messages' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE event_messages ADD COLUMN image_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'event_messages' AND column_name = 'has_image'
  ) THEN
    ALTER TABLE event_messages ADD COLUMN has_image boolean DEFAULT false;
  END IF;
END $$;

-- Add index for messages with images
CREATE INDEX IF NOT EXISTS idx_event_messages_has_image 
  ON event_messages(has_image) 
  WHERE has_image = true;

-- Create storage bucket for event message images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-message-images',
  'event-message-images',
  false,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies

-- Policy: Users can upload images if they can view the associated event
CREATE POLICY "Users can upload event message images if they can view the event"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'event-message-images' AND
    EXISTS (
      SELECT 1 
      FROM event_messages em
      JOIN events e ON e.id = em.event_id
      WHERE em.sender_id = auth.uid()
      AND (storage.foldername(name))[1] = e.id::text
    )
  );

-- Policy: Users can view images if they can view the associated event
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

-- Policy: Users can delete their own message images
CREATE POLICY "Users can delete their own event message images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'event-message-images' AND
    EXISTS (
      SELECT 1 
      FROM event_messages em
      WHERE em.sender_id = auth.uid()
      AND (storage.foldername(name))[2] = em.id::text
    )
  );

-- Policy: Event owners and administrators can delete any message images in their events
CREATE POLICY "Event owners and admins can delete event message images"
  ON storage.objects
  FOR DELETE
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
          AND f.role = 'administrator'
        )
      )
    )
  );
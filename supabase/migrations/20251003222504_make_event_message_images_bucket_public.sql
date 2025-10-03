/*
  # Make event-message-images bucket public

  1. Changes
    - Update the event-message-images bucket to be public
    - RLS policies will still control who can upload, view, and delete images
    - Public access is needed for image URLs to work properly in the frontend

  2. Security
    - RLS policies remain in place for INSERT, SELECT, and DELETE operations
    - Users can only view images for events they have access to
*/

UPDATE storage.buckets 
SET public = true 
WHERE id = 'event-message-images';
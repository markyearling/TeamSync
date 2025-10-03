/*
  # Add event_message notification type

  1. Changes
    - Add 'event_message' to the allowed notification types in the notifications table
    - This allows the system to create notifications for event messages

  2. Security
    - Maintains existing RLS policies
    - No changes to access control
*/

-- Update the check constraint to include 'event_message' type
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY['friend_request'::text, 'schedule_change'::text, 'new_event'::text, 'message'::text, 'event_message'::text]));
/*
  # Fix message notification logic
  
  1. Changes
    - Remove automatic trigger that calls edge function (pg_net not available)
    - Keep the helper function for checking if notification should be sent
    - Application will call edge function directly when sending messages
  
  2. Functions
    - Keep `should_send_message_notification` for application use
    - Remove trigger function
*/

-- Drop the trigger and trigger function
DROP TRIGGER IF EXISTS trigger_send_message_notification ON messages;
DROP FUNCTION IF EXISTS send_message_notification_if_needed();

-- Keep the should_send_message_notification function for application use
-- (already created in previous migration)

COMMENT ON FUNCTION should_send_message_notification IS 'Determines if a message notification should be sent. Call this from application before sending notification.';

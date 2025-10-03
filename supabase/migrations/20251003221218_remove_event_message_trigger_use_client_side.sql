/*
  # Remove Event Message Notification Trigger

  1. Changes
    - Remove the database trigger for event message notifications
    - Notifications will now be sent from the client-side after message insertion
    - This avoids authentication issues with database triggers calling Edge Functions

  2. Reasoning
    - Database triggers cannot reliably access service role keys in Supabase
    - Client-side calls have proper authentication context
    - Cleaner separation of concerns
*/

-- Drop the trigger and function
DROP TRIGGER IF EXISTS trigger_notify_event_message_recipients ON event_messages;
DROP FUNCTION IF EXISTS notify_event_message_recipients();
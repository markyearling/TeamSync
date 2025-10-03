/*
  # Add Event Message Notification Trigger

  1. New Functions
    - `notify_event_message_recipients` - Trigger function that calls the Edge Function to send notifications
      when a new event message is created

  2. Triggers
    - Create AFTER INSERT trigger on event_messages table
    - Calls Edge Function asynchronously to avoid blocking message creation

  3. Behavior
    - Triggers after a new message is inserted into event_messages table
    - Sends notifications to all users with access to the event
    - Includes event owner and friends with viewer or administrator roles
    - Excludes the message sender from receiving notifications
*/

-- Create function to notify event message recipients
CREATE OR REPLACE FUNCTION notify_event_message_recipients()
RETURNS TRIGGER AS $$
DECLARE
  request_id bigint;
  payload json;
BEGIN
  -- Prepare the payload for the Edge Function
  payload := json_build_object(
    'message_id', NEW.id,
    'event_id', NEW.event_id,
    'sender_id', NEW.sender_id,
    'content', NEW.content,
    'image_url', NEW.image_url
  );

  -- Call the Edge Function asynchronously using pg_net
  -- Note: This requires pg_net extension which is available in Supabase
  BEGIN
    SELECT net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/create-event-message-notification',
      headers := json_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      )::jsonb,
      body := payload::jsonb
    ) INTO request_id;

    RAISE LOG 'Event message notification request initiated with ID: %', request_id;
  EXCEPTION WHEN OTHERS THEN
    -- Log error but don't fail the message insert
    RAISE WARNING 'Failed to trigger event message notification: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_notify_event_message_recipients ON event_messages;

-- Create trigger for new event messages
CREATE TRIGGER trigger_notify_event_message_recipients
  AFTER INSERT ON event_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_event_message_recipients();

-- Add comment explaining the trigger
COMMENT ON TRIGGER trigger_notify_event_message_recipients ON event_messages IS
'Sends notifications to all users with access to the event when a new message is posted';

-- Create settings for the function (these will be set by Supabase automatically in production)
-- For local development, these can be set manually
DO $$
BEGIN
  -- These settings are placeholders and will be overridden by environment variables
  PERFORM set_config('app.settings.supabase_url', current_setting('SUPABASE_URL', true), false);
  PERFORM set_config('app.settings.service_role_key', current_setting('SUPABASE_SERVICE_ROLE_KEY', true), false);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not set app settings: %', SQLERRM;
END;
$$;
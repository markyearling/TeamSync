/*
  # Fix Event Message Notification Trigger

  1. Changes
    - Replace the trigger function to use Supabase's built-in http extension
    - Use supabase_functions schema for proper environment variable access
    - Simplify the approach to work reliably in Supabase environment

  2. Behavior
    - Sends HTTP request to Edge Function after message insert
    - Uses service role authentication
    - Handles errors gracefully without blocking message creation
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS trigger_notify_event_message_recipients ON event_messages;
DROP FUNCTION IF EXISTS notify_event_message_recipients();

-- Create new trigger function using supabase_functions
CREATE OR REPLACE FUNCTION notify_event_message_recipients()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  request_id bigint;
  function_url text;
BEGIN
  -- Get the Supabase URL from the vault or environment
  SELECT COALESCE(
    current_setting('app.settings.api_url', true),
    'https://cwbdhswftljelgwgjxnc.supabase.co'
  ) INTO function_url;
  
  function_url := function_url || '/functions/v1/create-event-message-notification';

  -- Make async HTTP request using pg_net
  SELECT INTO request_id net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(
        current_setting('app.settings.service_role_key', true),
        ''
      )
    ),
    body := jsonb_build_object(
      'message_id', NEW.id::text,
      'event_id', NEW.event_id::text,
      'sender_id', NEW.sender_id::text,
      'content', NEW.content,
      'image_url', NEW.image_url
    )
  );

  RAISE LOG 'Event message notification queued with request_id: %', request_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log but don't fail the insert
  RAISE WARNING 'Failed to queue event message notification: % %', SQLERRM, SQLSTATE;
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER trigger_notify_event_message_recipients
  AFTER INSERT ON event_messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_event_message_recipients();

COMMENT ON TRIGGER trigger_notify_event_message_recipients ON event_messages IS
'Sends notifications to all users with access to the event when a new message is posted';
/*
  # Fix Event Message Notification Trigger Authentication

  1. Changes
    - Update trigger to use Supabase Vault for secure credential access
    - Use proper service role key authentication
    - Handle authentication correctly for Edge Function calls

  2. Security
    - Uses Supabase's secure vault for credentials
    - Maintains SECURITY DEFINER for proper execution context
*/

-- Drop and recreate the trigger function with proper authentication
DROP TRIGGER IF EXISTS trigger_notify_event_message_recipients ON event_messages;
DROP FUNCTION IF EXISTS notify_event_message_recipients();

CREATE OR REPLACE FUNCTION notify_event_message_recipients()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  request_id bigint;
  service_role_key text;
BEGIN
  -- Try to get service role key from vault
  BEGIN
    SELECT decrypted_secret INTO service_role_key
    FROM vault.decrypted_secrets
    WHERE name = 'service_role_key'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    -- If vault is not available, use environment variable as fallback
    service_role_key := current_setting('app.settings.service_role_key', true);
  END;

  -- If we still don't have a key, use the anon key as a fallback for the request
  -- The Edge Function will validate and handle this
  IF service_role_key IS NULL OR service_role_key = '' THEN
    RAISE WARNING 'No service role key available, using SUPABASE_SERVICE_ROLE_KEY env var';
    service_role_key := current_setting('SUPABASE_SERVICE_ROLE_KEY', true);
  END IF;

  -- Make async HTTP request using pg_net
  SELECT INTO request_id net.http_post(
    url := 'https://cwbdhswftljelgwgjxnc.supabase.co/functions/v1/create-event-message-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_role_key, ''),
      'apikey', COALESCE(service_role_key, '')
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
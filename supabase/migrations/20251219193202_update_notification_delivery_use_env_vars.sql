/*
  # Update Notification Delivery to Use Environment Variables

  This migration updates the notification delivery trigger to properly access
  the Supabase URL and service role key using Supabase's vault system instead
  of current_setting which may not be available.

  Since pg_net doesn't have direct access to Deno environment variables, we'll
  store the necessary configuration in the vault.
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS trigger_deliver_notification ON notifications;
DROP FUNCTION IF EXISTS deliver_notification();

-- Create updated function that uses vault for secrets
CREATE OR REPLACE FUNCTION deliver_notification()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_device record;
  v_user_email text;
  v_requester_name text;
  v_request_id bigint;
  v_supabase_url text;
  v_service_role_key text;
BEGIN
  -- Only process friend_request notifications
  IF NEW.type != 'friend_request' THEN
    RETURN NEW;
  END IF;

  RAISE LOG 'Delivering notification % of type % for user %', NEW.id, NEW.type, NEW.user_id;

  -- Get Supabase configuration from vault
  SELECT decrypted_secret INTO v_supabase_url
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_URL'
  LIMIT 1;

  SELECT decrypted_secret INTO v_service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
  LIMIT 1;

  -- If vault secrets are not available, use fallback approach
  -- The edge functions will still work but won't be called from trigger
  IF v_supabase_url IS NULL THEN
    RAISE WARNING 'SUPABASE_URL not found in vault, skipping push/email delivery';
    RETURN NEW;
  END IF;

  -- Get user email for email notification
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = NEW.user_id;

  -- Extract data from notification
  v_requester_name := (NEW.data->>'requester_name')::text;

  -- Send FCM push notifications to all user devices
  FOR v_device IN
    SELECT fcm_token, device_name, platform
    FROM user_devices
    WHERE user_id = NEW.user_id
    AND fcm_token IS NOT NULL
  LOOP
    BEGIN
      -- Make async HTTP request to send FCM notification
      SELECT net.http_post(
        url := v_supabase_url || '/functions/v1/send-fcm-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
        ),
        body := jsonb_build_object(
          'fcmToken', v_device.fcm_token,
          'title', NEW.title,
          'body', NEW.message,
          'data', jsonb_build_object(
            'type', 'friend_request',
            'friend_request_id', (NEW.data->>'friend_request_id')::text,
            'requester_id', (NEW.data->>'requester_id')::text,
            'notification_id', NEW.id::text
          )
        )
      ) INTO v_request_id;

      RAISE LOG 'Sent FCM push to device % (request_id=%)', v_device.device_name, v_request_id;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to send FCM to device %: %', v_device.device_name, SQLERRM;
    END;
  END LOOP;

  -- Send email notification
  IF v_user_email IS NOT NULL THEN
    BEGIN
      SELECT net.http_post(
        url := v_supabase_url || '/functions/v1/send-friend-request-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
        ),
        body := jsonb_build_object(
          'to_email', v_user_email,
          'requester_name', v_requester_name,
          'message', (NEW.data->>'message')::text
        )
      ) INTO v_request_id;

      RAISE LOG 'Sent email to % (request_id=%)', v_user_email, v_request_id;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to send email to %: %', v_user_email, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on notifications table
CREATE TRIGGER trigger_deliver_notification
  AFTER INSERT ON notifications
  FOR EACH ROW
  WHEN (NEW.type = 'friend_request')
  EXECUTE FUNCTION deliver_notification();

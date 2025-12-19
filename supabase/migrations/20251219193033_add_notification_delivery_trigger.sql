/*
  # Add Notification Delivery System

  This migration creates a trigger on the notifications table that automatically
  sends push notifications (FCM) and emails when certain notification types are created.

  1. New Functions
    - `deliver_notification()` - Trigger function that sends push and email notifications
      - Sends FCM push notifications to all user devices via edge function
      - Sends email notifications via edge function
      - Only triggers for friend_request type notifications

  2. New Triggers
    - `trigger_deliver_notification` - Fires when notifications are inserted
      - Runs AFTER INSERT on notifications table
      - Calls edge functions asynchronously using pg_net extension

  3. Security
    - Function runs with SECURITY DEFINER to access user data
    - Uses pg_net extension for async HTTP calls to edge functions

  4. Important Notes
    - Requires pg_net extension to be enabled
    - Edge functions must be accessible from the database
    - Failures in delivery don't prevent notification creation
*/

-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create function to deliver notifications via push and email
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
BEGIN
  -- Only process friend_request notifications
  IF NEW.type != 'friend_request' THEN
    RETURN NEW;
  END IF;

  RAISE LOG 'Delivering notification % of type % for user %', NEW.id, NEW.type, NEW.user_id;

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
        url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-fcm-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
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
        url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-friend-request-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
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
DROP TRIGGER IF EXISTS trigger_deliver_notification ON notifications;

CREATE TRIGGER trigger_deliver_notification
  AFTER INSERT ON notifications
  FOR EACH ROW
  WHEN (NEW.type = 'friend_request')
  EXECUTE FUNCTION deliver_notification();

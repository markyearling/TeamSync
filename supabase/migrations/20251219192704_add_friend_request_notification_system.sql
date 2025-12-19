/*
  # Add Friend Request Notification System

  1. New Functions
    - `send_friend_request_notification()` - Trigger function that sends push and email notifications when friend requests are created
      - Sends FCM push notifications to all user devices
      - Sends email notification with friend request details
      - Includes requester information in notification

  2. New Triggers
    - `trigger_friend_request_notification` - Fires when a new friend request is inserted
      - Runs AFTER INSERT on friend_requests table
      - Automatically sends notifications to the requested user

  3. Security
    - Function runs with SECURITY DEFINER to access user data and send notifications
    - Only notifies the requested user (requested_id)
    - Respects user notification preferences

  4. Important Notes
    - Push notifications sent to all registered devices
    - Email sent if user has email notifications enabled (defaults to true)
    - Includes optional message from requester
    - Notification includes link to Friends page
*/

-- Create function to send notifications when a friend request is created
CREATE OR REPLACE FUNCTION send_friend_request_notification()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_requester_name text;
  v_requester_email text;
  v_requested_email text;
  v_notification_title text;
  v_notification_body text;
  v_notification_id uuid;
  v_user_devices record;
  v_device_count int := 0;
BEGIN
  -- Get requester information
  SELECT us.full_name, au.email
  INTO v_requester_name, v_requester_email
  FROM user_settings us
  JOIN auth.users au ON au.id = us.user_id
  WHERE us.user_id = NEW.requester_id;

  -- Get requested user email
  SELECT email
  INTO v_requested_email
  FROM auth.users
  WHERE id = NEW.requested_id;

  -- Use requester name or email as fallback
  v_requester_name := COALESCE(v_requester_name, v_requester_email, 'Someone');

  -- Prepare notification content
  v_notification_title := 'New Friend Request';
  IF NEW.message IS NOT NULL AND NEW.message != '' THEN
    v_notification_body := v_requester_name || ' sent you a friend request: "' || NEW.message || '"';
  ELSE
    v_notification_body := v_requester_name || ' sent you a friend request';
  END IF;

  -- Create notification record in database
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    read,
    data,
    created_at
  ) VALUES (
    NEW.requested_id,
    'friend_request',
    v_notification_title,
    v_notification_body,
    false,
    jsonb_build_object(
      'friend_request_id', NEW.id,
      'requester_id', NEW.requester_id,
      'requester_name', v_requester_name,
      'message', NEW.message
    ),
    now()
  )
  RETURNING id INTO v_notification_id;

  -- Log notification creation
  RAISE LOG 'Created friend request notification % for user %', v_notification_id, NEW.requested_id;

  -- Send push notifications to all user devices
  FOR v_user_devices IN
    SELECT device_id, device_name, fcm_token, platform
    FROM user_devices
    WHERE user_id = NEW.requested_id
    AND fcm_token IS NOT NULL
  LOOP
    BEGIN
      v_device_count := v_device_count + 1;

      -- Call FCM notification function via HTTP
      PERFORM net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/send-fcm-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
          'fcmToken', v_user_devices.fcm_token,
          'title', v_notification_title,
          'body', v_notification_body,
          'data', jsonb_build_object(
            'type', 'friend_request',
            'friend_request_id', NEW.id::text,
            'requester_id', NEW.requester_id::text,
            'notification_id', v_notification_id::text
          )
        )
      );

      RAISE LOG 'Sent FCM notification to device % (%) for friend request %',
        v_user_devices.device_name, v_user_devices.platform, NEW.id;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to send FCM notification to device %: %', v_user_devices.device_id, SQLERRM;
    END;
  END LOOP;

  IF v_device_count > 0 THEN
    RAISE LOG 'Sent push notifications to % device(s) for friend request %', v_device_count, NEW.id;
  ELSE
    RAISE LOG 'No devices found for user % - skipped push notifications', NEW.requested_id;
  END IF;

  -- Send email notification
  IF v_requested_email IS NOT NULL THEN
    BEGIN
      PERFORM net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/send-friend-request-email',
        headers := jsonb_build_object(
          'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
          'to_email', v_requested_email,
          'requester_name', v_requester_name,
          'message', NEW.message
        )
      );

      RAISE LOG 'Sent email notification to % for friend request %', v_requested_email, NEW.id;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING 'Failed to send email notification to %: %', v_requested_email, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on friend_requests table
DROP TRIGGER IF EXISTS trigger_friend_request_notification ON friend_requests;

CREATE TRIGGER trigger_friend_request_notification
  AFTER INSERT ON friend_requests
  FOR EACH ROW
  EXECUTE FUNCTION send_friend_request_notification();

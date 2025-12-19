/*
  # Fix Friend Request Notification System

  This migration fixes the friend request notification trigger to use a more reliable approach.
  Instead of using net.http_post (which requires pg_net extension), we'll create notifications
  in the database and let a separate process handle sending FCM and email notifications.

  1. Drop old trigger and function
  2. Create new simplified trigger that only creates database notifications
  3. FCM and email notifications will be handled by edge functions polling the notifications table

  Note: This is a simpler and more reliable approach that doesn't depend on pg_net extension.
*/

-- Drop old trigger and function if they exist
DROP TRIGGER IF EXISTS trigger_friend_request_notification ON friend_requests;
DROP FUNCTION IF EXISTS send_friend_request_notification();

-- Create simplified function that only creates database notifications
CREATE OR REPLACE FUNCTION create_friend_request_notification()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_requester_name text;
  v_requester_email text;
  v_notification_title text;
  v_notification_body text;
BEGIN
  -- Get requester information
  SELECT us.full_name, au.email
  INTO v_requester_name, v_requester_email
  FROM user_settings us
  JOIN auth.users au ON au.id = us.user_id
  WHERE us.user_id = NEW.requester_id;

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
  -- The edge function will pick this up and send FCM/email notifications
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
  );

  -- Log notification creation
  RAISE LOG 'Created friend request notification for user % from requester %', 
    NEW.requested_id, NEW.requester_id;

  RETURN NEW;
END;
$$;

-- Create trigger on friend_requests table
CREATE TRIGGER trigger_friend_request_notification
  AFTER INSERT ON friend_requests
  FOR EACH ROW
  EXECUTE FUNCTION create_friend_request_notification();

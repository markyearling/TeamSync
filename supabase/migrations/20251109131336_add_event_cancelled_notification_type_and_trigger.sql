/*
  # Add Event Cancellation Notification System

  1. Schema Changes
    - Add 'event_cancelled' to the allowed notification types
    - This enables the system to create notifications when events are cancelled

  2. New Functions
    - `notify_event_cancellation()` - Trigger function that creates notifications when events are marked as cancelled
      - Only triggers for future events (past events are ignored)
      - Creates notification for the profile owner
      - Includes event details in notification message

  3. New Triggers
    - `trigger_event_cancellation_notification` - Fires when is_cancelled changes from false to true
      - Runs AFTER UPDATE on events table
      - Only fires when is_cancelled is explicitly set to true and was previously false

  4. Security
    - Function runs with SECURITY DEFINER to bypass RLS when creating notifications
    - Only notifies the profile owner (user_id from profiles table)
    - Respects existing RLS policies on notifications table

  5. Important Notes
    - Notifications are only created for future events
    - Past events that are marked as cancelled will not generate notifications
    - The trigger only fires on UPDATE operations, not INSERT
    - Includes event_id, profile_id, and event details in notification data for UI display
*/

-- Add 'event_cancelled' to the allowed notification types
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'friend_request'::text, 
    'schedule_change'::text, 
    'new_event'::text, 
    'message'::text, 
    'event_message'::text,
    'event_cancelled'::text
  ]));

-- Create function to notify users when an event is cancelled
CREATE OR REPLACE FUNCTION notify_event_cancellation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id uuid;
  v_profile_name text;
  v_formatted_date text;
  v_formatted_time text;
BEGIN
  -- Only create notification if the event is being newly cancelled
  -- and the event hasn't already happened
  IF NEW.is_cancelled = true 
     AND OLD.is_cancelled = false 
     AND NEW.start_time > now() THEN
    
    -- Get the user_id and profile name from the profiles table
    SELECT p.user_id, p.name
    INTO v_user_id, v_profile_name
    FROM profiles p
    WHERE p.id = NEW.profile_id;
    
    -- Only proceed if we found a valid user
    IF v_user_id IS NOT NULL THEN
      -- Format the date and time for the notification message
      v_formatted_date := to_char(NEW.start_time AT TIME ZONE 'UTC', 'Mon DD, YYYY');
      v_formatted_time := to_char(NEW.start_time AT TIME ZONE 'UTC', 'HH12:MI AM');
      
      -- Create the notification
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        read,
        data,
        created_at
      ) VALUES (
        v_user_id,
        'event_cancelled',
        'Event Cancelled',
        NEW.title || ' on ' || v_formatted_date || ' at ' || v_formatted_time || ' has been cancelled',
        false,
        jsonb_build_object(
          'event_id', NEW.id,
          'profile_id', NEW.profile_id,
          'profile_name', v_profile_name,
          'event_title', NEW.title,
          'start_time', NEW.start_time,
          'location', NEW.location,
          'platform', NEW.platform
        ),
        now()
      );
      
      -- Log for debugging
      RAISE LOG 'Created cancellation notification for event % (user %)', NEW.id, v_user_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on events table to fire when is_cancelled changes to true
DROP TRIGGER IF EXISTS trigger_event_cancellation_notification ON events;

CREATE TRIGGER trigger_event_cancellation_notification
  AFTER UPDATE OF is_cancelled ON events
  FOR EACH ROW
  WHEN (NEW.is_cancelled = true AND OLD.is_cancelled = false)
  EXECUTE FUNCTION notify_event_cancellation();

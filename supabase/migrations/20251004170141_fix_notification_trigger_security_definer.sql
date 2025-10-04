/*
  # Fix notification trigger to run with elevated privileges

  1. Changes
    - Add SECURITY DEFINER to `create_message_notification` function
    - This allows the function to bypass RLS when creating notifications for other users
    - The trigger needs to create notifications for recipients, not just the sender
    
  2. Security
    - The function only creates notifications for legitimate message recipients
    - All validation logic remains in place
    - Only the notification insert bypasses RLS (which is necessary and safe)
*/

CREATE OR REPLACE FUNCTION create_message_notification()
RETURNS TRIGGER 
SECURITY DEFINER -- Run with elevated privileges to bypass RLS
SET search_path = public
AS $$
DECLARE
  v_recipient_id uuid;
  v_sender_name text;
  v_sender_photo text;
  v_recipient_last_read timestamptz;
  v_is_actively_viewing boolean := false;
  v_conversation record;
BEGIN
  -- Get conversation details
  SELECT * INTO v_conversation
  FROM conversations 
  WHERE id = NEW.conversation_id;

  -- Determine recipient
  IF v_conversation.participant_1_id = NEW.sender_id THEN
    v_recipient_id := v_conversation.participant_2_id;
    v_recipient_last_read := v_conversation.participant_2_last_read_at;
  ELSE
    v_recipient_id := v_conversation.participant_1_id;
    v_recipient_last_read := v_conversation.participant_1_last_read_at;
  END IF;

  -- Get sender information
  SELECT full_name, profile_photo_url 
  INTO v_sender_name, v_sender_photo
  FROM user_settings 
  WHERE user_id = NEW.sender_id;

  -- Check if recipient is actively viewing the conversation
  -- If they read within the last 30 seconds, consider them actively viewing
  IF v_recipient_last_read IS NOT NULL AND v_recipient_last_read > (NOW() - INTERVAL '30 seconds') THEN
    v_is_actively_viewing := true;
    RAISE LOG 'Recipient is actively viewing conversation (last read: %), skipping notification', v_recipient_last_read;
  END IF;

  -- Only create notification if recipient is NOT actively viewing
  IF NOT v_is_actively_viewing THEN
    -- Create notification for recipient
    -- SECURITY DEFINER allows this insert to bypass RLS
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      data,
      read
    ) VALUES (
      v_recipient_id,
      'message',
      'New Message',
      COALESCE(v_sender_name, 'Someone') || ': ' || 
      CASE 
        WHEN LENGTH(NEW.content) > 50 THEN SUBSTRING(NEW.content FROM 1 FOR 50) || '...'
        ELSE NEW.content
      END,
      jsonb_build_object(
        'message_id', NEW.id,
        'conversation_id', NEW.conversation_id,
        'sender_id', NEW.sender_id,
        'sender_name', COALESCE(v_sender_name, 'Someone'),
        'sender_photo', v_sender_photo
      ),
      false
    );

    RAISE LOG 'Created notification for recipient % (not actively viewing)', v_recipient_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
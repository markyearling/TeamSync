/*
  # Create message notification trigger

  1. Trigger Function
    - Creates a function that automatically creates notifications when new messages are inserted
    - Only creates notifications for the recipient (not the sender)
    - Includes sender information in the notification

  2. Trigger
    - Fires after INSERT on messages table
    - Calls the notification function for each new message
*/

-- Create function to handle message notifications
CREATE OR REPLACE FUNCTION create_message_notification()
RETURNS TRIGGER AS $$
DECLARE
  recipient_id uuid;
  sender_name text;
  sender_photo text;
BEGIN
  -- Get conversation details to find recipient
  SELECT 
    CASE 
      WHEN participant_1_id = NEW.sender_id THEN participant_2_id
      ELSE participant_1_id
    END INTO recipient_id
  FROM conversations 
  WHERE id = NEW.conversation_id;

  -- Get sender information
  SELECT full_name, profile_photo_url 
  INTO sender_name, sender_photo
  FROM user_settings 
  WHERE user_id = NEW.sender_id;

  -- Create notification for recipient
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    data,
    read
  ) VALUES (
    recipient_id,
    'message',
    'New Message',
    COALESCE(sender_name, 'Someone') || ': ' || 
    CASE 
      WHEN LENGTH(NEW.content) > 50 THEN SUBSTRING(NEW.content FROM 1 FOR 50) || '...'
      ELSE NEW.content
    END,
    jsonb_build_object(
      'message_id', NEW.id,
      'conversation_id', NEW.conversation_id,
      'sender_id', NEW.sender_id,
      'sender_name', COALESCE(sender_name, 'Someone'),
      'sender_photo', sender_photo
    ),
    false
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS message_notification_trigger ON messages;
CREATE TRIGGER message_notification_trigger
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION create_message_notification();
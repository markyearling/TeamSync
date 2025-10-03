/*
  # Add conversation read tracking for smart notifications
  
  1. Schema Changes
    - Add `participant_1_last_read_at` to conversations table (timestamptz)
    - Add `participant_2_last_read_at` to conversations table (timestamptz)
    - These track when each participant last read messages in the conversation
  
  2. Functions
    - Create `should_send_message_notification` function
      - Returns true only if this is the first unread message since the recipient last read
      - Prevents notification spam when sender sends multiple messages
    
    - Create trigger function `send_message_notification_if_needed`
      - Calls edge function to send notification only when needed
  
  3. Security
    - Function uses SECURITY DEFINER to access all conversation data
    - Only sends notifications for legitimate new messages
  
  4. Notes
    - Initialize existing conversations with current timestamp to prevent old messages from triggering notifications
    - Notifications are only sent when transitioning from "all read" to "has unread"
*/

-- Add last_read_at columns for each participant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'participant_1_last_read_at'
  ) THEN
    ALTER TABLE conversations ADD COLUMN participant_1_last_read_at timestamptz DEFAULT now();
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'participant_2_last_read_at'
  ) THEN
    ALTER TABLE conversations ADD COLUMN participant_2_last_read_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Create function to determine if a notification should be sent
CREATE OR REPLACE FUNCTION should_send_message_notification(
  p_conversation_id uuid,
  p_sender_id uuid
) RETURNS boolean AS $$
DECLARE
  v_conversation record;
  v_recipient_last_read timestamptz;
  v_latest_recipient_message timestamptz;
BEGIN
  -- Get conversation details
  SELECT * INTO v_conversation
  FROM conversations
  WHERE id = p_conversation_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Determine recipient's last read timestamp
  IF v_conversation.participant_1_id = p_sender_id THEN
    v_recipient_last_read := v_conversation.participant_2_last_read_at;
  ELSE
    v_recipient_last_read := v_conversation.participant_1_last_read_at;
  END IF;
  
  -- Check if there are any unread messages from sender sent AFTER recipient's last read
  -- If there are existing unread messages, don't send another notification
  SELECT MAX(created_at) INTO v_latest_recipient_message
  FROM messages
  WHERE conversation_id = p_conversation_id
    AND sender_id = p_sender_id
    AND created_at > v_recipient_last_read;
  
  -- Send notification only if this would be the first unread message
  -- (no messages from sender after recipient's last read)
  RETURN v_latest_recipient_message IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger function to send notification
CREATE OR REPLACE FUNCTION send_message_notification_if_needed()
RETURNS TRIGGER AS $$
DECLARE
  v_should_notify boolean;
  v_conversation record;
  v_recipient_id uuid;
BEGIN
  -- Check if we should send a notification
  v_should_notify := should_send_message_notification(NEW.conversation_id, NEW.sender_id);
  
  IF v_should_notify THEN
    -- Get conversation to determine recipient
    SELECT * INTO v_conversation
    FROM conversations
    WHERE id = NEW.conversation_id;
    
    -- Determine recipient
    IF v_conversation.participant_1_id = NEW.sender_id THEN
      v_recipient_id := v_conversation.participant_2_id;
    ELSE
      v_recipient_id := v_conversation.participant_1_id;
    END IF;
    
    -- Call edge function asynchronously (using pg_net if available, otherwise log)
    -- Note: The actual notification sending is handled by the edge function
    -- This just marks that a notification should be sent
    PERFORM net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/create-message-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
      ),
      body := jsonb_build_object(
        'message_id', NEW.id,
        'conversation_id', NEW.conversation_id,
        'sender_id', NEW.sender_id,
        'content', NEW.content
      )
    );
  ELSE
    -- Log that notification was skipped
    RAISE NOTICE 'Skipping notification for message % - recipient has unread messages', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on messages table
DROP TRIGGER IF EXISTS trigger_send_message_notification ON messages;
CREATE TRIGGER trigger_send_message_notification
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION send_message_notification_if_needed();

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_messages_created_at_sender ON messages(conversation_id, sender_id, created_at DESC);

-- Add comment
COMMENT ON FUNCTION should_send_message_notification IS 'Determines if a message notification should be sent based on whether there are already unread messages';
COMMENT ON FUNCTION send_message_notification_if_needed IS 'Trigger function that sends notification only for the first unread message';

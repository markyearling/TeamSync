/*
  # Add trigger to mark messages as read when opening chat

  1. Changes
    - Create a function to mark all messages in a conversation as read
    - This helps ensure the unread message count is accurate
    - Fixes the issue where the chat dropdown shows incorrect unread counts

  2. Security
    - Function is security definer to ensure it runs with proper permissions
    - Only marks messages as read for the specified user
*/

-- Create a function to mark all messages in a conversation as read for a specific user
CREATE OR REPLACE FUNCTION mark_conversation_messages_read(
  conversation_id_param uuid,
  user_id_param uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Mark all messages from other participants as read
  UPDATE messages
  SET read = true
  WHERE 
    conversation_id = conversation_id_param
    AND sender_id != user_id_param
    AND read = false;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION mark_conversation_messages_read(uuid, uuid) TO authenticated;

-- Create an index to improve performance of the read status updates
CREATE INDEX IF NOT EXISTS idx_messages_read_status 
ON messages(conversation_id, sender_id, read);
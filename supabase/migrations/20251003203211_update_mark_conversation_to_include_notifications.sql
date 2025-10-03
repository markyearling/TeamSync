/*
  # Update mark_conversation_messages_read to also mark notifications as read

  1. Changes
    - Update the `mark_conversation_messages_read` function to mark related message notifications as read
    - When a user opens a conversation, all message notifications for that conversation should be marked as read
  
  2. Behavior
    - Marks all unread messages from other participants as read (existing behavior)
    - NEW: Marks all unread message notifications for those messages as read
*/

-- Update the function to also mark notifications as read
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
  
  -- Mark all message notifications for this conversation as read
  UPDATE notifications
  SET read = true
  WHERE 
    user_id = user_id_param
    AND type = 'message'
    AND read = false
    AND (data->>'conversation_id')::uuid = conversation_id_param;
END;
$$;

-- Grant execute permission to authenticated users (already exists but include for completeness)
GRANT EXECUTE ON FUNCTION mark_conversation_messages_read(uuid, uuid) TO authenticated;

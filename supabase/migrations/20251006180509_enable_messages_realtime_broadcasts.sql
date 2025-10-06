/*
  # Enable Real-Time Broadcasts for Messages Table

  ## Summary
  This migration enables proper real-time broadcasting for the messages table by setting REPLICA IDENTITY to FULL.
  This ensures that Supabase real-time subscriptions receive complete change notifications when messages are inserted or updated.

  ## Changes Made
  1. **REPLICA IDENTITY Configuration**
     - Set REPLICA IDENTITY FULL on the `messages` table
     - This allows real-time listeners to receive all column values in change events
     - Required for proper broadcast functionality in Supabase real-time

  ## Why This is Needed
  Without REPLICA IDENTITY FULL, real-time subscriptions may not receive complete data about inserted/updated rows,
  causing messages to not appear immediately in the chat interface. This configuration ensures that all real-time
  listeners receive the full row data when changes occur.

  ## Security Impact
  - No changes to Row Level Security (RLS) policies
  - No changes to permissions or access control
  - This only affects how change notifications are broadcasted to real-time subscribers
*/

-- Enable REPLICA IDENTITY FULL on messages table to ensure real-time broadcasts include all data
ALTER TABLE messages REPLICA IDENTITY FULL;

-- Verify that the conversations table also has proper configuration
-- (it should already work, but we'll ensure it's consistent)
ALTER TABLE conversations REPLICA IDENTITY FULL;

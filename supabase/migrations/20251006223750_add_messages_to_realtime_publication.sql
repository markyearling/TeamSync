/*
  # Add Messages Table to Realtime Publication

  ## Summary
  This migration adds the `messages` table to the `supabase_realtime` publication.
  This is required for ChatModal to receive real-time INSERT/UPDATE events when new messages are sent.

  ## Problem Being Solved
  The ChatModal was not receiving real-time updates when new messages were sent because the `messages` table
  was not included in the Supabase realtime publication. The subscription would show as SUBSCRIBED but
  no INSERT events would fire when messages were added.

  ## Changes Made
  1. **Add messages table to supabase_realtime publication**
     - Enables real-time postgres_changes events for INSERT/UPDATE/DELETE on messages table
     - Allows ChatModal subscriptions to receive immediate updates when messages are sent

  ## Impact
  - ChatModal will now receive real-time updates when messages are sent
  - Users will see new messages appear immediately without needing to refresh
  - No security changes - existing RLS policies still apply
*/

-- Add messages table to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

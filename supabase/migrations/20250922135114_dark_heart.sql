/*
  # Add optimized index for messages queries

  1. New Index
    - `idx_messages_conversation_created_desc` on `messages` table
      - Composite index on `conversation_id` and `created_at DESC`
      - Optimizes queries that filter by conversation and order by creation time

  2. Performance Benefits
    - Faster message loading in chat modals
    - Efficient handling of LIMIT queries with ORDER BY
    - Single index lookup instead of separate filters and sorts
*/

-- Create composite index for efficient message queries
-- This index optimizes queries that filter by conversation_id and order by created_at DESC
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_desc 
ON public.messages (conversation_id, created_at DESC);

-- Add comment explaining the index purpose
COMMENT ON INDEX idx_messages_conversation_created_desc IS 
'Composite index to optimize message queries filtering by conversation_id and ordering by created_at DESC with LIMIT';
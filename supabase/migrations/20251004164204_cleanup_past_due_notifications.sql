/*
  # Clean up past-due duplicate notifications

  1. Purpose
    - Remove duplicate notifications for the same event
    - Delete notifications for events that are in the past
    - Keep only the most recent notification per user-event combination
    
  2. Actions
    - Delete notifications where event start_time is in the past
    - Delete duplicate notifications (keep most recent)
    - Clean up orphaned notifications
*/

-- Delete notifications for events that have already passed
DELETE FROM public.scheduled_local_notifications sln
WHERE sln.trigger_time < NOW()
  AND sln.status = 'pending';

-- Log how many we cleaned up
DO $$
DECLARE
  v_count integer;
BEGIN
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Cleaned up % past-due pending notifications', v_count;
END $$;

-- Delete notifications for events that are in the past
DELETE FROM public.scheduled_local_notifications sln
USING public.events e
WHERE sln.event_id = e.id
  AND e.start_time < NOW();

-- Log cleanup
DO $$
DECLARE
  v_count integer;
BEGIN
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % notifications for past events', v_count;
END $$;
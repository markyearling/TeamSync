/*
  # Fix manage_event_notifications function

  1. Function Updates
    - Fix the `record "user_settings" has no field "user_id"` error
    - Properly declare and use variables for user_id, notification settings, and timezone
    - Use explicit variable names instead of record field access
    - Add proper error handling and logging

  2. Changes Made
    - Declare separate variables: v_user_id, v_notification_lead_time_minutes, v_user_timezone
    - Get user_id from profiles table first
    - Fetch user settings into separate variables
    - Use v_user_id directly in INSERT statement instead of user_settings.user_id
    - Add proper NULL checks and defaults
*/

CREATE OR REPLACE FUNCTION public.manage_event_notifications()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_user_id uuid;
    v_notification_lead_time_minutes integer;
    v_user_timezone text;
    notification_time timestamp with time zone;
BEGIN
    -- Get the user_id associated with the event's profile
    -- This is the user who owns the profile for which the event is being created/updated.
    SELECT p.user_id
    INTO v_user_id
    FROM public.profiles p
    WHERE p.id = NEW.profile_id;

    -- If no user_id found for the profile, or if the profile is not linked to a user,
    -- then we cannot create a notification for them.
    IF v_user_id IS NULL THEN
        RAISE NOTICE 'manage_event_notifications: No user_id found for profile_id %, skipping notification.', NEW.profile_id;
        RETURN NEW;
    END IF;

    -- Get user settings for notification lead time and timezone
    -- These settings are specific to the user (v_user_id)
    SELECT us.notification_lead_time_minutes, us.timezone
    INTO v_notification_lead_time_minutes, v_user_timezone
    FROM public.user_settings us
    WHERE us.user_id = v_user_id;

    -- Default lead time if not found or null in user_settings
    IF v_notification_lead_time_minutes IS NULL THEN
        v_notification_lead_time_minutes := 60; -- Default to 60 minutes
    END IF;

    -- Calculate notification time based on event start time and lead time
    -- Assuming NEW.start_time is in UTC (as per Supabase best practices for timestamp with time zone)
    -- If you need to convert NEW.start_time to the user's timezone before subtracting,
    -- you would use v_user_timezone here with timezone functions.
    -- For now, we subtract directly, assuming NEW.start_time is already consistent.
    notification_time := NEW.start_time - (v_notification_lead_time_minutes || ' minutes')::interval;

    -- Insert or update the scheduled notification for the determined user_id
    INSERT INTO public.scheduled_local_notifications (
        user_id,
        event_id,
        title,
        body,
        trigger_time,
        status
    ) VALUES (
        v_user_id, -- Use the v_user_id obtained from the profiles table
        NEW.id,    -- The ID of the event that triggered this notification
        'Upcoming Event',
        NEW.title || ' starts in ' || v_notification_lead_time_minutes || ' minutes',
        notification_time,
        'pending'
    )
    ON CONFLICT (user_id, event_id) DO UPDATE SET
        title = EXCLUDED.title,
        body = EXCLUDED.body,
        trigger_time = EXCLUDED.trigger_time,
        status = 'pending',
        updated_at = NOW();

    RETURN NEW;
END;
$function$;
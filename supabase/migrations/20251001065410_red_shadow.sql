/*
  # Add debugging logs to manage_event_notifications function

  1. Function Updates
    - Add RAISE LOG statements throughout the manage_event_notifications() function
    - Track function execution flow and variable values
    - Help identify where the notification scheduling is failing

  2. Purpose
    - Debug why scheduled_local_notifications records are not being created
    - Trace the execution path of the trigger function
    - Identify any issues with user_id lookup or notification scheduling logic
*/

CREATE OR REPLACE FUNCTION manage_event_notifications()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id uuid;
    v_notification_lead_time_minutes integer;
    v_user_timezone text;
    notification_time timestamp with time zone;
BEGIN
    RAISE LOG 'manage_event_notifications: Trigger fired for event ID: %, profile ID: %', NEW.id, NEW.profile_id;

    -- Get the user_id associated with the event's profile
    SELECT p.user_id
    INTO v_user_id
    FROM public.profiles p
    WHERE p.id = NEW.profile_id;

    RAISE LOG 'manage_event_notifications: Fetched v_user_id: % for profile_id %', v_user_id, NEW.profile_id;

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

    RAISE LOG 'manage_event_notifications: Fetched user settings for user %: lead_time=%, timezone=%', v_user_id, v_notification_lead_time_minutes, v_user_timezone;

    -- Default lead time if not found or null in user_settings
    IF v_notification_lead_time_minutes IS NULL THEN
        v_notification_lead_time_minutes := 60; -- Default to 60 minutes
        RAISE LOG 'manage_event_notifications: Using default lead time: % minutes', v_notification_lead_time_minutes;
    END IF;

    -- Calculate notification time based on event start time and lead time
    notification_time := NEW.start_time - (v_notification_lead_time_minutes || ' minutes')::interval;

    RAISE LOG 'manage_event_notifications: Calculated notification_time: % for event start_time: %', notification_time, NEW.start_time;

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

    RAISE LOG 'manage_event_notifications: Successfully inserted/updated scheduled_local_notifications for event ID: %', NEW.id;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE LOG 'manage_event_notifications: Exception occurred: %', SQLERRM;
        RAISE NOTICE 'manage_event_notifications: Exception occurred: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;
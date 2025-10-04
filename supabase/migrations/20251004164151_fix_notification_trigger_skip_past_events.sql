/*
  # Fix notification trigger to prevent spam and skip past events

  1. Changes
    - Skip notification creation/update for events in the past
    - Only create notifications if trigger_time is in the future
    - Better logic to detect actual changes in event times
    - Don't process DELETE operations (let cascade handle cleanup)
    
  2. Logic
    - Check if event start_time is in the past → skip
    - Check if notification trigger_time would be in the past → skip
    - On UPDATE: Only process if start_time actually changed
    - On INSERT: Only create if event is in the future
    
  3. Benefits
    - No notifications for past events
    - No spam on refresh
    - Cleaner notification management
*/

CREATE OR REPLACE FUNCTION manage_event_notifications()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id uuid;
    v_notification_lead_time_minutes integer;
    v_user_timezone text;
    notification_time timestamp with time zone;
    v_existing_trigger_time timestamp with time zone;
    v_should_update_notification boolean := false;
    v_current_time timestamp with time zone;
BEGIN
    -- Skip DELETE operations entirely (cascade will clean up notifications)
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    v_current_time := NOW();

    RAISE LOG 'manage_event_notifications: Trigger fired for event ID: %, profile ID: %, operation: %', NEW.id, NEW.profile_id, TG_OP;

    -- Skip if event is in the past (no need to notify about past events)
    IF NEW.start_time < v_current_time THEN
        RAISE LOG 'manage_event_notifications: Event start_time % is in the past, skipping', NEW.start_time;
        RETURN NEW;
    END IF;

    -- Get the user_id associated with the event's profile
    SELECT p.user_id
    INTO v_user_id
    FROM public.profiles p
    WHERE p.id = NEW.profile_id;

    RAISE LOG 'manage_event_notifications: Fetched v_user_id: % for profile_id %', v_user_id, NEW.profile_id;

    -- If no user_id found for the profile, skip notification
    IF v_user_id IS NULL THEN
        RAISE NOTICE 'manage_event_notifications: No user_id found for profile_id %, skipping notification.', NEW.profile_id;
        RETURN NEW;
    END IF;

    -- Get user settings for notification lead time and timezone
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

    -- Skip if notification time would be in the past
    IF notification_time < v_current_time THEN
        RAISE LOG 'manage_event_notifications: Notification time % is in the past, skipping', notification_time;
        RETURN NEW;
    END IF;

    -- Determine if we should update the notification
    IF TG_OP = 'INSERT' THEN
        -- Check if notification already exists (could be from a previous sync)
        SELECT trigger_time INTO v_existing_trigger_time
        FROM public.scheduled_local_notifications
        WHERE user_id = v_user_id AND event_id = NEW.id;
        
        IF v_existing_trigger_time IS NULL THEN
            -- No existing notification, create one
            v_should_update_notification := true;
            RAISE LOG 'manage_event_notifications: INSERT operation - will create notification';
        ELSE
            -- Notification exists, don't recreate
            v_should_update_notification := false;
            RAISE LOG 'manage_event_notifications: INSERT operation - notification already exists, skipping';
        END IF;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Only update if start_time changed
        IF OLD.start_time <> NEW.start_time THEN
            v_should_update_notification := true;
            RAISE LOG 'manage_event_notifications: UPDATE operation - start_time changed from % to %', OLD.start_time, NEW.start_time;
        ELSE
            -- Check if notification exists
            SELECT trigger_time INTO v_existing_trigger_time
            FROM public.scheduled_local_notifications
            WHERE user_id = v_user_id AND event_id = NEW.id;
            
            IF v_existing_trigger_time IS NULL THEN
                -- No notification exists, create one (edge case)
                v_should_update_notification := true;
                RAISE LOG 'manage_event_notifications: UPDATE operation - no existing notification, will create';
            ELSE
                -- Notification exists and time hasn't changed, skip update
                v_should_update_notification := false;
                RAISE LOG 'manage_event_notifications: UPDATE operation - start_time unchanged and notification exists, skipping';
            END IF;
        END IF;
    END IF;

    -- Insert or update the scheduled notification only if needed
    IF v_should_update_notification THEN
        INSERT INTO public.scheduled_local_notifications (
            user_id,
            event_id,
            title,
            body,
            trigger_time,
            status
        ) VALUES (
            v_user_id,
            NEW.id,
            'Upcoming Event',
            NEW.title || ' starts in ' || v_notification_lead_time_minutes || ' minutes',
            notification_time,
            'pending'
        )
        ON CONFLICT (user_id, event_id) DO UPDATE SET
            title = EXCLUDED.title,
            body = EXCLUDED.body,
            trigger_time = EXCLUDED.trigger_time,
            status = CASE 
                -- Only reset to pending if trigger time changed
                WHEN scheduled_local_notifications.trigger_time <> EXCLUDED.trigger_time THEN 'pending'
                ELSE scheduled_local_notifications.status
            END,
            updated_at = NOW();

        RAISE LOG 'manage_event_notifications: Successfully inserted/updated scheduled_local_notifications for event ID: %', NEW.id;
    END IF;

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE LOG 'manage_event_notifications: Exception occurred: %', SQLERRM;
        RAISE NOTICE 'manage_event_notifications: Exception occurred: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql;
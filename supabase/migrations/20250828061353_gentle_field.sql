/*
  # Add notification lead time setting

  1. New Columns
    - `notification_lead_time_minutes` (integer, default 60)
      - Controls how many minutes before an event the user receives a notification
      - Default is 60 minutes (1 hour)

  2. Function Updates
    - Update `manage_event_notifications()` function to use the user's custom lead time
    - Replace hardcoded 1 hour interval with dynamic calculation based on user preference

  3. Changes
    - Modified user_settings table to include notification timing preference
    - Updated notification scheduling logic to respect user's preferred lead time
*/

-- Add notification lead time column to user_settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'notification_lead_time_minutes'
  ) THEN
    ALTER TABLE public.user_settings ADD COLUMN notification_lead_time_minutes integer DEFAULT 60;
  END IF;
END $$;

-- Update the manage_event_notifications function to use user's custom lead time
CREATE OR REPLACE FUNCTION public.manage_event_notifications()
RETURNS TRIGGER AS $$
DECLARE
    notification_time_calc timestamp with time zone;
    user_settings_record public.user_settings;
    profile_user_id uuid;
    lead_time_minutes integer;
BEGIN
    -- Get the user_id associated with the profile
    SELECT user_id INTO profile_user_id FROM public.profiles WHERE id = COALESCE(NEW.profile_id, OLD.profile_id);

    -- Get user settings for notification preferences
    SELECT * INTO user_settings_record FROM public.user_settings WHERE user_id = profile_user_id;

    IF TG_OP = 'DELETE' THEN
        -- Mark notification as cancelled when event is deleted
        UPDATE public.scheduled_local_notifications
        SET status = 'cancelled', updated_at = now()
        WHERE event_id = OLD.id;
        RETURN OLD;
    ELSIF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Get lead time from user settings, default to 60 minutes if not set
        lead_time_minutes := COALESCE(user_settings_record.notification_lead_time_minutes, 60);
        
        -- Calculate notification time using user's preferred lead time
        notification_time_calc := NEW.start_time - (lead_time_minutes || ' minutes')::interval;

        -- Only create/update if schedule_updates is enabled and notification time is in the future
        IF COALESCE(user_settings_record.schedule_updates, true) IS TRUE AND notification_time_calc > now() THEN
            INSERT INTO public.scheduled_local_notifications (user_id, event_id, title, body, trigger_time, status)
            VALUES (
                profile_user_id,
                NEW.id,
                NEW.title,
                'Your event "' || NEW.title || '" is starting soon at ' || to_char(NEW.start_time, 'HH:MI AM') || ' on ' || to_char(NEW.start_time, 'Mon DD'),
                notification_time_calc,
                'pending'
            )
            ON CONFLICT (user_id, event_id) DO UPDATE SET
                title = EXCLUDED.title,
                body = EXCLUDED.body,
                trigger_time = EXCLUDED.trigger_time,
                status = 'pending', -- Reset to pending if event updated
                updated_at = now();
        ELSE
            -- If schedule_updates is false or notification time is in the past, cancel any existing notification
            UPDATE public.scheduled_local_notifications
            SET status = 'cancelled', updated_at = now()
            WHERE event_id = NEW.id;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
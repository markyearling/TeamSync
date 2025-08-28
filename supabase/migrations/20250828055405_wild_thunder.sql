/*
  # Create scheduled local notifications system

  1. New Tables
    - `scheduled_local_notifications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `event_id` (uuid, references events)
      - `title` (text)
      - `body` (text)
      - `trigger_time` (timestamptz)
      - `status` (text, enum: pending/scheduled/cancelled/sent)
      - `local_notification_id` (integer, Capacitor notification ID)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Functions
    - `manage_event_notifications()` - Automatically manages notifications when events change

  3. Triggers
    - `trg_manage_event_notifications` - Triggers notification management on event changes

  4. Security
    - Enable RLS on `scheduled_local_notifications` table
    - Add policy for users to manage their own notifications
*/

-- Create the scheduled_local_notifications table
CREATE TABLE IF NOT EXISTS public.scheduled_local_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    title text NOT NULL,
    body text NOT NULL,
    trigger_time timestamp with time zone NOT NULL,
    status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'scheduled', 'cancelled', 'sent')),
    local_notification_id integer, -- ID assigned by Capacitor's LocalNotifications.schedule()
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE (user_id, event_id) -- Ensure only one notification per user per event
);

-- Enable RLS
ALTER TABLE public.scheduled_local_notifications ENABLE ROW LEVEL SECURITY;

-- Create RLS policy
CREATE POLICY "Users can manage their own scheduled notifications" 
ON public.scheduled_local_notifications
FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_user_status 
ON public.scheduled_local_notifications (user_id, status);

CREATE INDEX IF NOT EXISTS idx_scheduled_notifications_trigger_time 
ON public.scheduled_local_notifications (trigger_time);

-- Create the manage_event_notifications function
CREATE OR REPLACE FUNCTION public.manage_event_notifications()
RETURNS TRIGGER AS $$
DECLARE
    notification_time_calc timestamp with time zone;
    user_settings_record public.user_settings;
    profile_user_id uuid;
    event_time_formatted text;
    event_date_formatted text;
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
        -- Calculate notification time (1 hour before event start)
        notification_time_calc := NEW.start_time - INTERVAL '1 hour';

        -- Format event time and date for notification body
        event_time_formatted := to_char(NEW.start_time AT TIME ZONE COALESCE(user_settings_record.timezone, 'UTC'), 'HH12:MI AM');
        event_date_formatted := to_char(NEW.start_time AT TIME ZONE COALESCE(user_settings_record.timezone, 'UTC'), 'Mon DD');

        -- Only create/update if schedule_updates is enabled and notification time is in the future
        IF user_settings_record.schedule_updates IS TRUE AND notification_time_calc > now() THEN
            INSERT INTO public.scheduled_local_notifications (user_id, event_id, title, body, trigger_time, status)
            VALUES (
                profile_user_id,
                NEW.id,
                NEW.title,
                'Your event "' || NEW.title || '" starts at ' || event_time_formatted || ' on ' || event_date_formatted,
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

-- Create the trigger on the events table
DROP TRIGGER IF EXISTS trg_manage_event_notifications ON public.events;
CREATE TRIGGER trg_manage_event_notifications
AFTER INSERT OR UPDATE OR DELETE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.manage_event_notifications();

-- Create updated_at trigger for scheduled_local_notifications
CREATE TRIGGER update_scheduled_local_notifications_updated_at
BEFORE UPDATE ON public.scheduled_local_notifications
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
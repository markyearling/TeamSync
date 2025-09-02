/*
  # Fix notification timezone formatting

  1. Updated Functions
    - `manage_event_notifications` - Now formats event times using user's timezone setting
  
  2. Changes Made
    - Retrieve user's timezone from user_settings table via profile relationship
    - Convert event start_time and end_time to user's local timezone
    - Format times as readable strings (e.g., "4:00 PM") in notification messages
    - Use fallback timezone of 'UTC' if user timezone not found
  
  3. Security
    - No changes to RLS policies
    - Function maintains existing trigger behavior
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS manage_event_notifications();

-- Create the updated function with timezone-aware formatting
CREATE OR REPLACE FUNCTION manage_event_notifications()
RETURNS TRIGGER AS $$
DECLARE
    user_timezone TEXT := 'UTC';
    formatted_start_time TEXT;
    formatted_end_time TEXT;
    notification_title TEXT;
    notification_body TEXT;
    lead_time_minutes INTEGER := 60;
    trigger_time TIMESTAMPTZ;
    profile_user_id UUID;
BEGIN
    -- Get the user_id from the profile
    SELECT user_id INTO profile_user_id
    FROM profiles 
    WHERE id = NEW.profile_id;
    
    IF profile_user_id IS NULL THEN
        RAISE WARNING 'Could not find user_id for profile_id: %', NEW.profile_id;
        RETURN NEW;
    END IF;

    -- Get user's timezone and notification preferences
    SELECT 
        COALESCE(timezone, 'UTC'),
        COALESCE(notification_lead_time_minutes, 60)
    INTO 
        user_timezone,
        lead_time_minutes
    FROM user_settings 
    WHERE user_id = profile_user_id;
    
    -- If no user settings found, use defaults
    IF user_timezone IS NULL THEN
        user_timezone := 'UTC';
    END IF;
    
    -- Convert event times to user's timezone and format them
    formatted_start_time := to_char(
        NEW.start_time AT TIME ZONE user_timezone, 
        'Day, Mon DD at HH12:MI AM'
    );
    
    formatted_end_time := to_char(
        NEW.end_time AT TIME ZONE user_timezone, 
        'HH12:MI AM'
    );
    
    -- Calculate trigger time (lead_time_minutes before event start)
    trigger_time := NEW.start_time - (lead_time_minutes || ' minutes')::INTERVAL;
    
    -- Only create notifications for future events
    IF trigger_time <= NOW() THEN
        RETURN NEW;
    END IF;
    
    -- Create notification title and body
    notification_title := NEW.title || ' Reminder';
    notification_body := NEW.title || ' starts at ' || formatted_start_time;
    
    -- Add location if available
    IF NEW.location_name IS NOT NULL AND NEW.location_name != '' THEN
        notification_body := notification_body || ' at ' || NEW.location_name;
    ELSIF NEW.location IS NOT NULL AND NEW.location != '' THEN
        notification_body := notification_body || ' at ' || NEW.location;
    END IF;

    IF TG_OP = 'INSERT' THEN
        -- Create notification for new event
        INSERT INTO scheduled_local_notifications (
            user_id,
            event_id,
            title,
            body,
            trigger_time,
            status
        ) VALUES (
            profile_user_id,
            NEW.id,
            notification_title,
            notification_body,
            trigger_time,
            'pending'
        )
        ON CONFLICT (user_id, event_id) DO UPDATE SET
            title = EXCLUDED.title,
            body = EXCLUDED.body,
            trigger_time = EXCLUDED.trigger_time,
            status = 'pending',
            updated_at = NOW();
            
    ELSIF TG_OP = 'UPDATE' THEN
        -- Update existing notification if event details changed
        UPDATE scheduled_local_notifications 
        SET 
            title = notification_title,
            body = notification_body,
            trigger_time = trigger_time,
            status = 'pending',
            updated_at = NOW()
        WHERE user_id = profile_user_id 
        AND event_id = NEW.id;
        
    ELSIF TG_OP = 'DELETE' THEN
        -- Cancel notification for deleted event
        UPDATE scheduled_local_notifications 
        SET 
            status = 'cancelled',
            updated_at = NOW()
        WHERE user_id = profile_user_id 
        AND event_id = OLD.id;
        
        RETURN OLD;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
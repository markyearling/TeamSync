/*
  # Fix ambiguous trigger_time column reference

  1. Database Functions
    - Update `manage_event_notifications` function to properly alias table references
    - Fix ambiguous `trigger_time` column reference when working with events and scheduled_local_notifications tables

  2. Changes
    - Add proper table aliases in the function to disambiguate column references
    - Ensure the function can properly handle event updates without SQL ambiguity errors
*/

CREATE OR REPLACE FUNCTION manage_event_notifications()
RETURNS TRIGGER AS $$
DECLARE
    notification_time timestamptz;
    user_lead_time integer;
BEGIN
    -- Get user's notification lead time preference
    SELECT notification_lead_time_minutes INTO user_lead_time
    FROM user_settings us
    JOIN profiles p ON p.user_id = us.user_id
    WHERE p.id = COALESCE(NEW.profile_id, OLD.profile_id);
    
    -- Default to 60 minutes if not set
    user_lead_time := COALESCE(user_lead_time, 60);
    
    IF TG_OP = 'INSERT' THEN
        -- Calculate notification time
        notification_time := NEW.start_time - (user_lead_time || ' minutes')::interval;
        
        -- Only create notification if it's in the future
        IF notification_time > now() THEN
            INSERT INTO scheduled_local_notifications (
                user_id,
                event_id,
                title,
                body,
                trigger_time,
                status
            )
            SELECT 
                p.user_id,
                NEW.id,
                'Upcoming Event: ' || NEW.title,
                CASE 
                    WHEN NEW.location IS NOT NULL THEN 
                        NEW.title || ' starts in ' || user_lead_time || ' minutes at ' || NEW.location
                    ELSE 
                        NEW.title || ' starts in ' || user_lead_time || ' minutes'
                END,
                notification_time,
                'pending'
            FROM profiles p
            WHERE p.id = NEW.profile_id;
        END IF;
        
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Delete existing notification for this event
        DELETE FROM scheduled_local_notifications sln
        WHERE sln.event_id = NEW.id;
        
        -- Calculate new notification time
        notification_time := NEW.start_time - (user_lead_time || ' minutes')::interval;
        
        -- Only create new notification if it's in the future
        IF notification_time > now() THEN
            INSERT INTO scheduled_local_notifications (
                user_id,
                event_id,
                title,
                body,
                trigger_time,
                status
            )
            SELECT 
                p.user_id,
                NEW.id,
                'Upcoming Event: ' || NEW.title,
                CASE 
                    WHEN NEW.location IS NOT NULL THEN 
                        NEW.title || ' starts in ' || user_lead_time || ' minutes at ' || NEW.location
                    ELSE 
                        NEW.title || ' starts in ' || user_lead_time || ' minutes'
                END,
                notification_time,
                'pending'
            FROM profiles p
            WHERE p.id = NEW.profile_id;
        END IF;
        
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        -- Delete notification for deleted event
        DELETE FROM scheduled_local_notifications sln
        WHERE sln.event_id = OLD.id;
        
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
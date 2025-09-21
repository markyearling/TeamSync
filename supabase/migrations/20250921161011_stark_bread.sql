/*
  # Fix ambiguous event_id column reference in trigger

  1. Database Changes
    - Drop and recreate the manage_event_notifications function to use NEW.id and OLD.id instead of event_id
    - This fixes the ambiguous column reference error when deleting events

  2. Security
    - No changes to RLS policies
    - Maintains existing trigger functionality

  3. Notes
    - The trigger was referencing event_id which doesn't exist (primary key is id)
    - This was causing DELETE operations to fail with ambiguous column reference
*/

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS trg_manage_event_notifications ON events;

-- Drop the existing function
DROP FUNCTION IF EXISTS manage_event_notifications();

-- Recreate the function with correct column references
CREATE OR REPLACE FUNCTION manage_event_notifications()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle INSERT (new event created)
  IF TG_OP = 'INSERT' THEN
    -- Get user's notification settings
    DECLARE
      user_settings RECORD;
      notification_time TIMESTAMPTZ;
      lead_time_minutes INTEGER;
    BEGIN
      -- Get the user_id from the profile
      SELECT p.user_id INTO user_settings
      FROM profiles p
      WHERE p.id = NEW.profile_id;
      
      IF user_settings.user_id IS NOT NULL THEN
        -- Get user's notification preferences
        SELECT 
          schedule_updates,
          notification_lead_time_minutes
        INTO user_settings
        FROM user_settings us
        WHERE us.user_id = user_settings.user_id;
        
        -- Only create notification if user has schedule updates enabled
        IF user_settings.schedule_updates = true THEN
          lead_time_minutes := COALESCE(user_settings.notification_lead_time_minutes, 60);
          notification_time := NEW.start_time - (lead_time_minutes || ' minutes')::INTERVAL;
          
          -- Only schedule if notification time is in the future
          IF notification_time > NOW() THEN
            INSERT INTO scheduled_local_notifications (
              user_id,
              event_id,
              title,
              body,
              trigger_time,
              status
            ) VALUES (
              user_settings.user_id,
              NEW.id,  -- Use NEW.id instead of event_id
              'Upcoming Event',
              NEW.title || ' starts in ' || lead_time_minutes || ' minutes',
              notification_time,
              'pending'
            )
            ON CONFLICT (user_id, event_id) DO UPDATE SET
              title = EXCLUDED.title,
              body = EXCLUDED.body,
              trigger_time = EXCLUDED.trigger_time,
              status = 'pending',
              updated_at = NOW();
          END IF;
        END IF;
      END IF;
    END;
    
    RETURN NEW;
  END IF;
  
  -- Handle UPDATE (event modified)
  IF TG_OP = 'UPDATE' THEN
    -- Update existing notification if it exists
    DECLARE
      user_settings RECORD;
      notification_time TIMESTAMPTZ;
      lead_time_minutes INTEGER;
    BEGIN
      -- Get the user_id from the profile
      SELECT p.user_id INTO user_settings
      FROM profiles p
      WHERE p.id = NEW.profile_id;
      
      IF user_settings.user_id IS NOT NULL THEN
        -- Get user's notification preferences
        SELECT 
          schedule_updates,
          notification_lead_time_minutes
        INTO user_settings
        FROM user_settings us
        WHERE us.user_id = user_settings.user_id;
        
        IF user_settings.schedule_updates = true THEN
          lead_time_minutes := COALESCE(user_settings.notification_lead_time_minutes, 60);
          notification_time := NEW.start_time - (lead_time_minutes || ' minutes')::INTERVAL;
          
          -- Update or insert notification
          IF notification_time > NOW() THEN
            INSERT INTO scheduled_local_notifications (
              user_id,
              event_id,
              title,
              body,
              trigger_time,
              status
            ) VALUES (
              user_settings.user_id,
              NEW.id,  -- Use NEW.id instead of event_id
              'Upcoming Event',
              NEW.title || ' starts in ' || lead_time_minutes || ' minutes',
              notification_time,
              'pending'
            )
            ON CONFLICT (user_id, event_id) DO UPDATE SET
              title = EXCLUDED.title,
              body = EXCLUDED.body,
              trigger_time = EXCLUDED.trigger_time,
              status = 'pending',
              updated_at = NOW();
          ELSE
            -- Cancel notification if event time has passed
            UPDATE scheduled_local_notifications 
            SET status = 'cancelled', updated_at = NOW()
            WHERE user_id = user_settings.user_id AND event_id = NEW.id;
          END IF;
        ELSE
          -- Cancel notification if user disabled schedule updates
          UPDATE scheduled_local_notifications 
          SET status = 'cancelled', updated_at = NOW()
          WHERE user_id = user_settings.user_id AND event_id = NEW.id;
        END IF;
      END IF;
    END;
    
    RETURN NEW;
  END IF;
  
  -- Handle DELETE (event removed)
  IF TG_OP = 'DELETE' THEN
    -- Cancel any scheduled notifications for this event
    UPDATE scheduled_local_notifications 
    SET status = 'cancelled', updated_at = NOW()
    WHERE event_id = OLD.id;  -- Use OLD.id instead of event_id
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Recreate the trigger
CREATE TRIGGER trg_manage_event_notifications
  AFTER INSERT OR UPDATE OR DELETE ON events
  FOR EACH ROW
  EXECUTE FUNCTION manage_event_notifications();
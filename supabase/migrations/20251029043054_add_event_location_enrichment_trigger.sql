/*
  # Add Database Trigger to Enrich Event Locations

  1. Overview
    - Automatically enriches event locations with friendly names after insert/update
    - Calls the enrich-event-locations Edge Function asynchronously
    - Only triggers when location exists but location_name is missing/empty

  2. New Functions
    - `enrich_event_location()` - Trigger function that calls the Edge Function
      to geocode and populate location_name field

  3. Triggers
    - Create AFTER INSERT OR UPDATE trigger on events table
    - Only fires when location is present but location_name is null/empty
    - Calls Edge Function asynchronously to avoid blocking event creation

  4. Behavior
    - Triggers after event is inserted or updated
    - Checks if event has a location but no location_name
    - Calls enrich-event-locations Edge Function via HTTP (pg_net)
    - Edge Function uses Google Maps API to geocode location
    - Results are cached to avoid redundant API calls
    - Process is asynchronous so it doesn't slow down event creation

  5. Security
    - Function runs as SECURITY DEFINER to make HTTP requests
    - Uses service role key for authentication
    - Edge Function validates requests and applies rate limiting
*/

-- Create function to trigger location enrichment
CREATE OR REPLACE FUNCTION enrich_event_location()
RETURNS TRIGGER AS $$
DECLARE
  request_id bigint;
  payload json;
  supabase_url text;
  service_role_key text;
BEGIN
  -- Only proceed if event has a location but no location_name
  IF NEW.location IS NOT NULL AND
     TRIM(NEW.location) != '' AND
     (NEW.location_name IS NULL OR TRIM(NEW.location_name) = '') THEN

    -- Get Supabase URL and service role key from environment
    BEGIN
      supabase_url := current_setting('app.settings.supabase_url', true);
      service_role_key := current_setting('app.settings.service_role_key', true);

      -- If settings are not available, try direct environment variables
      IF supabase_url IS NULL THEN
        supabase_url := current_setting('SUPABASE_URL', true);
      END IF;

      IF service_role_key IS NULL THEN
        service_role_key := current_setting('SUPABASE_SERVICE_ROLE_KEY', true);
      END IF;

      -- Validate we have required settings
      IF supabase_url IS NULL OR service_role_key IS NULL THEN
        RAISE WARNING 'Supabase URL or service role key not configured for location enrichment';
        RETURN NEW;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not get Supabase settings for location enrichment: %', SQLERRM;
      RETURN NEW;
    END;

    -- Prepare payload with event ID for targeted enrichment
    payload := json_build_object(
      'event_id', NEW.id,
      'location', NEW.location,
      'batch_size', 1,
      'force', false
    );

    -- Call the Edge Function asynchronously using pg_net
    BEGIN
      SELECT net.http_post(
        url := supabase_url || '/functions/v1/enrich-event-locations',
        headers := json_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_role_key
        )::jsonb,
        body := payload::jsonb
      ) INTO request_id;

      RAISE LOG 'Location enrichment request initiated for event % with request ID: %', NEW.id, request_id;

    EXCEPTION WHEN OTHERS THEN
      -- Log error but don't fail the event insert/update
      RAISE WARNING 'Failed to trigger location enrichment for event %: %', NEW.id, SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_enrich_event_location ON events;

-- Create trigger for event location enrichment
-- This triggers after INSERT or UPDATE, but only when location changes
CREATE TRIGGER trigger_enrich_event_location
  AFTER INSERT OR UPDATE OF location, location_name ON events
  FOR EACH ROW
  WHEN (
    NEW.location IS NOT NULL AND
    TRIM(NEW.location) != '' AND
    (NEW.location_name IS NULL OR TRIM(NEW.location_name) = '')
  )
  EXECUTE FUNCTION enrich_event_location();

-- Add comment explaining the trigger
COMMENT ON TRIGGER trigger_enrich_event_location ON events IS
'Automatically enriches event locations with friendly names by calling the enrich-event-locations Edge Function';

-- Set up app settings for the function
-- These will be overridden by actual environment variables in production
DO $$
BEGIN
  -- Try to set app settings from environment variables
  BEGIN
    PERFORM set_config('app.settings.supabase_url', current_setting('SUPABASE_URL', true), false);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Could not set app.settings.supabase_url: %', SQLERRM;
  END;

  BEGIN
    PERFORM set_config('app.settings.service_role_key', current_setting('SUPABASE_SERVICE_ROLE_KEY', true), false);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Could not set app.settings.service_role_key: %', SQLERRM;
  END;
END;
$$;

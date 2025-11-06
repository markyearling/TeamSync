/*
  # Fix Location Enrichment Trigger to Use Vault

  1. Changes
    - Update enrich_event_location() function to read credentials from Supabase Vault
    - Use the same pattern as the working event message notification trigger
    - Maintain fallbacks to current_setting for backwards compatibility
    - Keep the trigger unchanged (only updating the function)

  2. Security
    - Uses Supabase's secure vault for credentials
    - Maintains SECURITY DEFINER for proper execution context
    - Reads from vault.decrypted_secrets table

  3. Behavior
    - First attempts to read service_role_key and supabase_url from vault
    - Falls back to current_setting if vault is unavailable
    - Logs warnings if credentials cannot be found
    - Does not fail event insert/update if enrichment cannot be triggered
*/

-- Drop and recreate the function with vault support
CREATE OR REPLACE FUNCTION enrich_event_location()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
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

    -- Get service role key from vault
    BEGIN
      SELECT decrypted_secret INTO service_role_key
      FROM vault.decrypted_secrets
      WHERE name = 'service_role_key'
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      -- If vault is not available, use current_setting as fallback
      service_role_key := current_setting('app.settings.service_role_key', true);
      
      -- Try environment variable as last resort
      IF service_role_key IS NULL THEN
        service_role_key := current_setting('SUPABASE_SERVICE_ROLE_KEY', true);
      END IF;
    END;

    -- Get Supabase URL from vault
    BEGIN
      SELECT decrypted_secret INTO supabase_url
      FROM vault.decrypted_secrets
      WHERE name = 'supabase_url'
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      -- If vault is not available, use current_setting as fallback
      supabase_url := current_setting('app.settings.supabase_url', true);
      
      -- Try environment variable as last resort
      IF supabase_url IS NULL THEN
        supabase_url := current_setting('SUPABASE_URL', true);
      END IF;
    END;

    -- Validate we have required settings
    IF supabase_url IS NULL OR service_role_key IS NULL THEN
      RAISE WARNING 'Supabase URL or service role key not configured for location enrichment. URL: %, Key: %', 
        (supabase_url IS NOT NULL), (service_role_key IS NOT NULL);
      RETURN NEW;
    END IF;

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
$$;

-- Add comment explaining the function
COMMENT ON FUNCTION enrich_event_location() IS
'Automatically enriches event locations with friendly names by calling the enrich-event-locations Edge Function. Reads credentials from Supabase Vault.';

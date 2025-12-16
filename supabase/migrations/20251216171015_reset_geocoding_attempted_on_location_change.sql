/*
  # Reset geocoding_attempted When Location Changes

  ## Purpose
  This migration adds logic to reset the geocoding_attempted flag when
  an event's location address changes, allowing the location to be re-geocoded
  with the new address.

  ## Changes
  1. Add trigger to reset geocoding_attempted when location changes
    - Fires on UPDATE of events table
    - Only when location field changes
    - Sets geocoding_attempted = false automatically
    - Preserves location_name (will be re-enriched by enrichment trigger)

  ## Behavior
  - When an event's location field is updated to a new value
  - The trigger automatically sets geocoding_attempted = false
  - This allows the enrichment function to process the event again
  - The old location_name is preserved until new enrichment succeeds

  ## Notes
  - Trigger only fires when OLD.location IS DISTINCT FROM NEW.location
  - Does not fire on INSERT (new events have geocoding_attempted = false by default)
  - Works in conjunction with the enrich_event_location trigger
*/

-- Create function to reset geocoding_attempted when location changes
CREATE OR REPLACE FUNCTION reset_geocoding_attempted_on_location_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if location has actually changed
  IF OLD.location IS DISTINCT FROM NEW.location THEN
    -- Reset geocoding_attempted to allow re-enrichment
    NEW.geocoding_attempted := false;

    RAISE LOG 'Location changed for event %. Resetting geocoding_attempted. Old: "%" -> New: "%"',
      NEW.id, OLD.location, NEW.location;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_reset_geocoding_attempted ON events;

-- Create trigger to reset geocoding_attempted when location changes
CREATE TRIGGER trigger_reset_geocoding_attempted
  BEFORE UPDATE OF location ON events
  FOR EACH ROW
  WHEN (OLD.location IS DISTINCT FROM NEW.location)
  EXECUTE FUNCTION reset_geocoding_attempted_on_location_change();

-- Add comment explaining the trigger
COMMENT ON TRIGGER trigger_reset_geocoding_attempted ON events IS
  'Resets geocoding_attempted to false when an event''s location address changes, allowing re-geocoding with the new address';

COMMENT ON FUNCTION reset_geocoding_attempted_on_location_change() IS
  'Trigger function that resets geocoding_attempted when location changes. This allows events to be re-geocoded when their address is updated.';

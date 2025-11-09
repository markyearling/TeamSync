/*
  # Add geocoding_attempted field to events table

  ## Purpose
  This migration adds a boolean field to track whether geocoding has been attempted
  for an event's location address. This prevents repeated API calls to Google Maps
  for addresses that cannot be geocoded (typos, incomplete addresses, etc.).

  ## Changes
  1. Add `geocoding_attempted` column to events table
    - Boolean field, defaults to false
    - Set to true after first geocoding attempt (success or failure)
    - Reset to false when location address changes

  ## Benefits
  - Prevents wasted Google Maps API calls on failed addresses
  - Reduces sync time for subsequent calendar refreshes
  - Lowers API costs by avoiding repeated geocoding attempts

  ## Notes
  - Existing events will have geocoding_attempted = false by default
  - Events with existing location_name will be marked as attempted = true
  - When location address changes, geocoding_attempted should be reset to false
*/

-- Add geocoding_attempted column to events table
ALTER TABLE events
ADD COLUMN IF NOT EXISTS geocoding_attempted BOOLEAN DEFAULT false;

-- Set geocoding_attempted = true for events that already have a location_name
-- This ensures we don't re-geocode events that were successfully geocoded before
UPDATE events
SET geocoding_attempted = true
WHERE location_name IS NOT NULL AND location_name != '';

-- Add comment to explain the column's purpose
COMMENT ON COLUMN events.geocoding_attempted IS
  'Tracks whether geocoding has been attempted for this event. Set to true after first attempt (success or failure). Reset to false when location address changes.';

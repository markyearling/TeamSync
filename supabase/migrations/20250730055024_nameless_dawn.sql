/*
  # Add location_name column to events table

  1. Schema Changes
    - Add `location_name` column to `events` table
    - Column will store the friendly name of the location (e.g., "Memorial Stadium")
    - The existing `location` column will continue to store the full address

  2. Data Migration
    - For existing events with comma-separated location data, extract the name part
    - Set location_name to the same as location for simple location strings
    - This ensures backward compatibility with existing data

  3. Notes
    - This is a non-breaking change - existing code will continue to work
    - New sync functions will populate both location and location_name
    - Frontend will display location_name when available, fallback to location
*/

-- Add location_name column to events table
ALTER TABLE IF EXISTS events 
ADD COLUMN IF NOT EXISTS location_name text;

-- Update existing records where location contains comma-separated data
-- Heuristic: if location contains a comma, the part before the first comma is likely the name
DO $$
BEGIN
  -- Update records where location has comma-separated format like "Stadium Name, 123 Main St"
  UPDATE events
  SET location_name = split_part(location, ',', 1)
  WHERE location LIKE '%,%' 
    AND location_name IS NULL
    AND location IS NOT NULL
    AND trim(location) != '';

  -- For records without commas, set location_name to be the same as location
  UPDATE events
  SET location_name = location
  WHERE location_name IS NULL
    AND location IS NOT NULL
    AND trim(location) != ''
    AND location NOT LIKE '%,%';

  -- Clean up any leading/trailing whitespace in location_name
  UPDATE events
  SET location_name = trim(location_name)
  WHERE location_name IS NOT NULL
    AND location_name != trim(location_name);
END $$;
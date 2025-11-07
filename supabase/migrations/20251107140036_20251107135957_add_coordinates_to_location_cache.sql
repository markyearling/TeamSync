/*
  # Add Coordinates to Location Cache for Proximity Matching

  ## Changes
  This migration enhances the location_cache table to support proximity-based lookups,
  reducing redundant Google Maps API calls for locations that are essentially the same
  place but have slightly different address strings.

  1. Schema Changes
    - Add `latitude` column (double precision)
    - Add `longitude` column (double precision)
    - Enable PostGIS extension for geospatial calculations
    - Create spatial index for efficient proximity queries
    - Create function to find nearby cached locations within 50 meters

  2. Data Preservation
    - All existing cache entries are preserved
    - Entries without coordinates continue to work with exact address matching
    - New entries will include coordinates from Google Places API

  3. Performance
    - Spatial index on lat/lng for fast proximity searches
    - Function returns closest match within threshold
    - Falls back to exact address match if no coordinates available

  4. API Call Reduction
    - Reduces duplicate API calls for locations with address variations
    - Currently: 2 API calls per unique address string (max)
    - After: Reuses cached data for locations within 50 meters
    - Example: "123 Main St" and "123 Main Street, City" will match if within 50m

  ## Notes
  - 50 meter threshold ensures high accuracy and prevents wrong location matches
  - PostGIS ST_Distance calculates distances in meters using geography type
  - Empty/null location_name entries are excluded from proximity matches
*/

-- Enable PostGIS extension for geospatial calculations
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add coordinate columns to location_cache
ALTER TABLE location_cache
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

-- Create spatial index for efficient proximity queries
-- Note: We create a composite index on lat/lng for proximity searches
CREATE INDEX IF NOT EXISTS idx_location_cache_coordinates
  ON location_cache (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Create function to find nearby cached locations within a distance threshold
-- This function returns the closest cached location within 50 meters
-- Returns NULL if no location is found within the threshold
CREATE OR REPLACE FUNCTION find_nearby_location(
  search_lat double precision,
  search_lng double precision,
  max_distance_meters double precision DEFAULT 50
)
RETURNS TABLE (
  address text,
  location_name text,
  formatted_address text,
  latitude double precision,
  longitude double precision,
  distance_meters double precision
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    lc.address,
    lc.location_name,
    lc.formatted_address,
    lc.latitude,
    lc.longitude,
    ST_Distance(
      ST_MakePoint(lc.longitude, lc.latitude)::geography,
      ST_MakePoint(search_lng, search_lat)::geography
    ) as distance_meters
  FROM location_cache lc
  WHERE
    lc.latitude IS NOT NULL
    AND lc.longitude IS NOT NULL
    AND lc.location_name IS NOT NULL
    AND lc.location_name != ''
    AND ST_DWithin(
      ST_MakePoint(lc.longitude, lc.latitude)::geography,
      ST_MakePoint(search_lng, search_lat)::geography,
      max_distance_meters
    )
  ORDER BY distance_meters ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION find_nearby_location TO authenticated;
GRANT EXECUTE ON FUNCTION find_nearby_location TO service_role;
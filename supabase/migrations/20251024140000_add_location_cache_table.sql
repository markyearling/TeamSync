/*
  # Add Location Name Cache Table

  1. New Tables
    - `location_cache`
      - `id` (uuid, primary key)
      - `address` (text, unique, indexed) - normalized address for lookup
      - `location_name` (text) - the friendly name of the location
      - `formatted_address` (text) - the formatted address from Google
      - `created_at` (timestamptz) - when the cache entry was created
      - `updated_at` (timestamptz) - when the cache entry was last updated

  2. Security
    - Enable RLS on location_cache table
    - Add policy for authenticated users to read cache entries
    - Only system functions should write to cache (via service role)

  3. Notes
    - This table caches Google Places API lookups to reduce API calls
    - The address field is normalized (trimmed, lowercase) for consistent lookups
    - Cache entries are shared across all users to maximize efficiency
*/

CREATE TABLE IF NOT EXISTS location_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address text UNIQUE NOT NULL,
  location_name text,
  formatted_address text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index on address for fast lookups
CREATE INDEX IF NOT EXISTS idx_location_cache_address ON location_cache(address);

-- Enable RLS
ALTER TABLE location_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all authenticated users to read from cache
CREATE POLICY "Authenticated users can read location cache"
  ON location_cache
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Only service role can insert/update cache entries
-- This will be handled by Edge Functions using service role key

-- Create trigger for updated_at
CREATE TRIGGER update_location_cache_updated_at
  BEFORE UPDATE ON location_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

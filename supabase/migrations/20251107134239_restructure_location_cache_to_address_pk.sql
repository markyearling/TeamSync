/*
  # Restructure Location Cache Table

  ## Changes
  This migration restructures the location_cache table to use address as the primary key,
  eliminating the unnecessary UUID id column and aligning the schema with actual usage patterns.

  1. Schema Changes
    - Remove `id` column (UUID primary key)
    - Make `address` the primary key
    - Keep `location_name`, `formatted_address`, `created_at`, `updated_at` columns
    - Drop redundant index on address (primary key creates its own index)

  2. Data Preservation
    - All existing cache entries are preserved
    - No data loss occurs during migration

  3. Security
    - RLS policies remain unchanged and continue to work
    - Authenticated users can read cache entries
    - Service role can upsert entries

  ## Notes
  - The address field is normalized (trimmed, lowercase) for consistent lookups
  - Upsert operations already use address for conflict resolution
  - This change makes the table more efficient as a pure lookup table
*/

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS update_location_cache_updated_at ON location_cache;

-- Drop the existing index on address (will be replaced by primary key index)
DROP INDEX IF EXISTS idx_location_cache_address;

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Authenticated users can read location cache" ON location_cache;

-- Create new table with address as primary key
CREATE TABLE IF NOT EXISTS location_cache_new (
  address text PRIMARY KEY,
  location_name text,
  formatted_address text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Copy data from old table to new table
INSERT INTO location_cache_new (address, location_name, formatted_address, created_at, updated_at)
SELECT address, location_name, formatted_address, created_at, updated_at
FROM location_cache
ON CONFLICT (address) DO NOTHING;

-- Drop old table
DROP TABLE IF EXISTS location_cache;

-- Rename new table to original name
ALTER TABLE location_cache_new RENAME TO location_cache;

-- Enable RLS
ALTER TABLE location_cache ENABLE ROW LEVEL SECURITY;

-- Recreate policy for authenticated users to read from cache
CREATE POLICY "Authenticated users can read location cache"
  ON location_cache
  FOR SELECT
  TO authenticated
  USING (true);

-- Recreate trigger for updated_at
CREATE TRIGGER update_location_cache_updated_at
  BEFORE UPDATE ON location_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

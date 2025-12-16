/*
  # Google API Audit Logging System
  
  1. New Tables
    - `system_settings`
      - `key` (text, primary key) - Setting identifier
      - `value` (text) - Setting value
      - `description` (text) - Human-readable description
      - `created_at` (timestamptz) - When setting was created
      - `updated_at` (timestamptz) - Last update time
    
    - `google_api_audit_logs`
      - `id` (bigint, primary key) - Auto-incrementing ID
      - `created_at` (timestamptz) - When API call was made
      - `user_id` (uuid) - User whose action triggered the call
      - `api_type` (text) - Type of API (geocoding, places)
      - `endpoint_url` (text) - Full API endpoint URL
      - `request_query` (text) - Address or query sent
      - `response_status` (text) - Response status (OK, error codes)
      - `cache_hit` (boolean) - Whether result came from cache
      - `event_id` (bigint) - Related event ID if applicable
      - `request_id` (text) - Correlation ID for debugging
  
  2. Security
    - No RLS needed - admin/SQL access only
    - Tables are for developer audit purposes
  
  3. Indexes
    - Index on created_at for time-based queries
    - Index on api_type for filtering by API
    - Index on user_id for per-user analysis
  
  4. Helper Queries (for developer reference)
    
    -- Check if audit is enabled
    SELECT value FROM system_settings WHERE key = 'enable_google_api_audit';
    
    -- Toggle audit on
    UPDATE system_settings SET value = 'true', updated_at = now() 
    WHERE key = 'enable_google_api_audit';
    
    -- Toggle audit off
    UPDATE system_settings SET value = 'false', updated_at = now() 
    WHERE key = 'enable_google_api_audit';
    
    -- Count API calls by date
    SELECT 
      DATE(created_at) as date,
      api_type,
      COUNT(*) as total_calls,
      SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) as cached,
      SUM(CASE WHEN NOT cache_hit THEN 1 ELSE 0 END) as actual_api_calls
    FROM google_api_audit_logs
    GROUP BY DATE(created_at), api_type
    ORDER BY date DESC;
    
    -- Calculate cache hit rate
    SELECT 
      api_type,
      COUNT(*) as total_requests,
      SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) as cache_hits,
      ROUND(100.0 * SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) / COUNT(*), 2) as cache_hit_rate_percent
    FROM google_api_audit_logs
    GROUP BY api_type;
    
    -- Estimate costs (Geocoding: $5/1000, Places: $17/1000)
    SELECT 
      api_type,
      SUM(CASE WHEN NOT cache_hit THEN 1 ELSE 0 END) as actual_api_calls,
      CASE 
        WHEN api_type = 'geocoding' THEN SUM(CASE WHEN NOT cache_hit THEN 1 ELSE 0 END) * 0.005
        WHEN api_type = 'places' THEN SUM(CASE WHEN NOT cache_hit THEN 1 ELSE 0 END) * 0.017
      END as estimated_cost_usd
    FROM google_api_audit_logs
    GROUP BY api_type;
    
    -- Most geocoded addresses
    SELECT 
      request_query,
      COUNT(*) as request_count,
      SUM(CASE WHEN cache_hit THEN 1 ELSE 0 END) as cache_hits
    FROM google_api_audit_logs
    WHERE api_type = 'geocoding'
    GROUP BY request_query
    ORDER BY request_count DESC
    LIMIT 20;
    
    -- Per-user API usage
    SELECT 
      user_id,
      COUNT(*) as total_requests,
      SUM(CASE WHEN NOT cache_hit THEN 1 ELSE 0 END) as actual_api_calls
    FROM google_api_audit_logs
    GROUP BY user_id
    ORDER BY actual_api_calls DESC;
*/

-- Create system_settings table
CREATE TABLE IF NOT EXISTS system_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Insert the audit toggle setting (default: disabled)
INSERT INTO system_settings (key, value, description)
VALUES (
  'enable_google_api_audit',
  'false',
  'Enable/disable Google API usage audit logging. Set to ''true'' to enable, ''false'' to disable.'
)
ON CONFLICT (key) DO NOTHING;

-- Create google_api_audit_logs table
CREATE TABLE IF NOT EXISTS google_api_audit_logs (
  id bigserial PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  user_id uuid,
  api_type text NOT NULL,
  endpoint_url text,
  request_query text,
  response_status text,
  cache_hit boolean DEFAULT false,
  event_id bigint,
  request_id text
);

-- Add indexes for query performance
CREATE INDEX IF NOT EXISTS idx_google_api_audit_logs_created_at 
  ON google_api_audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_google_api_audit_logs_api_type 
  ON google_api_audit_logs(api_type);

CREATE INDEX IF NOT EXISTS idx_google_api_audit_logs_user_id 
  ON google_api_audit_logs(user_id);

-- Add index for cache hit analysis
CREATE INDEX IF NOT EXISTS idx_google_api_audit_logs_cache_hit 
  ON google_api_audit_logs(cache_hit);

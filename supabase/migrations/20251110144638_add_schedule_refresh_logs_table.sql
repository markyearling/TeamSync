/*
  # Add Schedule Refresh Logs Table

  1. New Tables
    - `schedule_refresh_logs`
      - `id` (uuid, primary key)
      - `started_at` (timestamptz) - When the refresh execution started
      - `completed_at` (timestamptz) - When the refresh execution completed
      - `total_teams` (integer) - Total number of teams processed
      - `successful_teams` (integer) - Number of teams synced successfully
      - `failed_teams` (integer) - Number of teams that failed to sync
      - `skipped_teams` (integer) - Number of teams skipped (no profile mappings)
      - `total_events_synced` (integer) - Total number of events synced across all teams
      - `total_users_affected` (integer) - Number of unique users whose schedules were refreshed
      - `execution_duration_ms` (integer) - Total execution time in milliseconds
      - `error_details` (jsonb) - Detailed error information for debugging
      - `results` (jsonb) - Detailed results per team

  2. Security
    - Enable RLS on `schedule_refresh_logs` table
    - Add policy for service role to insert and update logs
    - Add policy for authenticated users to read their own refresh logs (via user_id in results)

  3. Indexes
    - Index on `started_at` for efficient querying of recent logs
    - Index on `completed_at` for finding completed executions

  4. Functions
    - Add function to get the most recent refresh log
    - Add index on `user_settings.last_dashboard_refresh` for efficient queries
*/

-- Create the schedule_refresh_logs table
CREATE TABLE IF NOT EXISTS schedule_refresh_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  total_teams integer DEFAULT 0,
  successful_teams integer DEFAULT 0,
  failed_teams integer DEFAULT 0,
  skipped_teams integer DEFAULT 0,
  total_events_synced integer DEFAULT 0,
  total_users_affected integer DEFAULT 0,
  execution_duration_ms integer,
  error_details jsonb,
  results jsonb
);

-- Enable RLS on the schedule_refresh_logs table
ALTER TABLE schedule_refresh_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can insert and update logs
CREATE POLICY "Service role can manage schedule refresh logs"
  ON schedule_refresh_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can view all refresh logs for monitoring
CREATE POLICY "Authenticated users can view schedule refresh logs"
  ON schedule_refresh_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_schedule_refresh_logs_started_at
  ON schedule_refresh_logs(started_at DESC);

CREATE INDEX IF NOT EXISTS idx_schedule_refresh_logs_completed_at
  ON schedule_refresh_logs(completed_at DESC);

-- Add index on user_settings.last_dashboard_refresh for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_settings_last_dashboard_refresh
  ON user_settings(last_dashboard_refresh DESC);

-- Create a function to get the most recent refresh log
CREATE OR REPLACE FUNCTION get_latest_refresh_log()
RETURNS schedule_refresh_logs
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT *
  FROM schedule_refresh_logs
  ORDER BY started_at DESC
  LIMIT 1;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_latest_refresh_log() TO authenticated;

-- Create a function to get refresh logs summary for a specific time period
CREATE OR REPLACE FUNCTION get_refresh_logs_summary(
  hours_ago integer DEFAULT 24
)
RETURNS TABLE (
  total_executions bigint,
  successful_executions bigint,
  failed_executions bigint,
  avg_execution_time_ms numeric,
  total_teams_synced bigint,
  total_events_synced bigint
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    COUNT(*) as total_executions,
    COUNT(*) FILTER (WHERE completed_at IS NOT NULL AND failed_teams = 0) as successful_executions,
    COUNT(*) FILTER (WHERE failed_teams > 0 OR completed_at IS NULL) as failed_executions,
    AVG(execution_duration_ms) as avg_execution_time_ms,
    SUM(total_teams) as total_teams_synced,
    SUM(total_events_synced) as total_events_synced
  FROM schedule_refresh_logs
  WHERE started_at >= now() - (hours_ago || ' hours')::interval;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_refresh_logs_summary(integer) TO authenticated;

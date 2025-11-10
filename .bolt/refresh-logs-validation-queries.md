# Schedule Refresh Logs Validation Queries

This document contains SQL queries to validate the schedule refresh functionality and monitor execution history.

## Check Recent Refresh Executions

View the 10 most recent refresh executions with summary statistics:

```sql
SELECT
  id,
  started_at,
  completed_at,
  total_teams,
  successful_teams,
  failed_teams,
  skipped_teams,
  total_events_synced,
  total_users_affected,
  execution_duration_ms,
  CASE
    WHEN completed_at IS NULL THEN 'In Progress'
    WHEN failed_teams > 0 THEN 'Completed with Errors'
    ELSE 'Completed Successfully'
  END as status
FROM schedule_refresh_logs
ORDER BY started_at DESC
LIMIT 10;
```

## View Detailed Results for a Specific Execution

Replace `<log_id>` with the actual log ID:

```sql
SELECT
  id,
  started_at,
  completed_at,
  execution_duration_ms,
  results
FROM schedule_refresh_logs
WHERE id = '<log_id>';
```

## View Error Details for Failed Executions

```sql
SELECT
  id,
  started_at,
  completed_at,
  failed_teams,
  error_details
FROM schedule_refresh_logs
WHERE failed_teams > 0 OR error_details IS NOT NULL
ORDER BY started_at DESC
LIMIT 10;
```

## Check User's Last Dashboard Refresh Time

Replace `<user_id>` with the actual user ID:

```sql
SELECT
  user_id,
  last_dashboard_refresh,
  NOW() - last_dashboard_refresh as time_since_last_refresh
FROM user_settings
WHERE user_id = '<user_id>';
```

## View All Users' Last Refresh Times

```sql
SELECT
  us.user_id,
  au.email,
  us.last_dashboard_refresh,
  NOW() - us.last_dashboard_refresh as time_since_last_refresh
FROM user_settings us
JOIN auth.users au ON us.user_id = au.id
ORDER BY us.last_dashboard_refresh DESC NULLS LAST;
```

## Get Summary Statistics for Last 24 Hours

```sql
SELECT * FROM get_refresh_logs_summary(24);
```

## Get the Most Recent Refresh Log

```sql
SELECT * FROM get_latest_refresh_log();
```

## Monitor Refresh Performance Over Time

```sql
SELECT
  DATE_TRUNC('hour', started_at) as hour,
  COUNT(*) as executions,
  AVG(execution_duration_ms) as avg_duration_ms,
  SUM(total_events_synced) as total_events,
  SUM(total_users_affected) as total_users
FROM schedule_refresh_logs
WHERE started_at >= NOW() - INTERVAL '7 days'
  AND completed_at IS NOT NULL
GROUP BY DATE_TRUNC('hour', started_at)
ORDER BY hour DESC;
```

## Check for Stale User Data

Find users whose schedules haven't been refreshed in over 2 hours:

```sql
SELECT
  us.user_id,
  au.email,
  us.last_dashboard_refresh,
  NOW() - us.last_dashboard_refresh as time_since_last_refresh
FROM user_settings us
JOIN auth.users au ON us.user_id = au.id
WHERE us.last_dashboard_refresh IS NULL
   OR us.last_dashboard_refresh < NOW() - INTERVAL '2 hours'
ORDER BY us.last_dashboard_refresh NULLS FIRST;
```

## View Team Sync Status by User

```sql
SELECT
  pt.user_id,
  pt.platform,
  pt.team_name,
  pt.sync_status,
  pt.last_synced,
  us.last_dashboard_refresh
FROM platform_teams pt
LEFT JOIN user_settings us ON pt.user_id = us.user_id
ORDER BY pt.user_id, pt.last_synced DESC NULLS LAST;
```

## Testing the Refresh Function Manually

To manually trigger the refresh function and verify it's working:

1. Go to the Supabase Dashboard > Edge Functions
2. Find the `refresh-all-user-schedules` function
3. Click "Invoke" or use the following command:

```bash
curl -X POST \
  "https://<your-project>.supabase.co/functions/v1/refresh-all-user-schedules" \
  -H "Authorization: Bearer <your-service-role-key>" \
  -H "Content-Type: application/json"
```

4. Check the response for the `logId` field
5. Use the queries above to verify the log entry was created and the `user_settings.last_dashboard_refresh` fields were updated

## Expected Behavior

After the refresh function runs successfully:

1. A new row should appear in `schedule_refresh_logs` with:
   - `started_at` timestamp
   - `completed_at` timestamp (when finished)
   - Statistics about teams processed, events synced, etc.
   - `results` JSON with detailed per-team information

2. All affected users should have their `user_settings.last_dashboard_refresh` updated to the completion timestamp

3. The dashboard should display the updated "Last refreshed" time for each user

4. Team-specific `last_synced` timestamps should be updated in the `platform_teams` table

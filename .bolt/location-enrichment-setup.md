# Location Enrichment Setup Guide

## Overview

The database trigger has been successfully created to automatically enrich event locations with friendly names. However, for it to work, you need to configure the Google Maps API key as a Supabase secret.

## What Was Implemented

1. **Database Trigger**: `trigger_enrich_event_location`
   - Automatically fires after events are inserted or updated
   - Only triggers when event has a `location` but no `location_name`
   - Calls the `enrich-event-locations` Edge Function asynchronously via `pg_net`

2. **Trigger Function**: `enrich_event_location()`
   - Makes HTTP POST request to the Edge Function
   - Passes event ID and location for targeted enrichment
   - Handles errors gracefully without blocking event creation

## Required Configuration

### Set Google Maps API Key as Supabase Secret

The Edge Function needs access to your Google Maps API key. You must set it as a secret in your Supabase project:

#### Option 1: Via Supabase Dashboard (Recommended)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project (cwbdhswftljelgwgjxnc)
3. Navigate to **Settings** > **Edge Functions** > **Secrets**
4. Click **Add new secret**
5. Set:
   - Name: `VITE_GOOGLE_MAPS_API_KEY`
   - Value: Your Google Maps API key
6. Click **Save**

#### Option 2: Via Supabase CLI

```bash
# Set the secret
supabase secrets set VITE_GOOGLE_MAPS_API_KEY=your_actual_api_key_here

# Verify it was set
supabase secrets list
```

## How It Works

### Automatic Enrichment Flow

1. **Event Sync**: When you sync a SportsEngine team calendar:
   ```
   User clicks "Refresh" → sync-sportsengine-calendar Edge Function runs
   ```

2. **Event Creation**: Events are upserted into the database:
   ```
   INSERT/UPDATE events SET location = '123 Main St, City, State'
   ```

3. **Trigger Fires**: Database trigger detects new event with location but no location_name:
   ```
   trigger_enrich_event_location → enrich_event_location()
   ```

4. **HTTP Request**: Trigger makes async HTTP call:
   ```
   POST /functions/v1/enrich-event-locations
   Body: { event_id, location, batch_size: 1 }
   ```

5. **Edge Function Processes**:
   - Checks location_cache table first
   - If not cached, calls Google Maps Geocoding API
   - Extracts friendly location name (e.g., "Memorial Stadium")
   - Updates event with location_name
   - Caches result for future use

6. **Result**: Event now has both:
   - `location`: "123 Main St, City, State" (full address)
   - `location_name`: "Memorial Stadium" (friendly name)

### Log Output You'll See

Once configured, when you sync a team, you should see logs like:

**In PostgreSQL logs** (if log level is set appropriately):
```
LOG: Location enrichment request initiated for event <uuid> with request ID: <id>
```

**In Supabase Edge Function logs** (Functions > enrich-event-locations > Logs):
```
[Enrich:abc123] ========================================
[Enrich:abc123] NEW ENRICHMENT REQUEST
[Enrich:abc123] ========================================
[Enrich:abc123] Environment check:
[Enrich:abc123] - SUPABASE_URL: true
[Enrich:abc123] - SUPABASE_SERVICE_ROLE_KEY: true
[Enrich:abc123] - VITE_GOOGLE_MAPS_API_KEY: true
[Enrich:abc123] Google Maps API key present (masked): AIza...xyz
[Enrich:abc123] Parameters:
[Enrich:abc123] - batch_size: 1
[Enrich:abc123] - dry_run: false
[Enrich:abc123] - force: false
[Enrich:abc123] Fetching events from database...
[Enrich:abc123] Fetched 1 events in 45ms
...
```

## Testing the Setup

### Test 1: Verify Secret is Set

After setting the secret, you can test by manually calling the Edge Function:

```bash
curl -X POST "https://cwbdhswftljelgwgjxnc.supabase.co/functions/v1/enrich-event-locations" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"batch_size": 5}'
```

Check the logs in Supabase Dashboard > Functions > enrich-event-locations > Logs

### Test 2: Sync a Team

1. Go to your app's Connections page
2. Click on SportsEngine
3. Find a team and click the refresh/sync button
4. Check Supabase logs for both:
   - `sync-sportsengine-calendar` function
   - `enrich-event-locations` function (should appear shortly after sync)

### Test 3: Verify Database Updates

After syncing, check if location_name is being populated:

```sql
SELECT
  id,
  title,
  location,
  location_name,
  created_at
FROM events
WHERE platform = 'SportsEngine'
ORDER BY created_at DESC
LIMIT 10;
```

You should see `location_name` populated with friendly names like:
- "Memorial Stadium"
- "City Sports Complex"
- "North High School"
- etc.

## Troubleshooting

### No Logs Appearing in enrich-event-locations

**Possible Causes:**
1. Secret not set correctly
2. pg_net extension not working
3. Trigger not firing due to conditions not being met

**Solutions:**
1. Verify secret: `supabase secrets list`
2. Check if events already have location_name (trigger won't fire)
3. Check PostgreSQL logs for warnings

### Logs Show "API key not configured"

The secret wasn't set or is using the wrong name. Ensure:
- Secret name is exactly: `VITE_GOOGLE_MAPS_API_KEY`
- Secret is set for the correct project
- Edge Functions were restarted after setting secret

### Geocoding Fails with "REQUEST_DENIED"

Google Maps API key issues:
1. API key doesn't have Geocoding API enabled
2. Billing not set up on Google Cloud project
3. API key restrictions preventing use

**Fix:** Go to Google Cloud Console > APIs & Services > Credentials and verify your API key.

### Trigger Not Firing

Check if events meet trigger conditions:
```sql
-- Events that SHOULD trigger enrichment
SELECT id, location, location_name
FROM events
WHERE location IS NOT NULL
  AND TRIM(location) != ''
  AND (location_name IS NULL OR TRIM(location_name) = '');
```

If no events match, the trigger won't fire (which is correct behavior).

## Performance Considerations

### Async Processing

The trigger uses `pg_net.http_post()` which makes async HTTP requests. This means:
- ✅ Event insert/update is NOT blocked
- ✅ Sync operations remain fast
- ✅ Geocoding happens in the background
- ⚠️ Small delay before location_name appears (usually < 2 seconds)

### Caching

The `location_cache` table prevents redundant API calls:
- First time: Calls Google Maps API
- Subsequent times: Uses cached result
- Saves API quota and improves performance

### Rate Limiting

Google Maps API has rate limits:
- Free tier: ~40,000 requests/month
- Each unique address uses 1 request
- Cached addresses don't count against quota

## Next Steps

1. ✅ **Set the Google Maps API key secret** (see above)
2. ✅ **Test by syncing a team calendar**
3. ✅ **Check logs to confirm enrichment is working**
4. ✅ **Verify location_name is being populated**

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Action                              │
│                  (Syncs SportsEngine Team)                       │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              sync-sportsengine-calendar Function                 │
│  • Fetches ICS calendar data                                    │
│  • Parses events                                                │
│  • Upserts events into database                                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Database (events table)                       │
│  INSERT/UPDATE event with location but no location_name         │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Trigger: trigger_enrich_event_location              │
│  • Fires AFTER INSERT OR UPDATE                                 │
│  • Only when: location exists, location_name is null/empty      │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│           Function: enrich_event_location()                      │
│  • Gets Supabase URL & service role key from config             │
│  • Prepares JSON payload with event data                        │
│  • Makes async HTTP POST via pg_net                             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│           Edge Function: enrich-event-locations                  │
│  • Receives HTTP request with event ID & location               │
│  • Checks location_cache table                                  │
│  • If not cached: Calls Google Maps Geocoding API              │
│  • Extracts location name from response                         │
│  • Updates event.location_name in database                      │
│  • Caches result for future use                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Summary

The database trigger is now active and will automatically enrich event locations. All you need to do is **set the Google Maps API key as a Supabase secret**, and then every time you sync a team calendar, you'll see the "NEW ENRICHMENT REQUEST" logs you were looking for!

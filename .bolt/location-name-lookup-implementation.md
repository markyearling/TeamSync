# Google Maps Location Name Lookup Implementation

## Overview
Implemented a comprehensive location name lookup system that enriches event data with recognizable place names from Google Maps. The system works across manual event creation, event editing, and external platform synchronization.

## Components Implemented

### 1. Client-Side Geocoding Utility (`src/utils/geocoding.ts`)
- **Purpose**: Provides geocoding functionality for the frontend
- **Features**:
  - In-memory caching to reduce API calls
  - Geocodes addresses to extract location names
  - Extracts location names directly from Google Places API results
  - Handles establishments, points of interest, and premises
  - Graceful error handling with fallbacks

### 2. Database Schema
**Migration**: `supabase/migrations/20251024140000_add_location_cache_table.sql`
- **New Table**: `location_cache`
  - Caches Google Places API lookups to minimize API usage
  - Indexed on normalized address for fast lookups
  - Shared across all users for efficiency
  - Row Level Security enabled

### 3. Enhanced Event Modals

#### AddEventModal (`src/components/events/AddEventModal.tsx`)
- Captures location_name when user selects from Google Autocomplete dropdown
- Automatically geocodes manually-typed addresses to find location names
- Stores both `location` (full address) and `location_name` (place name)

#### EditEventModal (`src/components/events/EditEventModal.tsx`)
- Captures location_name when location is changed via autocomplete
- Geocodes new manually-typed addresses
- Only geocodes when location actually changes

### 4. Server-Side Geocoding Utility
**File**: `supabase/functions/_shared/geocoding.ts`
- Shared utility for Edge Functions
- Integrates with location_cache table
- Uses Google Geocoding API
- Automatic cache population

### 5. Retroactive Enrichment Edge Function
**File**: `supabase/functions/enrich-event-locations/index.ts`
- Processes existing events missing location_name
- Batch processing with configurable batch size
- Rate limiting to respect API quotas
- Dry-run mode for testing
- Cache-first approach

**Usage**:
```bash
# Process 50 events (default)
POST https://[project].supabase.co/functions/v1/enrich-event-locations

# Dry run without updating database
POST https://[project].supabase.co/functions/v1/enrich-event-locations?dry_run=true

# Custom batch size
POST https://[project].supabase.co/functions/v1/enrich-event-locations?batch_size=100
```

### 6. Updated External Platform Sync Functions

#### TeamSnap (`sync-teamsnap-calendar/index.ts`)
- Geocodes location addresses during sync
- Uses cache to avoid redundant API calls
- Only updates location_name if not already set

#### GameChanger (`sync-gamechanger-calendar/index.ts`)
- Enriches events with location names after transformation
- Maintains complex timezone handling logic
- Async geocoding for all events with locations

#### PlayMetrics (`sync-playmetrics-calendar/index.ts`)
- Similar implementation to GameChanger
- Geocodes event locations during sync
- Cache-first approach

#### SportsEngine (`sync-sportsengine-calendar/index.ts`)
- Already had location_name support
- No changes needed

## How It Works

### Manual Event Creation Flow
1. User types or selects a location in AddEventModal
2. If selected from Google Autocomplete dropdown:
   - Location name is extracted directly from place object
   - Both address and name stored immediately
3. If manually typed:
   - Address is saved
   - System attempts to geocode the address
   - If location name found, it's stored
   - Otherwise, event is saved with address only

### External Platform Sync Flow
1. Platform sync function fetches events with addresses
2. For each event location:
   - Check location_cache table first
   - If cached, use cached location_name
   - If not cached, call Google Geocoding API
   - Cache the result for future use
   - Store location_name with event
3. Events synced with both address and location name

### Retroactive Enrichment Flow
1. Edge function queries events with location but no location_name
2. Processes events in batches (default 50)
3. For each event:
   - Check cache first
   - Geocode if not cached
   - Update event with location_name
   - Cache the result
4. Rate limiting prevents API quota issues

## Caching Strategy

### Client-Side Cache
- In-memory cache during session
- Prevents redundant API calls during event creation
- Cleared when page refreshes

### Server-Side Cache
- Persistent database table (location_cache)
- Shared across all users and functions
- Never expires (manual cleanup if needed)
- Indexed for fast lookups

## API Usage Optimization

1. **Cache-First Approach**: Always check cache before API call
2. **Batch Processing**: Enrichment function processes in configurable batches
3. **Rate Limiting**: 100ms delay between geocoding requests
4. **Conditional Geocoding**: Only geocode when location_name is missing
5. **Shared Cache**: All users benefit from previous lookups

## Database Schema

### events table
- `location` (text): Full address
- `location_name` (text, nullable): Friendly place name

### location_cache table
- `id` (uuid): Primary key
- `address` (text, unique): Normalized address (lowercase, trimmed)
- `location_name` (text, nullable): Place name from Google
- `formatted_address` (text, nullable): Google's formatted address
- `created_at` (timestamptz): Cache entry creation time
- `updated_at` (timestamptz): Last update time

## Testing Recommendations

1. **Manual Event Creation**:
   - Test selecting location from Google Autocomplete
   - Test typing address manually
   - Verify location_name is stored correctly

2. **Event Editing**:
   - Change location via autocomplete
   - Change location via manual typing
   - Verify location_name updates correctly

3. **External Platform Sync**:
   - Sync events from TeamSnap, GameChanger, PlayMetrics
   - Verify locations are geocoded
   - Check location_cache table for entries

4. **Retroactive Enrichment**:
   - Run enrichment function in dry-run mode
   - Review what would be enriched
   - Run actual enrichment
   - Verify events updated correctly

## Future Enhancements

1. **Scheduled Enrichment**: Set up cron job to run enrichment periodically
2. **Cache Expiration**: Add TTL to cache entries for stale data cleanup
3. **Bulk Cache Warming**: Pre-populate cache with common venues
4. **Admin UI**: Build interface to manage cache and trigger enrichment
5. **Analytics**: Track geocoding success rate and API usage

## Environment Variables Required

- `VITE_GOOGLE_MAPS_API_KEY`: Google Maps API key with Places API and Geocoding API enabled

## Security Considerations

1. API key is not exposed to client (used only in Edge Functions)
2. Rate limiting prevents abuse
3. RLS policies protect location_cache table
4. Only authenticated users can read cache
5. Only service role can write to cache

## Summary

The implementation provides a robust, scalable solution for enriching events with location names. It works seamlessly across manual entry and external platform syncs, uses aggressive caching to minimize API costs, and includes tools for retroactive enrichment of existing data.

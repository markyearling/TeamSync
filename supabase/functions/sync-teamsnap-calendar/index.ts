import { createClient } from 'npm:@supabase/supabase-js@2';
import { geocodeAddress } from '../_shared/geocoding.ts';

// This function is executed at the very top level.
console.log("sync-teamsnap-calendar: Function file loaded.");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface TeamSnapSyncRequest {
  teamId: string;
  profileId: string;
  userId: string;
}

// TeamSnap API configuration
const TEAMSNAP_TOKEN_URL = 'https://auth.teamsnap.com/oauth/token';
const TEAMSNAP_API_URL = 'https://api.teamsnap.com/v3';

Deno.serve(async (req: Request): Promise<Response> => {
  let body: TeamSnapSyncRequest | null = null;

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Initialize Supabase client
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );

  try {
    console.log('Processing TeamSnap sync request...'); // Added logging
    
    // Assign to the outer-scoped variable
    body = await req.json();
    const { teamId, profileId, userId }: TeamSnapSyncRequest = body;

    if (!teamId || !profileId || !userId) {
      throw new Error('Missing required parameters: teamId, profileId, or userId');
    }

    console.log(`Syncing TeamSnap team ${teamId} for profile ${profileId} (user ${userId})`); // Added logging

    // Get the platform team record
    const { data: platformTeam, error: teamError } = await supabaseClient
      .from('platform_teams')
      .select('*')
      .eq('id', teamId)
      .eq('platform', 'TeamSnap')
      .single();

    if (teamError || !platformTeam) {
      throw new Error('TeamSnap platform team not found');
    }

    // Get user's TeamSnap access token
    const { data: userSettings, error: settingsError } = await supabaseClient
      .from('user_settings')
      .select('teamsnap_access_token, teamsnap_refresh_token')
      .eq('user_id', userId)
      .single();

    if (settingsError || !userSettings?.teamsnap_access_token) {
      throw new Error('TeamSnap access token not found. User needs to reconnect to TeamSnap.');
    }

    let accessToken = userSettings.teamsnap_access_token;

    let userTimezone = 'UTC';
    try { // Added logging
      console.log(`[TeamSnap Sync] Attempting to fetch timezone for user: ${userId}`);
      
      // Use RPC function to get timezone directly by user_id
      console.log(`[TeamSnap Sync] Calling RPC 'get_user_timezone' with p_user_id: ${userId}`);
      const { data: timezoneResult, error: rpcError } = await supabaseClient.rpc('get_user_timezone', { 
        p_user_id: userId 
      });
      
      if (rpcError) {
        console.warn('[TeamSnap Sync] Error calling get_user_timezone RPC:', rpcError.message); // Added logging
        console.log('[TeamSnap Sync] Using default timezone UTC'); // Added logging
      } else if (timezoneResult) { // Added logging
        console.log(`[TeamSnap Sync] RPC returned timezone: ${timezoneResult}`); // Added logging
        userTimezone = timezoneResult;
      } else {
        console.log('[TeamSnap Sync] No timezone returned from RPC, using UTC');
      }
      console.log(`[TeamSnap Sync] Final userTimezone set to: ${userTimezone}`);
    } catch (error) {
      console.warn('[TeamSnap Sync] Exception getting user timezone, using UTC:', error);
    }

    // Helper function to make TeamSnap API requests
    const makeTeamSnapRequest = async (endpoint: string, token: string): Promise<any> => {
      const url = endpoint.startsWith('http') ? endpoint : `${TEAMSNAP_API_URL}${endpoint}`;
      console.log('Making TeamSnap API request to:', url); // Added logging

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('TeamSnap authentication expired');
        }
        throw new Error(`TeamSnap API request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    };

    // Helper function to refresh access token if needed
    const refreshAccessToken = async (refreshToken: string): Promise<string> => {
      const response = await fetch(TEAMSNAP_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: Deno.env.get('TEAMSNAP_CLIENT_ID') ?? '',
          client_secret: Deno.env.get('TEAMSNAP_CLIENT_SECRET') ?? '',
        }),
      });

      if (!response.ok) {
        console.error('Failed to refresh TeamSnap access token:', await response.text()); // Added logging
        throw new Error('Failed to refresh TeamSnap access token');
      }

      const tokenData = await response.json();
      
      // Update stored tokens
      await supabaseClient
        .from('user_settings')
        .update({
          teamsnap_access_token: tokenData.access_token,
          teamsnap_refresh_token: tokenData.refresh_token || refreshToken,
        })
        .eq('user_id', userId);

      return tokenData.access_token;
    };

    // Try to fetch team events, refresh token if needed // Added logging
    let teamEvents;
    try {
      teamEvents = await makeTeamSnapRequest(`/events/search?team_id=${platformTeam.team_id}`, accessToken);
    } catch (error) {
      if (error.message.includes('authentication expired') && userSettings.teamsnap_refresh_token) {
        console.log('Access token expired, attempting to refresh...');
        try {
          accessToken = await refreshAccessToken(userSettings.teamsnap_refresh_token);
          teamEvents = await makeTeamSnapRequest(`/events/search?team_id=${platformTeam.team_id}`, accessToken);
        } catch (refreshError) {
          throw new Error('Failed to refresh TeamSnap token and fetch events');
        }
      } else {
        throw error;
      }
    }

    // Handle different possible response structures from TeamSnap API
    let events: any[] = [];
    if (Array.isArray(teamEvents)) {
      events = teamEvents;
    } else if (teamEvents.collection && Array.isArray(teamEvents.collection.items)) {
      events = teamEvents.collection.items.map((item: any) => {
        if (item.data && Array.isArray(item.data)) {
          const eventObj: any = {};
          item.data.forEach((field: any) => {
            if (field.name && field.value !== undefined) {
              eventObj[field.name] = field.value;
            }
          });
          return eventObj;
        }
        return item;
      });
    } else if (teamEvents.data && Array.isArray(teamEvents.data)) {
      events = teamEvents.data;
    }

    console.log(`[TeamSnap Sync] Found ${events.length} events from TeamSnap API`);

    const googleMapsApiKey = Deno.env.get('VITE_GOOGLE_MAPS_API_KEY');
    console.log(`[TeamSnap Sync] Google Maps API key present: ${!!googleMapsApiKey}`);
    if (googleMapsApiKey) {
      const apiKeyMasked = googleMapsApiKey.length >= 8
        ? `${googleMapsApiKey.substring(0, 4)}...${googleMapsApiKey.substring(googleMapsApiKey.length - 4)}`
        : '[INVALID_KEY]';
      console.log(`[TeamSnap Sync] API key masked: ${apiKeyMasked}`);
    }

    // Fetch existing events with location data for comparison
    console.log(`[TeamSnap Sync] Fetching existing events from database...`);
    const { data: existingEventsData } = await supabaseClient
      .from('events')
      .select('id, external_id, location, location_name, geocoding_attempted')
      .eq('platform_team_id', teamId)
      .eq('platform', 'TeamSnap')
      .not('external_id', 'is', null);

    console.log(`[TeamSnap Sync] Found ${existingEventsData?.length || 0} existing events in database`);

    // Create map of external_id -> existing event data
    const existingEventsDataMap = new Map(
      existingEventsData?.map(e => [e.external_id, e]) || []
    );

    // Geocoding tracking counters
    const geocodingStats = {
      needsGeocode: 0,
      preserved: 0,
      geocoded: 0,
      failed: 0,
      noApiKey: 0,
      skippedAlreadyAttempted: 0
    };

    // Helper function to detect if an event is cancelled
    const isEventCancelled = (title: string, description: string, notes: string, formattedTitle: string): boolean => {
      const cancellationKeywords = /\b(cancel+ed|cancel|postponed?|rescheduled?)\b/i;
      const fieldsToCheck = [title, description, notes, formattedTitle].filter(field => field && field.trim() !== '');
      return fieldsToCheck.some(field => cancellationKeywords.test(field));
    };

    console.log(`[TeamSnap Sync] Starting event transformation with geocoding...`);

    // Log the first event's complete structure to understand what fields TeamSnap provides
    if (events.length > 0) {
      console.log(`[TeamSnap Sync] ========================================`);
      console.log(`[TeamSnap Sync] SAMPLE EVENT STRUCTURE (First Event):`);
      console.log(`[TeamSnap Sync] Event ID: ${events[0].id}`);
      console.log(`[TeamSnap Sync] All location-related fields:`);
      console.log(`[TeamSnap Sync]   - location: "${events[0].location || 'N/A'}"`);
      console.log(`[TeamSnap Sync]   - location_address: "${events[0].location_address || 'N/A'}"`);
      console.log(`[TeamSnap Sync]   - location_name: "${events[0].location_name || 'N/A'}"`);
      console.log(`[TeamSnap Sync]   - location_id: "${events[0].location_id || 'N/A'}"`);
      console.log(`[TeamSnap Sync] All fields in event object:`, Object.keys(events[0]).join(', '));
      console.log(`[TeamSnap Sync] ========================================`);
    }

    // Transform TeamSnap events for database storage
    const eventsToUpsert = await Promise.all(events.filter(event => event.start_date && event.id).map(async (event, index) => {
      console.log(`[TeamSnap Sync] -------- Event ${index + 1}/${events.length} (ID: ${event.id}) --------`);
      // Format the title based on event type and is_game flag
      let title = 'TeamSnap Event';

      if (event.type) {
        title = event.type.charAt(0).toUpperCase() + event.type.slice(1);
        if (event.is_game) {
          title += " Game";
        }
      } else if (event.is_game) {
        title = "Game";
      } else if (event.name) {
        title = event.name;
      }

      // Use formatted_title_for_multi_team for description if available
      let description = '';
      if (event.formatted_title_for_multi_team) {
        description = event.formatted_title_for_multi_team;
      } else if (event.notes) {
        description = event.notes;
      }

      // Detect if event is cancelled
      const isCancelled = isEventCancelled(
        title,
        description,
        event.notes || '',
        event.formatted_title_for_multi_team || ''
      );
      if (isCancelled) {
        console.log(`[TeamSnap Sync] Event ${event.id}: Detected as CANCELLED`);
      }

      // Map location fields from TeamSnap API:
      // TeamSnap provides location_name (venue name) but often doesn't provide the full address
      // We need to handle this by using location_name as both the display name AND the address if no address is available
      const venueNameFromApi = event.location_name || null;
      let locationAddress = event.location || event.location_address || '';

      // If we have a venue name but no address, use the venue name as the address for geocoding
      if (venueNameFromApi && !locationAddress) {
        locationAddress = venueNameFromApi;
        console.log(`[TeamSnap Sync] Event ${event.id}: No address provided, using venue name as address: "${locationAddress}"`);
      }

      let locationName: string | null = venueNameFromApi;
      let geocodingAttempted = false;

      console.log(`[TeamSnap Sync] Event ${event.id}: Raw API data:`, {
        location: event.location || 'N/A',
        location_address: event.location_address || 'N/A',
        location_name: event.location_name || 'N/A'
      });
      console.log(`[TeamSnap Sync] Event ${event.id}: Mapped values:`, {
        locationAddress,
        venueNameFromApi
      });

      const existingEvent = existingEventsDataMap.get(String(event.id));
      const locationChanged = !existingEvent || existingEvent.location !== locationAddress;
      const hasValidLocationName = (venueNameFromApi && venueNameFromApi.trim() !== '') || (existingEvent?.location_name && existingEvent.location_name.trim() !== '');
      const alreadyAttemptedGeocodingForSameLocation = existingEvent?.geocoding_attempted && !locationChanged;
      // Only geocode if we don't have a location name from the API and haven't successfully geocoded this address before
      const needsGeocode = locationAddress && locationAddress.trim() !== '' && !venueNameFromApi && (!hasValidLocationName || locationChanged) && !alreadyAttemptedGeocodingForSameLocation;

      console.log(`[TeamSnap Sync] Event ${event.id} geocoding decision:`);
      console.log(`[TeamSnap Sync]   - existingEvent: ${!!existingEvent}`);
      console.log(`[TeamSnap Sync]   - existing location: "${existingEvent?.location || 'N/A'}"`);
      console.log(`[TeamSnap Sync]   - existing location_name: "${existingEvent?.location_name || 'N/A'}"`);
      console.log(`[TeamSnap Sync]   - existing geocoding_attempted: ${existingEvent?.geocoding_attempted || false}`);
      console.log(`[TeamSnap Sync]   - locationChanged: ${locationChanged}`);
      console.log(`[TeamSnap Sync]   - hasValidLocationName: ${hasValidLocationName}`);
      console.log(`[TeamSnap Sync]   - alreadyAttemptedGeocodingForSameLocation: ${alreadyAttemptedGeocodingForSameLocation}`);
      console.log(`[TeamSnap Sync]   - needsGeocode: ${needsGeocode}`);

      if (needsGeocode && googleMapsApiKey) {
        geocodingStats.needsGeocode++;
        try {
          console.log(`[TeamSnap Sync] Event ${event.id}: Calling geocoding API for: "${locationAddress}"`);
          const geocodeResult = await geocodeAddress(locationAddress, googleMapsApiKey, supabaseClient, venueNameFromApi);
          locationName = geocodeResult.locationName;
          geocodingAttempted = true;
          if (locationName) {
            console.log(`[TeamSnap Sync] Event ${event.id}: ✓ Geocoded successfully: "${locationAddress}" -> "${locationName}"`);
            geocodingStats.geocoded++;
          } else {
            console.warn(`[TeamSnap Sync] Event ${event.id}: ⚠ No location name found for: "${locationAddress}"`);
            geocodingStats.failed++;
          }
        } catch (error) {
          console.error(`[TeamSnap Sync] Event ${event.id}: ✗ Geocoding exception for: "${locationAddress}"`, error);
          geocodingStats.failed++;
          geocodingAttempted = true;
        }
      } else if (needsGeocode && !googleMapsApiKey) {
        console.warn(`[TeamSnap Sync] Event ${event.id}: ⚠ Needs geocoding but API key is missing`);
        geocodingStats.noApiKey++;
      } else if (alreadyAttemptedGeocodingForSameLocation) {
        console.log(`[TeamSnap Sync] Event ${event.id}: Skipping geocoding - already attempted for this location`);
        geocodingStats.skippedAlreadyAttempted++;
        locationName = existingEvent.location_name;
        geocodingAttempted = true;
      } else if (hasValidLocationName && !locationChanged) {
        locationName = existingEvent.location_name;
        geocodingAttempted = true;
        console.log(`[TeamSnap Sync] Event ${event.id}: Preserving existing location_name: "${locationName}"`);
        geocodingStats.preserved++;
      } else if (!locationAddress || locationAddress.trim() === '') {
        console.log(`[TeamSnap Sync] Event ${event.id}: No location address, skipping geocoding`);
      } else if (venueNameFromApi) {
        console.log(`[TeamSnap Sync] Event ${event.id}: Using venue name from API: "${venueNameFromApi}"`);
        // When we have a venue name from API, we still want to save the location (which is now the venue name)
        // Mark as attempted since we have the location name from API
        geocodingAttempted = true;
      }

      // Reset geocoding_attempted to false when location changes
      if (locationChanged) {
        geocodingAttempted = false;
      } else if (existingEvent?.geocoding_attempted) {
        geocodingAttempted = true;
      }

      return {
        external_id: String(event.id),
        title: title,
        description: description,
        start_time: event.start_date,
        end_time: event.end_date || event.start_date,
        location: locationAddress,
        location_name: locationName,
        sport: platformTeam.sport || 'Unknown',
        color: platformTeam.sport_color || '#F97316',
        platform: 'TeamSnap',
        platform_color: '#F97316',
        platform_team_id: teamId,
        profile_id: profileId,
        visibility: 'public',
        is_cancelled: isCancelled,
        geocoding_attempted: geocodingAttempted
      };
    }));

    console.log(`[TeamSnap Sync] ========================================`);
    console.log(`[TeamSnap Sync] GEOCODING SUMMARY:`);
    console.log(`[TeamSnap Sync]   - Needed geocoding: ${geocodingStats.needsGeocode}`);
    console.log(`[TeamSnap Sync]   - Successfully geocoded: ${geocodingStats.geocoded}`);
    console.log(`[TeamSnap Sync]   - Preserved existing: ${geocodingStats.preserved}`);
    console.log(`[TeamSnap Sync]   - Failed to geocode: ${geocodingStats.failed}`);
    console.log(`[TeamSnap Sync]   - Skipped (already attempted): ${geocodingStats.skippedAlreadyAttempted}`);
    console.log(`[TeamSnap Sync]   - Missing API key: ${geocodingStats.noApiKey}`);
    console.log(`[TeamSnap Sync] ========================================`);
    console.log(`[TeamSnap Sync] Transformed ${eventsToUpsert.length} valid events for database upsert`);

    // Get external IDs of events from API
    const apiEventIds = eventsToUpsert.map(e => e.external_id);

    // Delete events that no longer exist in the API response
    // This preserves events that still exist (and their messages) while removing stale ones
    // IMPORTANT: Only delete events with external_id (synced events), never manually created events
    if (apiEventIds.length > 0) {
      console.log('Deleting stale TeamSnap events not in API response...');

      // Get all synced events for this team to find which ones to delete
      const { data: existingEvents } = await supabaseClient
        .from('events')
        .select('id, external_id')
        .eq('platform_team_id', teamId)
        .eq('platform', 'TeamSnap')
        .not('external_id', 'is', null); // Only get synced events

      if (existingEvents && existingEvents.length > 0) {
        // Find events that exist in DB but not in API response
        const eventsToDelete = existingEvents
          .filter(e => !apiEventIds.includes(e.external_id))
          .map(e => e.id);

        if (eventsToDelete.length > 0) {
          console.log(`Deleting ${eventsToDelete.length} stale events`);
          const { error: deleteError } = await supabaseClient
            .from('events')
            .delete()
            .in('id', eventsToDelete);

          if (deleteError) {
            console.warn('Error deleting stale events:', deleteError.message);
          }
        } else {
          console.log('No stale events to delete');
        }
      }
    } else {
      // No events from API, delete only synced platform events for this team (preserve manual events)
      console.log('No events from API, deleting synced TeamSnap events for this team...');
      await supabaseClient
        .from('events')
        .delete()
        .eq('platform_team_id', teamId)
        .eq('platform', 'TeamSnap')
        .not('external_id', 'is', null); // Only delete synced events, preserve manual ones
    }

    // Upsert events (insert new, update existing)
    if (eventsToUpsert.length > 0) {
      console.log('Upserting TeamSnap events...');

      // Create a map of external_id -> event_id for quick lookup (reuse existing data)
      const existingEventsMap = new Map(
        existingEventsData?.map(e => [e.external_id, e.id]) || []
      );

      // Add existing event IDs to the upsert payload to preserve them
      const eventsWithIds = eventsToUpsert.map(event => ({
        ...event,
        // If event exists, use its ID to update it; otherwise let DB generate new ID
        ...(existingEventsMap.has(event.external_id) ? { id: existingEventsMap.get(event.external_id) } : {})
      }));

      // Use raw SQL for proper upsert with external_id
      for (const event of eventsWithIds) {
        const { error: upsertError } = await supabaseClient
          .from('events')
          .upsert(event, {
            onConflict: 'platform,platform_team_id,external_id',
            ignoreDuplicates: false
          });

        if (upsertError) {
          console.error('Error upserting event:', event.external_id, upsertError);
          throw upsertError;
        }
      }

      console.log(`Successfully upserted ${eventsWithIds.length} events`);
    } else {
      console.log('No events to upsert');
    }

    console.log(`Successfully synced ${eventsToUpsert.length} TeamSnap events for profile ${profileId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'TeamSnap calendar synced successfully',
        eventCount: eventsToUpsert.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in sync-teamsnap-calendar:', error);
    
    // Update team sync status to error
    try {
      // Access teamId from the 'body' variable if it was successfully parsed
      const currentTeamId = body?.teamId;
      
      if (currentTeamId) {
        const supabaseClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
          {
            auth: {
              persistSession: false,
            }
          }
        );
        
        await supabaseClient
          .from('platform_teams')
          .update({
            sync_status: 'error',
            last_synced: new Date().toISOString()
          })
          .eq('id', currentTeamId);
      }
    } catch (updateError) {
      console.error('Error updating team sync status to error:', updateError);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
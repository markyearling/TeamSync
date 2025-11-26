import ICAL from 'npm:ical.js@1.5.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { DateTime } from 'npm:luxon@3.4.4';
import { geocodeAddress } from '../_shared/geocoding.ts';

const getSportDetails = (sportName: string) => {
  const sportColors: Record<string, string> = {
    'Soccer': '#10B981',
    'Baseball': '#F59E0B',
    'Basketball': '#EF4444',
    'Baseball': '#F59E0B',
    'Basketball': '#EF4444',
    'Swimming': '#3B82F6',
    'Swimming': '#3B82F6',
    'Tennis': '#8B5CF6',
    'Volleyball': '#EC4899',
    'Football': '#6366F1',
    'Hockey': '#14B8A6',
    'Lacrosse': '#F97316',
    'Track': '#06B6D4',
    'Golf': '#84CC16',
    'Gymnastics': '#F43F5E',
    'Wrestling': '#8B5CF6',
    'Cross Country': '#059669',
    'Unknown': '#64748B',
    'Other': '#64748B'
  };
  
  return {
    name: sportName,
    color: sportColors[sportName] || '#64748B'
  };
};

const corsHeaders = { // Define globally
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// This function is executed at the very top level.
console.log("sync-playmetrics-calendar: Function file loaded.");

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  let body: ICSRequestBody | null = null; // Declare body outside try block
  
  try {
    // Get request body
    body = await req.json(); // Assign to the outer-scoped variable
    console.log('Received request body:', body);

    const { icsUrl, teamId, profileId }: ICSRequestBody = body;

    if (!icsUrl || !teamId) {
      console.error('Missing parameters:', { icsUrl, teamId, profileId });
      throw new Error('Missing required parameters: icsUrl or teamId');
    }

    console.log('Fetching ICS file from:', icsUrl);

    // Convert webcal:// to https:// if needed
    let fetchUrl = icsUrl;
    if (fetchUrl.startsWith('webcal://')) {
      fetchUrl = fetchUrl.replace('webcal://', 'https://');
      console.log('Converted webcal URL to https for fetching:', fetchUrl);
    }

    // Fetch ICS file
    const response = await fetch(fetchUrl, {
      headers: {
        'Accept': 'text/calendar',
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) {
      console.error('Failed to fetch ICS file:', {
        status: response.status,
        statusText: response.statusText,
        url: fetchUrl
      });
      throw new Error(`Failed to fetch calendar: ${response.status} ${response.statusText}`);
    }

    // Parse ICS data
    const icsData = await response.text();
    console.log('Successfully fetched ICS data, length:', icsData.length);

    try {
      const jCalData = ICAL.parse(icsData);
      const comp = new ICAL.Component(jCalData);
      
      // Extract calendar name from X-WR-CALNAME property or use a fallback
      let calendarName = comp.getFirstPropertyValue('x-wr-calname') || 
                        comp.getFirstPropertyValue('name') ||
                        comp.getFirstPropertyValue('summary');
      
      // If no calendar name found, try to extract from the first event
      if (!calendarName) {
        const vevents = comp.getAllSubcomponents('vevent');
        if (vevents.length > 0) {
          const firstEvent = new ICAL.Event(vevents[0]);
          // Try to extract team name from event summary or location
          const summary = firstEvent.summary || '';
          const location = firstEvent.location || '';
          
          // Look for common team name patterns
          const teamMatch = summary.match(/vs\s+(.+?)(?:\s|$)/i) || 
                           summary.match(/(.+?)\s+vs/i) ||
                           location.match(/(.+?)\s+(?:field|court|gym)/i);
          
          if (teamMatch) {
            calendarName = teamMatch[1].trim();
          }
        }
      }
      
      // Clean up the calendar name
      if (calendarName) {
        calendarName = calendarName
          .replace(/calendar/i, '')
          .replace(/schedule/i, '')
          .trim();
      }
      
      // Fallback to URL-based name if still no name found
      if (!calendarName) {
        const teamIdFromUrl = icsUrl.split('/team/')[1]?.split('-')[0];
        calendarName = `Team ${teamIdFromUrl}`;
      }
      
      console.log('Extracted calendar name:', calendarName);
      
      const vevents = comp.getAllSubcomponents('vevent');
      console.log('Successfully parsed ICS data, found events:', vevents.length);

      // Initialize Supabase client
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        {
          auth: {
            persistSession: false,
          }
        }
      );

      // Update team name in platform_teams table
      console.log('Updating team name to:', calendarName);
      const { data: teamUpdateData, error: teamUpdateError } = await supabaseClient
        .from('platform_teams')
        .update({
          team_name: calendarName,
          sync_status: 'success',
          last_synced: new Date().toISOString()
        })
        .eq('id', teamId);

      if (teamUpdateError) {
        console.error('Error updating team name:', teamUpdateError);
        // Don't throw here, continue with event sync
      } else {
        console.log('Successfully updated team name:', teamUpdateData);
      }

      // If no profileId provided, just return the team info (for initial sync)
      if (!profileId) {
        console.log('No profile ID provided, returning team info only');
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Team calendar synced successfully', 
            eventCount: vevents.length,
            teamName: calendarName
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }

      // Get sport and color from team record
      const { data: teamData, error: teamFetchError } = await supabaseClient
        .from('platform_teams')
        .select('sport, sport_color')
        .eq('id', teamId)
        .single();
        
      const sport = teamData?.sport || 'Soccer';
      const sportColor = teamData?.sport_color || getSportDetails(sport).color;

      let userTimezone = 'UTC';
      let profileUserId: string | null = null;

      try {
        // First, get the user_id associated with the profile_id
        console.log(`[Playmetrics Sync] Fetching user_id for profile: ${profileId}`);
        const { data: profileData, error: profileFetchError } = await supabaseClient
          .from('profiles')
          .select('user_id')
          .eq('id', profileId)
          .single();
        
        if (profileFetchError) {
          console.warn(`[Playmetrics Sync] Error fetching user_id for profile ${profileId}:`, profileFetchError.message);
          console.log('[Playmetrics Sync] Using default timezone UTC due to profile fetch error');
        } else if (profileData) {
          profileUserId = profileData.user_id;
          console.log(`[Playmetrics Sync] Found user_id ${profileUserId} for profile ${profileId}`);
        } else {
          console.log('[Playmetrics Sync] No profile data returned, using UTC');
        }

        if (profileUserId && typeof profileUserId === 'string' && profileUserId.trim() !== '') {
          console.log(`[Playmetrics Sync] Calling RPC 'get_user_timezone' with p_user_id: ${profileUserId}`); // Added logging
          try {
            const { data: timezoneResult, error: rpcError } = await supabaseClient.rpc('get_user_timezone', {
              p_user_id: profileUserId 
            });
          
            if (rpcError) {
              console.warn(`[Playmetrics Sync] Error calling get_user_timezone RPC for user ${profileUserId}:`, rpcError.message);
              console.log('[Playmetrics Sync] Using default timezone UTC due to RPC error');
            } else if (timezoneResult && typeof timezoneResult === 'string') {
              console.log(`[Playmetrics Sync] RPC returned timezone: ${timezoneResult}`);
              userTimezone = timezoneResult;
            } else {
              console.log(`[Playmetrics Sync] RPC returned invalid timezone result: ${timezoneResult}, using UTC`);
            }
          } catch (rpcException) {
            console.warn(`[Playmetrics Sync] Exception calling get_user_timezone RPC for user ${profileUserId}:`, rpcException);
            console.log('[Playmetrics Sync] Using default timezone UTC due to RPC exception');
          }
        } else {
          console.log('[Playmetrics Sync] profileUserId is null, skipping RPC call and using UTC');
        }
        console.log(`[Playmetrics Sync] Final userTimezone set to: ${userTimezone}`);
      } catch (error) {
        console.warn('[Playmetrics Sync] Exception getting user timezone, using UTC:', error);
      }

      // Helper function to detect if an event is cancelled
      const isEventCancelled = (title: string, description: string, summary: string): boolean => {
        const cancellationKeywords = /\b(cancel+ed|cancel|postponed?|rescheduled?)\b/i;
        const fieldsToCheck = [title, description, summary].filter(field => field && field.trim() !== '');
        return fieldsToCheck.some(field => cancellationKeywords.test(field));
      };

      // Transform events for the specific profile
      const events = vevents.filter(vevent => {
        // Pre-filter events with valid dates
        try {
          const event = new ICAL.Event(vevent);
          const startDate = event.startDate.toJSDate();
          const endDate = event.endDate.toJSDate();
          
          // Check if dates are valid
          if (isNaN(startDate.getTime())) {
            console.warn('Skipping event with invalid start date:', event.summary);
            return false;
          }
          
          return true;
        } catch (error) {
          console.warn('Skipping event due to parsing error:', error);
          return false;
        }
      }).map(vevent => {
        const event = new ICAL.Event(vevent);
        
        // Extract event type and opponent from summary
        let eventType = "Event";
        let opponent = null;
        const summary = event.summary || '';
        
        // Check for game vs opponent pattern
        const vsPattern = /\b(vs\.?|versus)\s+([^,]+)/i;
        const vsMatch = summary.match(vsPattern);
        
        // Check for "at" pattern (e.g., "Team at Opponent")
        const atPattern = /\b([^@]+?)\s+at\s+([^,]+)/i;
        const atMatch = summary.match(atPattern);
        
        // Determine if it's a game and extract opponent
        if (summary.toLowerCase().includes('game') || 
            vsMatch || 
            atMatch || 
            summary.toLowerCase().includes('match')) {
          eventType = 'Game';
          
          if (vsMatch) {
            opponent = vsMatch[2].trim();
          } else if (atMatch) {
            // If format is "Team at Opponent", the opponent is the second group
            opponent = atMatch[2].trim();
          }
        } else if (summary.toLowerCase().includes('practice')) {
          eventType = 'Practice';
        } else if (summary.toLowerCase().includes('tournament')) {
          eventType = 'Tournament';
        }
        
        // Create a more detailed title
        let title = eventType;
        if (eventType === 'Game' && opponent) {
          title = `Game vs ${opponent}`;
        }
        
        // Create a more detailed description
        let description = event.description || '';
        if (summary && !description.includes(summary)) {
          if (description) {
            description = `${summary}\n\n${description}`;
          } else {
            description = summary;
          }
        }
        
        // If opponent found but not in description, add it
        if (opponent && !description.toLowerCase().includes('opponent') && !description.includes(opponent)) {
          description = description
            ? `${description}\n\nOpponent: ${opponent}`
            : `Opponent: ${opponent}`;
        }

        // Detect if event is cancelled
        const isCancelled = isEventCancelled(title, description, summary);
        if (isCancelled) {
          console.log(`[Playmetrics Sync] Event detected as CANCELLED: ${title}`);
        }

        // Improved timezone handling
        console.log(`Processing event: ${title}`);
        
        // Extract date/time components directly from ical.js objects
        const startYear = event.startDate.year;
        const startMonth = event.startDate.month;
        const startDay = event.startDate.day;
        const startHour = event.startDate.hour;
        const startMinute = event.startDate.minute;
        const startSecond = event.startDate.second;
        
        const endYear = event.endDate.year;
        const endMonth = event.endDate.month;
        const endDay = event.endDate.day;
        const endHour = event.endDate.hour;
        const endMinute = event.endDate.minute;
        const endSecond = event.endDate.second;
        
        console.log(`Event date components:
          Start: ${startYear}-${startMonth}-${startDay} ${startHour}:${startMinute}:${startSecond}
          End: ${endYear}-${endMonth}-${endDay} ${endHour}:${endMinute}:${endSecond}
          Timezone: ${event.startDate.timezone || 'floating'}
          IsFloating: ${event.startDate.isFloating}`);
        
        let startDateTime, endDateTime;
        
        // Robust timezone handling based on ical.js properties
        if (event.startDate.timezone === 'Z') {
          // This is explicitly UTC
          console.log('Event is in UTC timezone');
          startDateTime = DateTime.utc(startYear, startMonth, startDay, startHour, startMinute, startSecond);
          endDateTime = DateTime.utc(endYear, endMonth, endDay, endHour, endMinute, endSecond);
        } else if (event.startDate.timezone && !event.startDate.isFloating) {
          // This has a specific timezone (TZID)
          console.log(`Event has specific timezone: ${event.startDate.timezone}`);
          startDateTime = DateTime.fromObject(
            { year: startYear, month: startMonth, day: startDay, hour: startHour, minute: startMinute, second: startSecond },
            { zone: event.startDate.timezone }
          );
          endDateTime = DateTime.fromObject(
            { year: endYear, month: endMonth, day: endDay, hour: endHour, minute: endMinute, second: endSecond },
            { zone: event.endDate.timezone || event.startDate.timezone }
          );
        } else {
          // This is a floating time, interpret in user's timezone
          console.log(`Event has floating time, interpreting in user timezone: ${userTimezone}`);
          startDateTime = DateTime.fromObject(
            { year: startYear, month: startMonth, day: startDay, hour: startHour, minute: startMinute, second: startSecond },
            { zone: userTimezone }
          );
          endDateTime = DateTime.fromObject(
            { year: endYear, month: endMonth, day: endDay, hour: endHour, minute: endMinute, second: endSecond },
            { zone: userTimezone }
          );
        }
        
        // If end date components are invalid, default to 1 hour after start
        if (!endDateTime.isValid) {
          console.warn(`Invalid end date for event: ${title}, defaulting to 1 hour after start`);
          endDateTime = startDateTime.plus({ hours: 1 });
        }
        
        // Validate Luxon DateTime objects
        if (!startDateTime.isValid) {
          console.error(`Invalid Luxon start DateTime for event: ${title}`, startDateTime.invalidReason);
          throw new Error(`Invalid start date-time for event: ${title}`);
        }
        
        if (!endDateTime.isValid) {
          console.error(`Invalid Luxon end DateTime for event: ${title}`, endDateTime.invalidReason);
          throw new Error(`Invalid end date-time for event: ${title}`);
        }
        
        // Convert to UTC for storage
        const startTimeUTC = startDateTime.toUTC().toISO();
        const endTimeUTC = endDateTime.toUTC().toISO();
        
        console.log(`Converted times:
          Start: ${startDateTime.toString()} -> UTC: ${startTimeUTC}
          End: ${endDateTime.toString()} -> UTC: ${endTimeUTC}`);
        
        return {
          external_id: event.uid || `${event.summary}-${startTimeUTC}`,
          title: title,
          description: description,
          start_time: startTimeUTC,
          end_time: endTimeUTC,
          location: event.location || '',
          sport: sport,
          color: sportColor, // Use custom color or default
          platform: 'Playmetrics',
          platform_color: '#10B981',
          profile_id: profileId,
          platform_team_id: teamId,
          visibility: 'public', // Platform-synced events default to public
          is_cancelled: isCancelled
        };
      });

      console.log('[Playmetrics Sync] Transformed events:', events.length);

      const googleMapsApiKey = Deno.env.get('VITE_GOOGLE_MAPS_API_KEY');
      console.log(`[Playmetrics Sync] Google Maps API key present: ${!!googleMapsApiKey}`);
      if (googleMapsApiKey) {
        const apiKeyMasked = googleMapsApiKey.length >= 8
          ? `${googleMapsApiKey.substring(0, 4)}...${googleMapsApiKey.substring(googleMapsApiKey.length - 4)}`
          : '[INVALID_KEY]';
        console.log(`[Playmetrics Sync] API key masked: ${apiKeyMasked}`);
      }

      // Fetch existing events with location data for comparison
      console.log('[Playmetrics Sync] Fetching existing events from database...');
      const { data: existingEventsData } = await supabaseClient
        .from('events')
        .select('id, external_id, location, location_name, geocoding_attempted')
        .eq('platform_team_id', teamId)
        .eq('platform', 'Playmetrics')
        .eq('profile_id', profileId)
        .not('external_id', 'is', null);

      console.log(`[Playmetrics Sync] Found ${existingEventsData?.length || 0} existing events in database`);

      // Create map of external_id -> existing event data
      const existingEventsDataMap = new Map(
        existingEventsData?.map(e => [e.external_id, e]) || []
      );

      const geocodingStats = {
        needsGeocode: 0,
        preserved: 0,
        geocoded: 0,
        failed: 0,
        noApiKey: 0,
        skippedAlreadyAttempted: 0
      };

      console.log('[Playmetrics Sync] Starting event enrichment with geocoding...');

      const enrichedEvents = await Promise.all(events.map(async (event, index) => {
        console.log(`[Playmetrics Sync] -------- Event ${index + 1}/${events.length} (ID: ${event.external_id}) --------`);
        console.log(`[Playmetrics Sync] Event location: "${event.location || 'N/A'}"`);
        const existingEvent = existingEventsDataMap.get(event.external_id);
        const locationChanged = !existingEvent || existingEvent.location !== event.location;
        const hasValidLocationName = existingEvent?.location_name && existingEvent.location_name.trim() !== '';
        const alreadyAttemptedGeocodingForSameLocation = existingEvent?.geocoding_attempted && !locationChanged;
        const needsGeocode = event.location && event.location.trim() !== '' && (!hasValidLocationName || locationChanged) && !alreadyAttemptedGeocodingForSameLocation;

        console.log(`[Playmetrics Sync] Event ${event.external_id} geocoding decision:`);
        console.log(`[Playmetrics Sync]   - existingEvent: ${!!existingEvent}`);
        console.log(`[Playmetrics Sync]   - existing location: "${existingEvent?.location || 'N/A'}"`);
        console.log(`[Playmetrics Sync]   - existing location_name: "${existingEvent?.location_name || 'N/A'}"`);
        console.log(`[Playmetrics Sync]   - existing geocoding_attempted: ${existingEvent?.geocoding_attempted || false}`);
        console.log(`[Playmetrics Sync]   - locationChanged: ${locationChanged}`);
        console.log(`[Playmetrics Sync]   - hasValidLocationName: ${hasValidLocationName}`);
        console.log(`[Playmetrics Sync]   - alreadyAttemptedGeocodingForSameLocation: ${alreadyAttemptedGeocodingForSameLocation}`);
        console.log(`[Playmetrics Sync]   - needsGeocode: ${needsGeocode}`);

        if (needsGeocode && googleMapsApiKey) {
          geocodingStats.needsGeocode++;
          try {
            console.log(`[Playmetrics Sync] Event ${event.external_id}: Calling geocoding API for: "${event.location}"`);
            const geocodeResult = await geocodeAddress(event.location, googleMapsApiKey, supabaseClient);
            if (geocodeResult.locationName) {
              console.log(`[Playmetrics Sync] Event ${event.external_id}: ✓ Geocoded successfully: "${event.location}" -> "${geocodeResult.locationName}"`);
              geocodingStats.geocoded++;
              return { ...event, location_name: geocodeResult.locationName, geocoding_attempted: true };
            } else {
              console.warn(`[Playmetrics Sync] Event ${event.external_id}: ⚠ No location name found for: "${event.location}"`);
              geocodingStats.failed++;
              return { ...event, geocoding_attempted: true };
            }
          } catch (error) {
            console.error(`[Playmetrics Sync] Event ${event.external_id}: ✗ Geocoding exception for: "${event.location}"`, error);
            geocodingStats.failed++;
            return { ...event, geocoding_attempted: true };
          }
        } else if (needsGeocode && !googleMapsApiKey) {
          console.warn(`[Playmetrics Sync] Event ${event.external_id}: ⚠ Needs geocoding but API key is missing`);
          geocodingStats.noApiKey++;
        } else if (alreadyAttemptedGeocodingForSameLocation) {
          console.log(`[Playmetrics Sync] Event ${event.external_id}: Skipping geocoding - already attempted for this location`);
          geocodingStats.skippedAlreadyAttempted++;
          if (hasValidLocationName) {
            return { ...event, location_name: existingEvent.location_name, geocoding_attempted: true };
          }
          return { ...event, geocoding_attempted: true };
        } else if (hasValidLocationName && !locationChanged) {
          console.log(`[Playmetrics Sync] Event ${event.external_id}: Preserving existing location_name: "${existingEvent.location_name}"`);
          geocodingStats.preserved++;
          return { ...event, location_name: existingEvent.location_name, geocoding_attempted: true };
        } else if (!event.location || event.location.trim() === '') {
          console.log(`[Playmetrics Sync] Event ${event.external_id}: No location address, skipping geocoding`);
        }
        // Reset geocoding_attempted to false when location changes
        return { ...event, geocoding_attempted: locationChanged ? false : (existingEvent?.geocoding_attempted || false) };
      }));

      console.log(`[Playmetrics Sync] ========================================`);
      console.log(`[Playmetrics Sync] GEOCODING SUMMARY:`);
      console.log(`[Playmetrics Sync]   - Needed geocoding: ${geocodingStats.needsGeocode}`);
      console.log(`[Playmetrics Sync]   - Successfully geocoded: ${geocodingStats.geocoded}`);
      console.log(`[Playmetrics Sync]   - Preserved existing: ${geocodingStats.preserved}`);
      console.log(`[Playmetrics Sync]   - Failed to geocode: ${geocodingStats.failed}`);
      console.log(`[Playmetrics Sync]   - Skipped (already attempted): ${geocodingStats.skippedAlreadyAttempted}`);
      console.log(`[Playmetrics Sync]   - Missing API key: ${geocodingStats.noApiKey}`);
      console.log(`[Playmetrics Sync] ========================================`);

      // Deduplicate events based on the unique constraint fields
      const uniqueEvents = new Map();
      enrichedEvents.forEach(event => {
        const key = `${event.platform}-${event.platform_team_id}-${event.external_id}`;
        if (!uniqueEvents.has(key)) {
          uniqueEvents.set(key, event);
        }
      });

      const deduplicatedEvents = Array.from(uniqueEvents.values());
      console.log('Deduplicated events:', deduplicatedEvents.length, 'from original:', events.length);

      const apiEventIds = deduplicatedEvents.map(e => e.external_id);
      if (apiEventIds.length > 0) {
        if (existingEventsData && existingEventsData.length > 0) {
          const eventsToDelete = existingEventsData.filter(e => !apiEventIds.includes(e.external_id)).map(e => e.id);
          if (eventsToDelete.length > 0) {
            await supabaseClient.from('events').delete().in('id', eventsToDelete);
          }
        }
      }

      if (deduplicatedEvents.length > 0) {
        // Create a map of external_id -> event_id for quick lookup (reuse existing data)
        const existingEventsMap = new Map(existingEventsData?.map(e => [e.external_id, e.id]) || []);
        const eventsWithIds = deduplicatedEvents.map(event => ({...event, ...(existingEventsMap.has(event.external_id) ? { id: existingEventsMap.get(event.external_id) } : {})}));
        for (const event of eventsWithIds) {
          const { error: upsertError } = await supabaseClient.from('events').upsert(event, {onConflict: 'platform,platform_team_id,external_id', ignoreDuplicates: false});
          if (upsertError) throw upsertError;
        }
        console.log(`Successfully upserted ${eventsWithIds.length} events`);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Calendar synced successfully', 
          eventCount: deduplicatedEvents.length,
          teamName: calendarName
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );

    } catch (parseError) {
      console.error('Error parsing ICS data:', parseError);
      throw new Error(`Failed to parse calendar data: ${parseError.message}`);
    }

  } catch (error) {
    console.error('Error in sync-playmetrics-calendar:', { // Log the error object
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      teamId: body?.teamId || 'N/A' // Safely access teamId if 'body' was parsed
    });

    try {
      // Access teamId directly from the 'body' variable if it was successfully parsed
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
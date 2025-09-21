import ICAL from 'npm:ical.js@1.5.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { DateTime } from 'npm:luxon@3.4.4';

// This function is executed at the very top level.
console.log("sync-sportsengine-calendar: Function file loaded.");

const getSportDetails = (sportName: string) => {
  const sportColors: Record<string, string> = {
    'Soccer': '#10B981',
    'Baseball': '#F59E0B',
    'Basketball': '#EF4444',
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

Deno.serve(async (req) => {
  // Define CORS headers inside the handler
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Get request body
    const body = await req.json();
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
        // Extract team ID from URL, handling both .ics and non-ics URLs
        let teamIdFromUrl;
        if (icsUrl.includes('.ics')) {
          teamIdFromUrl = icsUrl.split('/').pop()?.split('.')[0];
        } else {
          // For webcal URLs without .ics extension, try to extract the last path segment
          teamIdFromUrl = icsUrl.split('/').pop();
        }
        calendarName = `SportsEngine Team ${teamIdFromUrl}`;
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

      // Get sport from team record
      const { data: teamData, error: teamFetchError } = await supabaseClient
        .from('platform_teams')
        .select('sport, sport_color')
        .eq('id', teamId)
        .single();
        
      const sport = teamData?.sport || 'Unknown';
      const sportColor = teamData?.sport_color || getSportDetails(sport).color;

      let userTimezone = 'UTC';
      let profileUserId: string | null = null;

      try {
        // First, get the user_id associated with the profile_id
        console.log(`[SportsEngine Sync] Fetching user_id for profile: ${profileId}`);
        const { data: profileData, error: profileFetchError } = await supabaseClient
          .from('profiles')
          .select('user_id')
          .eq('id', profileId)
          .single();

        if (profileFetchError) {
          console.warn(`[SportsEngine Sync] Error fetching user_id for profile ${profileId}:`, profileFetchError.message);
          // Fallback to UTC if profile not found or error
        } else if (profileData) {
          profileUserId = profileData.user_id;
          console.log(`[SportsEngine Sync] Found user_id ${profileUserId} for profile ${profileId}`);
        }

        if (profileUserId) {
          console.log(`[SportsEngine Sync] Calling RPC 'get_user_timezone' with p_user_id: ${profileUserId}`);
          const { data: timezoneResult, error: rpcError } = await supabaseClient.rpc('get_user_timezone', {
            p_user_id: profileUserId 
          });
          
          if (rpcError) {
            console.warn('[SportsEngine Sync] Error calling get_user_timezone RPC:', rpcError.message);
            console.log('[SportsEngine Sync] Using default timezone UTC');
          } else if (timezoneResult) {
            console.log(`[SportsEngine Sync] RPC returned timezone: ${timezoneResult}`);
            userTimezone = timezoneResult;
          } else {
            console.log('[SportsEngine Sync] No timezone returned from RPC, using UTC');
          }
        } else {
          console.log('[SportsEngine Sync] No user_id found for profile, using UTC');
        }
        console.log(`[SportsEngine Sync] Final userTimezone set to: ${userTimezone}`);
      } catch (error) {
        console.warn('[SportsEngine Sync] Exception getting user timezone, using UTC:', error);
      }
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
        
        // Check for home/away pattern (e.g., "Team (Home) vs Opponent")
        const homeAwayPattern = /\((?:home|away)\)\s*(?:vs\.?|versus)\s+([^,]+)/i;
        const homeAwayMatch = summary.match(homeAwayPattern);
        
        // Determine if it's a game and extract opponent
        if (summary.toLowerCase().includes('game') || 
            vsMatch || 
            atMatch || 
            homeAwayMatch ||
            summary.toLowerCase().includes('match')) {
          eventType = 'Game';
          
          if (vsMatch) {
            opponent = vsMatch[2].trim();
          } else if (atMatch) {
            // If format is "Team at Opponent", the opponent is the second group
            opponent = atMatch[2].trim();
          } else if (homeAwayMatch) {
            opponent = homeAwayMatch[1].trim();
          }
        } else if (summary.toLowerCase().includes('practice')) {
          eventType = 'Practice';
        } else if (summary.toLowerCase().includes('tournament')) {
          eventType = 'Tournament';
        } else if (summary.toLowerCase().includes('scrimmage')) {
          eventType = 'Scrimmage';
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
        
        // Extract location name from location string
        let locationName = event.location || '';
        let locationAddress = event.location || '';

        // Heuristic: if location contains a comma, assume part before is name
        if (locationName.includes(',')) {
          const parts = locationName.split(',');
          locationName = parts[0].trim();
          locationAddress = event.location; // Keep full original location as address
        } else {
          // If no comma, name is the same as the full location
          locationName = event.location || '';
          locationAddress = event.location || '';
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
          title: title,
          description: description,
          start_time: startTimeUTC,
          end_time: endTimeUTC,
          location: locationAddress,
          location_name: locationName,
          sport: sport,
          color: sportColor, // Use custom color or default
          platform: 'SportsEngine',
          platform_color: '#2563EB',
          profile_id: profileId,
          platform_team_id: teamId,
          visibility: 'public' // Platform-synced events default to public
        };
      });

      console.log('Transformed events:', events.length);

      // Deduplicate events based on the unique constraint fields
      const uniqueEvents = new Map();
      events.forEach(event => {
        const key = `${event.platform}-${event.platform_team_id}-${event.start_time}-${event.end_time}`;
        if (!uniqueEvents.has(key)) {
          uniqueEvents.set(key, event);
        }
      });

      const deduplicatedEvents = Array.from(uniqueEvents.values());
      console.log('Deduplicated events:', deduplicatedEvents.length, 'from original:', events.length);

      // Delete existing events for this profile and team to avoid duplicates
      console.log('Deleting existing events for profile:', profileId, 'and team:', teamId);
      const { error: deleteError } = await supabaseClient
        .from('events')
        .delete()
        .eq('platform_team_id', teamId);

      if (deleteError) {
        console.error('Error deleting existing events:', deleteError);
        throw new Error(`Failed to delete existing events: ${deleteError.message}`);
      }

      // Insert new events
      if (deduplicatedEvents.length > 0) {
        console.log('Inserting new events into database');
        const { data: eventsData, error: eventsError } = await supabaseClient
          .from('events')
          .insert(deduplicatedEvents);

        if (eventsError) {
          console.error('Error inserting events:', eventsError);
          throw eventsError;
        }

        console.log('Successfully inserted events:', eventsData);
      } else {
        console.log('No events to insert');
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
    console.error('Error in sync-sportsengine-calendar:', { // Log the error object
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
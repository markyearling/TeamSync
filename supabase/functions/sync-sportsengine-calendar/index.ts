import ICAL from 'npm:ical.js@1.5.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { DateTime } from 'npm:luxon@3.4.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface ICSRequestBody {
  icsUrl: string;
  teamId: string;
  profileId: string | null;
}

Deno.serve(async (req) => {
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
        .select('sport')
        .eq('id', teamId)
        .single();
        
      const sport = teamData?.sport || 'Unknown';

      // Get user's timezone from settings
      let userTimezone = 'UTC';
      try {
        // First get the user_id from the profile
        const { data: profileData, error: profileError } = await supabaseClient
          .from('profiles')
          .select('user_id')
          .eq('id', profileId)
          .single();
          
        if (profileError) throw profileError;
        
        // Then get the timezone from user_settings
        const { data: userSettings, error: settingsError } = await supabaseClient
          .from('user_settings')
          .select('timezone')
          .eq('user_id', profileData.user_id)
          .single();
          
        if (settingsError) throw settingsError;
        
        userTimezone = userSettings?.timezone || 'UTC';
        console.log(`Using user timezone: ${userTimezone}`);
      } catch (error) {
        console.error('Error getting user timezone, using UTC:', error);
      }

      // Transform events for the specific profile
      const events = vevents.map(vevent => {
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
        
        // Improved timezone handling
        console.log(`Processing event: ${title}`);
        console.log(`Original event timezone: ${event.startDate.timezone}`);
        
        let startDateTime, endDateTime;
        
        // Check if the event has a specific timezone
        if (event.startDate.timezone === 'Z') {
          // This is already in UTC
          console.log('Event is in UTC timezone');
          startDateTime = DateTime.fromObject({
            year: event.startDate.year,
            month: event.startDate.month,
            day: event.startDate.day,
            hour: event.startDate.hour,
            minute: event.startDate.minute,
            second: event.startDate.second
          }, { zone: 'utc' });
          
          endDateTime = DateTime.fromObject({
            year: event.endDate.year,
            month: event.endDate.month,
            day: event.endDate.day,
            hour: event.endDate.hour,
            minute: event.endDate.minute,
            second: event.endDate.second
          }, { zone: 'utc' });
        } else if (event.startDate.timezone) {
          // This has a specific timezone
          console.log(`Event has specific timezone: ${event.startDate.timezone}`);
          startDateTime = DateTime.fromObject({
            year: event.startDate.year,
            month: event.startDate.month,
            day: event.startDate.day,
            hour: event.startDate.hour,
            minute: event.startDate.minute,
            second: event.startDate.second
          }, { zone: event.startDate.timezone });
          
          endDateTime = DateTime.fromObject({
            year: event.endDate.year,
            month: event.endDate.month,
            day: event.endDate.day,
            hour: event.endDate.hour,
            minute: event.endDate.minute,
            second: event.endDate.second
          }, { zone: event.endDate.timezone });
        } else {
          // This is a floating time, interpret in user's timezone
          console.log(`Event has floating time, interpreting in user timezone: ${userTimezone}`);
          startDateTime = DateTime.fromObject({
            year: event.startDate.year,
            month: event.startDate.month,
            day: event.startDate.day,
            hour: event.startDate.hour,
            minute: event.startDate.minute,
            second: event.startDate.second
          }, { zone: userTimezone });
          
          endDateTime = DateTime.fromObject({
            year: event.endDate.year,
            month: event.endDate.month,
            day: event.endDate.day,
            hour: event.endDate.hour,
            minute: event.endDate.minute,
            second: event.endDate.second
          }, { zone: userTimezone });
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
          location: event.location || '',
          sport: sport,
          color: '#2563EB', // SportsEngine blue
          platform: 'SportsEngine',
          platform_color: '#2563EB',
          profile_id: profileId,
          platform_team_id: teamId
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
        .eq('profile_id', profileId)
        .eq('platform_team_id', teamId)
        .eq('platform', 'SportsEngine');

      if (deleteError) {
        console.error('Error deleting existing events:', deleteError);
        // Continue with insert anyway
      }

      // Insert new events
      console.log('Inserting new events into database');
      const { data: eventsData, error: eventsError } = await supabaseClient
        .from('events')
        .insert(deduplicatedEvents);

      if (eventsError) {
        console.error('Error inserting events:', eventsError);
        throw eventsError;
      }

      console.log('Successfully inserted events:', eventsData);

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
    console.error('Error in sync-sportsengine-calendar:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    // Update team sync status to error
    try {
      const body = await req.json();
      const { teamId } = body;
      if (teamId) {
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
          .eq('id', teamId);
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
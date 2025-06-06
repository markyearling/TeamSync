import ICAL from 'npm:ical.js@1.5.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface ICSRequestBody {
  icsUrl: string;
  teamId: string;
  profileId: string;
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

    if (!icsUrl || !teamId || !profileId) {
      console.error('Missing parameters:', { icsUrl, teamId, profileId });
      throw new Error('Missing required parameters: icsUrl, teamId, or profileId');
    }

    console.log('Fetching ICS file from:', icsUrl);

    // Fetch ICS file
    const response = await fetch(icsUrl, {
      headers: {
        'Accept': 'text/calendar',
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) {
      console.error('Failed to fetch ICS file:', {
        status: response.status,
        statusText: response.statusText,
        url: icsUrl
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

      // Transform events
      const events = vevents.map(vevent => {
        const event = new ICAL.Event(vevent);
        return {
          title: event.summary,
          description: event.description || '',
          start_time: event.startDate.toJSDate().toISOString(),
          end_time: event.endDate.toJSDate().toISOString(),
          location: event.location || '',
          sport: 'Soccer',
          color: '#10B981',
          platform: 'Playmetrics',
          platform_color: '#10B981',
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

      // Insert events
      console.log('Upserting events into database');
      const { data: eventsData, error: eventsError } = await supabaseClient
        .from('events')
        .upsert(deduplicatedEvents, {
          onConflict: 'platform,platform_team_id,start_time,end_time'
        });

      if (eventsError) {
        console.error('Error upserting events:', eventsError);
        throw eventsError;
      }

      console.log('Successfully upserted events:', eventsData);

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
    console.error('Error in sync-playmetrics-calendar:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    // Update team sync status to error
    try {
      const { teamId } = await req.json();
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
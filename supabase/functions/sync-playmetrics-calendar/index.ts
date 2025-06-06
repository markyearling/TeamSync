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

      // Insert events
      console.log('Upserting events into database');
      const { data: eventsData, error: eventsError } = await supabaseClient
        .from('events')
        .upsert(events, {
          onConflict: 'platform,platform_team_id,start_time,end_time'
        });

      if (eventsError) {
        console.error('Error upserting events:', eventsError);
        throw eventsError;
      }

      console.log('Successfully upserted events:', eventsData);

      // Update team sync status
      console.log('Updating team sync status');
      const { data: updateData, error: updateError } = await supabaseClient
        .from('platform_teams')
        .update({
          sync_status: 'success',
          last_synced: new Date().toISOString()
        })
        .eq('id', teamId);

      if (updateError) {
        console.error('Error updating team sync status:', updateError);
        throw updateError;
      }

      console.log('Successfully updated team sync status:', updateData);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Calendar synced successfully', 
          eventCount: events.length 
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
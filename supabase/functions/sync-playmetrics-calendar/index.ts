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
    const { icsUrl, teamId, profileId }: ICSRequestBody = await req.json();

    if (!icsUrl || !teamId || !profileId) {
      throw new Error('Missing required parameters');
    }

    // Fetch ICS file
    const response = await fetch(icsUrl, {
      headers: {
        'Accept': 'text/calendar',
        'Cache-Control': 'no-cache'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch calendar: ${response.status} ${response.statusText}`);
    }

    // Parse ICS data
    const icsData = await response.text();
    const jCalData = ICAL.parse(icsData);
    const comp = new ICAL.Component(jCalData);
    const vevents = comp.getAllSubcomponents('vevent');

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
    const { error: eventsError } = await supabaseClient
      .from('events')
      .upsert(events, {
        onConflict: 'platform,platform_team_id,start_time,end_time'
      });

    if (eventsError) {
      throw eventsError;
    }

    // Update team sync status
    const { error: updateError } = await supabaseClient
      .from('platform_teams')
      .update({
        sync_status: 'success',
        last_synced: new Date().toISOString()
      })
      .eq('id', teamId);

    if (updateError) {
      throw updateError;
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Calendar synced successfully', eventCount: events.length }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error syncing calendar:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
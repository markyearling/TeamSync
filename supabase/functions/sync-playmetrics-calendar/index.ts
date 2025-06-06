import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import { VCalendar } from 'npm:ical.js@1.5.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Timeout wrapper for fetch
async function fetchWithTimeout(url: string, timeout = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error.name === 'AbortError') {
      throw new Error(`Request to ${url} timed out after ${timeout}ms`);
    }
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let teamId: string;
  let icsUrl: string;
  let profileId: string;
  let supabase: any;

  try {
    // Parse request body once at the start
    const body = await req.json();
    teamId = body.teamId;
    icsUrl = body.icsUrl;

    if (!teamId || !icsUrl) {
      throw new Error('Missing required parameters: teamId or icsUrl');
    }

    // Initialize Supabase client
    supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get the authenticated user from the request authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Fetch ICS calendar with timeout
    const response = await fetchWithTimeout(icsUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch calendar: ${response.status} ${response.statusText}`);
    }

    const icsData = await response.text();
    if (!icsData.trim()) {
      throw new Error('Empty calendar data received');
    }

    let jCalData;
    try {
      jCalData = VCalendar.parse(icsData);
    } catch (error) {
      throw new Error(`Failed to parse calendar data: ${error.message}`);
    }

    const calendar = new VCalendar(jCalData);
    const allEvents = calendar.getAllSubcomponents('vevent');

    if (!allEvents.length) {
      throw new Error('No events found in calendar');
    }

    // Process events with validation
    const events = allEvents
      .map(event => {
        try {
          const start = event.getFirstPropertyValue('dtstart');
          const end = event.getFirstPropertyValue('dtend');
          const summary = event.getFirstPropertyValue('summary');
          
          if (!start || !end || !summary) {
            console.warn('Skipping event due to missing required data');
            return null;
          }

          const startDate = start.toJSDate();
          const endDate = end.toJSDate();

          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            console.warn('Skipping event due to invalid dates');
            return null;
          }

          return {
            title: summary,
            description: event.getFirstPropertyValue('description') || '',
            start_time: startDate.toISOString(),
            end_time: endDate.toISOString(),
            location: event.getFirstPropertyValue('location') || '',
            platform: 'Playmetrics',
            platform_color: '#10B981',
            sport: 'Soccer'
          };
        } catch (error) {
          console.warn('Error processing event:', error);
          return null;
        }
      })
      .filter(event => event !== null);

    if (!events.length) {
      throw new Error('No valid events found in calendar');
    }

    // Get the platform team
    const { data: team, error: teamError } = await supabase
      .from('platform_teams')
      .select('*')
      .eq('id', teamId)
      .eq('user_id', user.id)
      .single();

    if (teamError) throw new Error('Team not found or access denied');

    // Get profile_id from profile_teams table
    const { data: profileTeam, error: profileTeamError } = await supabase
      .from('profile_teams')
      .select('profile_id')
      .eq('platform_team_id', teamId)
      .maybeSingle();

    if (!profileTeam) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (profilesError || !profiles || profiles.length === 0) {
        throw new Error('No profile found for this user');
      }
      
      const { error: createProfileTeamError } = await supabase
        .from('profile_teams')
        .insert({
          profile_id: profiles[0].id,
          platform_team_id: teamId
        });

      if (createProfileTeamError) throw createProfileTeamError;
      
      profileId = profiles[0].id;
    } else {
      profileId = profileTeam.profile_id;
    }

    // Insert events
    const { error: eventsError } = await supabase
      .from('events')
      .upsert(
        events.map(event => ({
          ...event,
          profile_id: profileId,
          platform_team_id: team.id
        })),
        {
          onConflict: 'platform,platform_team_id,start_time,end_time'
        }
      );

    if (eventsError) throw eventsError;

    // Update team sync status
    const { error: updateError } = await supabase
      .from('platform_teams')
      .update({
        last_synced: new Date().toISOString(),
        sync_status: 'success'
      })
      .eq('id', teamId)
      .eq('user_id', user.id);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Calendar synced successfully',
        eventCount: events.length 
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error syncing calendar:', error);

    // Only update team sync status if we have teamId and supabase client
    if (teamId && supabase) {
      try {
        await supabase
          .from('platform_teams')
          .update({
            sync_status: 'error',
            last_synced: new Date().toISOString()
          })
          .eq('id', teamId);
      } catch (updateError) {
        console.error('Error updating team status:', updateError);
      }
    }

    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An unexpected error occurred while syncing the calendar'
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 500,
      }
    );
  }
});
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import { VCalendar } from 'npm:ical.js@1.5.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    // Verify environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing required environment variables');
    }

    // Parse request body
    const { teamId, icsUrl } = await req.json();

    if (!teamId || !icsUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: teamId or icsUrl' }), 
        { status: 400, headers: corsHeaders }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Get the authenticated user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header provided' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Fetch ICS calendar
    const response = await fetch(icsUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch calendar: ${response.status} ${response.statusText}`);
    }

    const icsData = await response.text();
    const jCalData = VCalendar.parse(icsData);
    const calendar = new VCalendar(jCalData);
    const allEvents = calendar.getAllSubcomponents('vevent');

    // Process events
    const events = allEvents
      .map(event => {
        const start = event.getFirstPropertyValue('dtstart');
        const end = event.getFirstPropertyValue('dtend');
        const summary = event.getFirstPropertyValue('summary');

        if (!start || !end || !summary) return null;

        return {
          title: summary,
          description: event.getFirstPropertyValue('description') || '',
          start_time: start.toJSDate().toISOString(),
          end_time: end.toJSDate().toISOString(),
          location: event.getFirstPropertyValue('location') || '',
          platform: 'Playmetrics',
          platform_color: '#10B981',
          sport: 'Soccer'
        };
      })
      .filter(Boolean);

    // Get the platform team
    const { data: team, error: teamError } = await supabase
      .from('platform_teams')
      .select('*')
      .eq('id', teamId)
      .eq('user_id', user.id)
      .single();

    if (teamError) {
      return new Response(
        JSON.stringify({ error: 'Team not found or access denied' }),
        { status: 404, headers: corsHeaders }
      );
    }

    // Get or create profile team mapping
    const { data: profileTeam } = await supabase
      .from('profile_teams')
      .select('profile_id')
      .eq('platform_team_id', teamId)
      .maybeSingle();

    let profileId;
    if (!profileTeam) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .limit(1);

      if (profilesError || !profiles?.length) {
        return new Response(
          JSON.stringify({ error: 'No profile found for this user' }),
          { status: 404, headers: corsHeaders }
        );
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
        { onConflict: 'platform,platform_team_id,start_time,end_time' }
      );

    if (eventsError) throw eventsError;

    // Update team sync status
    await supabase
      .from('platform_teams')
      .update({
        last_synced: new Date().toISOString(),
        sync_status: 'success'
      })
      .eq('id', teamId)
      .eq('user_id', user.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Calendar synced successfully',
        eventCount: events.length
      }),
      { headers: corsHeaders }
    );

  } catch (error) {
    console.error('Error syncing calendar:', error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'An unexpected error occurred'
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
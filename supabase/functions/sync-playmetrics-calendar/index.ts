import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import { VCalendar } from 'npm:ical.js@1.5.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let teamId: string;
  let icsUrl: string;
  let profileId: string;

  try {
    // Parse request body once at the start
    const body = await req.json();
    teamId = body.teamId;
    icsUrl = body.icsUrl;

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '' // Use service role key for admin access
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

    // Fetch ICS calendar
    const response = await fetch(icsUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch calendar: ' + response.statusText);
    }

    const icsData = await response.text();
    const jCalData = VCalendar.parse(icsData);
    const calendar = new VCalendar(jCalData);

    // Process events
    const events = calendar.getAllSubcomponents('vevent').map(event => {
      const start = event.getFirstPropertyValue('dtstart');
      const end = event.getFirstPropertyValue('dtend');
      const summary = event.getFirstPropertyValue('summary');
      const description = event.getFirstPropertyValue('description');
      const location = event.getFirstPropertyValue('location');

      return {
        title: summary,
        description,
        start_time: start.toJSDate().toISOString(),
        end_time: end.toJSDate().toISOString(),
        location,
        platform: 'Playmetrics',
        platform_color: '#10B981',
        sport: 'Soccer'
      };
    });

    // Get the platform team
    const { data: team, error: teamError } = await supabase
      .from('platform_teams')
      .select('*')
      .eq('id', teamId)
      .eq('user_id', user.id) // Ensure the team belongs to the authenticated user
      .single();

    if (teamError) throw new Error('Team not found or access denied');

    // Get profile_id from profile_teams table
    const { data: profileTeam, error: profileTeamError } = await supabase
      .from('profile_teams')
      .select('profile_id')
      .eq('platform_team_id', teamId)
      .maybeSingle(); // Use maybeSingle instead of single to handle non-existing mapping

    if (!profileTeam) {
      // If no profile team mapping exists, get the first available profile for the user
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .limit(1); // Use limit(1) instead of single() to handle multiple profiles

      if (profilesError || !profiles || profiles.length === 0) {
        throw new Error('No profile found for this user');
      }
      
      // Create profile team mapping with the first available profile
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
      .eq('user_id', user.id); // Ensure we're updating the correct team

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true, message: 'Calendar synced successfully' }),
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

    // Only update team sync status if we have a teamId
    if (teamId) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        await supabase
          .from('platform_teams')
          .update({
            sync_status: 'error'
          })
          .eq('id', teamId);
      } catch (updateError) {
        console.error('Error updating team status:', updateError);
      }
    }

    return new Response(
      JSON.stringify({ 
        error: error.message || 'An unexpected error occurred while syncing the calendar'
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
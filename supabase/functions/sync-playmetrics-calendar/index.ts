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

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { teamId, icsUrl } = await req.json();

    // Fetch ICS calendar
    const response = await fetch(icsUrl);
    if (!response.ok) {
      throw new Error('Failed to fetch calendar');
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
      .single();

    if (teamError) throw teamError;

    // Get profile_id from profile_teams table
    const { data: profileTeam, error: profileTeamError } = await supabase
      .from('profile_teams')
      .select('profile_id')
      .eq('platform_team_id', teamId)
      .single();

    if (profileTeamError) {
      // If no profile team mapping exists, get the first profile for the user
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', team.user_id)
        .single();

      if (profileError) throw new Error('No profile found for this user');
      
      // Create profile team mapping
      const { error: createProfileTeamError } = await supabase
        .from('profile_teams')
        .insert({
          profile_id: profile.id,
          platform_team_id: teamId
        });

      if (createProfileTeamError) throw createProfileTeamError;
      
      var profileId = profile.id;
    } else {
      var profileId = profileTeam.profile_id;
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
      .eq('id', teamId);

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

    // Update team sync status to error
    try {
      const { teamId } = await req.json();
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? ''
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

    return new Response(
      JSON.stringify({ error: error.message }),
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
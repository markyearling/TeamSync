import { createClient } from 'npm:@supabase/supabase-js@2';

// This function is executed at the very top level.
console.log("sync-teamsnap-calendar: Function file loaded.");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface TeamSnapSyncRequest {
  teamId: string;
  profileId: string;
  userId: string;
}

// TeamSnap API configuration
const TEAMSNAP_TOKEN_URL = 'https://auth.teamsnap.com/oauth/token';
const TEAMSNAP_API_URL = 'https://api.teamsnap.com/v3';

Deno.serve(async (req: Request): Promise<Response> => {
  let body: TeamSnapSyncRequest | null = null;

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Initialize Supabase client
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );

  try {
    console.log('Processing TeamSnap sync request...'); // Added logging
    
    // Assign to the outer-scoped variable
    body = await req.json();
    const { teamId, profileId, userId }: TeamSnapSyncRequest = body;

    if (!teamId || !profileId || !userId) {
      throw new Error('Missing required parameters: teamId, profileId, or userId');
    }

    console.log(`Syncing TeamSnap team ${teamId} for profile ${profileId} (user ${userId})`); // Added logging

    // Get the platform team record
    const { data: platformTeam, error: teamError } = await supabaseClient
      .from('platform_teams')
      .select('*')
      .eq('id', teamId)
      .eq('platform', 'TeamSnap')
      .single();

    if (teamError || !platformTeam) {
      throw new Error('TeamSnap platform team not found');
    }

    // Get user's TeamSnap access token
    const { data: userSettings, error: settingsError } = await supabaseClient
      .from('user_settings')
      .select('teamsnap_access_token, teamsnap_refresh_token')
      .eq('user_id', userId)
      .single();

    if (settingsError || !userSettings?.teamsnap_access_token) {
      throw new Error('TeamSnap access token not found. User needs to reconnect to TeamSnap.');
    }

    let accessToken = userSettings.teamsnap_access_token;

    let userTimezone = 'UTC';
    try { // Added logging
      console.log(`[TeamSnap Sync] Attempting to fetch timezone for user: ${userId}`);
      
      // Use RPC function to get timezone directly by user_id
      console.log(`[TeamSnap Sync] Calling RPC 'get_user_timezone' with p_user_id: ${userId}`);
      const { data: timezoneResult, error: rpcError } = await supabaseClient.rpc('get_user_timezone', { 
        p_user_id: userId 
      });
      
      if (rpcError) {
        console.warn('[TeamSnap Sync] Error calling get_user_timezone RPC:', rpcError.message); // Added logging
        console.log('[TeamSnap Sync] Using default timezone UTC'); // Added logging
      } else if (timezoneResult) { // Added logging
        console.log(`[TeamSnap Sync] RPC returned timezone: ${timezoneResult}`); // Added logging
        userTimezone = timezoneResult;
      } else {
        console.log('[TeamSnap Sync] No timezone returned from RPC, using UTC');
      }
      console.log(`[TeamSnap Sync] Final userTimezone set to: ${userTimezone}`);
    } catch (error) {
      console.warn('[TeamSnap Sync] Exception getting user timezone, using UTC:', error);
    }

    // Helper function to make TeamSnap API requests
    const makeTeamSnapRequest = async (endpoint: string, token: string): Promise<any> => {
      const url = endpoint.startsWith('http') ? endpoint : `${TEAMSNAP_API_URL}${endpoint}`;
      console.log('Making TeamSnap API request to:', url); // Added logging

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('TeamSnap authentication expired');
        }
        throw new Error(`TeamSnap API request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    };

    // Helper function to refresh access token if needed
    const refreshAccessToken = async (refreshToken: string): Promise<string> => {
      const response = await fetch(TEAMSNAP_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: Deno.env.get('TEAMSNAP_CLIENT_ID') ?? '',
          client_secret: Deno.env.get('TEAMSNAP_CLIENT_SECRET') ?? '',
        }),
      });

      if (!response.ok) {
        console.error('Failed to refresh TeamSnap access token:', await response.text()); // Added logging
        throw new Error('Failed to refresh TeamSnap access token');
      }

      const tokenData = await response.json();
      
      // Update stored tokens
      await supabaseClient
        .from('user_settings')
        .update({
          teamsnap_access_token: tokenData.access_token,
          teamsnap_refresh_token: tokenData.refresh_token || refreshToken,
        })
        .eq('user_id', userId);

      return tokenData.access_token;
    };

    // Try to fetch team events, refresh token if needed // Added logging
    let teamEvents;
    try {
      teamEvents = await makeTeamSnapRequest(`/events/search?team_id=${platformTeam.team_id}`, accessToken);
    } catch (error) {
      if (error.message.includes('authentication expired') && userSettings.teamsnap_refresh_token) {
        console.log('Access token expired, attempting to refresh...');
        try {
          accessToken = await refreshAccessToken(userSettings.teamsnap_refresh_token);
          teamEvents = await makeTeamSnapRequest(`/events/search?team_id=${platformTeam.team_id}`, accessToken);
        } catch (refreshError) {
          throw new Error('Failed to refresh TeamSnap token and fetch events');
        }
      } else {
        throw error;
      }
    }

    // Handle different possible response structures from TeamSnap API
    let events: any[] = [];
    if (Array.isArray(teamEvents)) {
      events = teamEvents;
    } else if (teamEvents.collection && Array.isArray(teamEvents.collection.items)) {
      events = teamEvents.collection.items.map((item: any) => {
        if (item.data && Array.isArray(item.data)) {
          const eventObj: any = {};
          item.data.forEach((field: any) => {
            if (field.name && field.value !== undefined) {
              eventObj[field.name] = field.value;
            }
          });
          return eventObj;
        }
        return item;
      });
    } else if (teamEvents.data && Array.isArray(teamEvents.data)) {
      events = teamEvents.data;
    }

    console.log(`Found ${events.length} events from TeamSnap API`); // Added logging

    // Transform TeamSnap events for database storage
    const eventsToUpsert = events.filter(event => event.start_date && event.id).map(event => {
      // Format the title based on event type and is_game flag
      let title = 'TeamSnap Event';

      if (event.type) {
        title = event.type.charAt(0).toUpperCase() + event.type.slice(1);
        if (event.is_game) {
          title += " Game";
        }
      } else if (event.is_game) {
        title = "Game";
      } else if (event.name) {
        title = event.name;
      }

      // Use formatted_title_for_multi_team for description if available
      let description = '';
      if (event.formatted_title_for_multi_team) {
        description = event.formatted_title_for_multi_team;
      } else if (event.notes) {
        description = event.notes;
      }

      return {
        external_id: String(event.id), // TeamSnap event ID
        title: title,
        description: description,
        start_time: event.start_date,
        end_time: event.end_date || event.start_date,
        location: event.location_name || '',
        sport: platformTeam.sport || 'Unknown',
        color: platformTeam.sport_color || '#F97316', // TeamSnap orange
        platform: 'TeamSnap',
        platform_color: '#F97316',
        platform_team_id: teamId,
        profile_id: profileId,
        visibility: 'public'
      };
    });

    console.log(`Transformed ${eventsToUpsert.length} valid events for database upsert`);

    // Get external IDs of events from API
    const apiEventIds = eventsToUpsert.map(e => e.external_id);

    // Delete events that no longer exist in the API response
    // This preserves events that still exist (and their messages) while removing stale ones
    if (apiEventIds.length > 0) {
      console.log('Deleting stale TeamSnap events not in API response...');
      const { error: deleteError } = await supabaseClient
        .from('events')
        .delete()
        .eq('platform_team_id', teamId)
        .eq('platform', 'TeamSnap')
        .not('external_id', 'in', `(${apiEventIds.join(',')})`);

      if (deleteError) {
        console.warn('Error deleting stale events:', deleteError.message);
      }
    } else {
      // No events from API, delete all platform events for this team
      console.log('No events from API, deleting all TeamSnap events for this team...');
      await supabaseClient
        .from('events')
        .delete()
        .eq('platform_team_id', teamId)
        .eq('platform', 'TeamSnap');
    }

    // Upsert events (insert new, update existing)
    if (eventsToUpsert.length > 0) {
      console.log('Upserting TeamSnap events...');

      // Use raw SQL for proper upsert with external_id
      for (const event of eventsToUpsert) {
        const { error: upsertError } = await supabaseClient
          .from('events')
          .upsert(event, {
            onConflict: 'platform,platform_team_id,external_id',
            ignoreDuplicates: false
          });

        if (upsertError) {
          console.error('Error upserting event:', event.external_id, upsertError);
          throw upsertError;
        }
      }

      console.log(`Successfully upserted ${eventsToUpsert.length} events`);
    } else {
      console.log('No events to upsert');
    }

    console.log(`Successfully synced ${eventsToUpsert.length} TeamSnap events for profile ${profileId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'TeamSnap calendar synced successfully',
        eventCount: eventsToUpsert.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in sync-teamsnap-calendar:', error);
    
    // Update team sync status to error
    try {
      // Access teamId from the 'body' variable if it was successfully parsed
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
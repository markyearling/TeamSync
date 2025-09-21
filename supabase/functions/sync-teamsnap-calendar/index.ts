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

Deno.serve(async (req) => {
  console.log('=== TeamSnap Sync Function Started ===');
  console.log('Request method:', req.method);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
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

    console.log('Processing TeamSnap sync request...');
    
    const { teamId, profileId, userId }: TeamSnapSyncRequest = await req.json();

    if (!teamId || !profileId || !userId) {
      throw new Error('Missing required parameters: teamId, profileId, or userId');
    }

    console.log(`Syncing TeamSnap team ${teamId} for profile ${profileId} (user ${userId})`);

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
    try {
      console.log(`[TeamSnap Sync] Attempting to fetch timezone for user: ${userId}`);
      
      // Use RPC function to get timezone directly by user_id
      console.log(`[TeamSnap Sync] Calling RPC 'get_user_timezone' with p_user_id: ${userId}`);
      const { data: timezoneResult, error: rpcError } = await supabaseClient.rpc('get_user_timezone', { 
        p_user_id: userId 
      });
      
      if (rpcError) {
        console.warn('[TeamSnap Sync] Error calling get_user_timezone RPC:', rpcError.message);
        console.log('[TeamSnap Sync] Using default timezone UTC');
      } else if (timezoneResult) {
        console.log(`[TeamSnap Sync] RPC returned timezone: ${timezoneResult}`);
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
      console.log('Making TeamSnap API request to:', url);

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

    // Try to fetch team events, refresh token if needed
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

    console.log(`Found ${events.length} events from TeamSnap API`);

    // Transform TeamSnap events for database storage
    const eventsToInsert = events.filter(event => event.start_date).map(event => {
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

    console.log(`Transformed ${eventsToInsert.length} valid events for database insertion`);

    // Delete existing events for this profile and team to avoid duplicates
    console.log('Deleting existing TeamSnap events for this profile and team...');
    const { error: deleteError } = await supabaseClient
      .from('events')
      .delete()
      .eq('platform_team_id', teamId)
      .eq('platform', 'TeamSnap');

    if (deleteError) {
      console.error('Error deleting existing events:', deleteError);
      throw new Error(`Failed to delete existing events: ${deleteError.message}`);
    }

    // Insert new events
    if (eventsToInsert.length > 0) {
      console.log('Inserting new TeamSnap events...');
      const { error: eventsError } = await supabaseClient
        .from('events')
        .insert(eventsToInsert);

      if (eventsError) {
        console.error('Error inserting events:', eventsError);
        throw eventsError;
      }
    } else {
      console.log('No events to insert');
    }

    console.log(`Successfully synced ${eventsToInsert.length} TeamSnap events for profile ${profileId}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'TeamSnap calendar synced successfully', 
        eventCount: eventsToInsert.length
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
      // Access teamId from the 'teamId' variable which is in scope
      const currentTeamId = teamId;
      
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
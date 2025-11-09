import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface SyncResult {
  teamId: string;
  teamName: string;
  platform: string;
  status: 'success' | 'error' | 'skipped';
  message?: string;
  profileCount?: number;
  eventCount?: number;
}

Deno.serve(async (req) => {
  console.log('=== Refresh All User Schedules Function Started ===');
  console.log('Request method:', req.method);
  console.log('Request URL:', req.url);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Initialize Supabase client with service role key for admin access
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        }
      }
    );

    console.log('Supabase client initialized with service role key');

    // Fetch all platform teams from the database
    console.log('Fetching all platform teams...');
    const { data: platformTeams, error: fetchTeamsError } = await supabaseClient
      .from('platform_teams')
      .select('id, platform, team_name, ics_url, user_id, sync_status, last_synced')
      .order('created_at', { ascending: true });

    if (fetchTeamsError) {
      console.error('Error fetching platform teams:', fetchTeamsError);
      throw new Error(`Failed to fetch platform teams: ${fetchTeamsError.message}`);
    }

    console.log(`Found ${platformTeams?.length || 0} platform teams to process`);

    if (!platformTeams || platformTeams.length === 0) {
      console.log('No platform teams found. Exiting.');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No platform teams found to sync',
          results: []
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const syncResults: SyncResult[] = [];
    let totalTeamsProcessed = 0;
    let totalSuccessfulSyncs = 0;
    let totalErrors = 0;

    // Process each platform team
    for (const team of platformTeams) {
      totalTeamsProcessed++;
      console.log(`\n--- Processing team ${totalTeamsProcessed}/${platformTeams.length}: ${team.team_name} (${team.platform}) ---`);

      try {
        // Fetch profile mappings for the current team
        const { data: profileMappings, error: fetchMappingsError } = await supabaseClient
          .from('profile_teams')
          .select('profile_id')
          .eq('platform_team_id', team.id);

        if (fetchMappingsError) {
          console.error(`Error fetching profile mappings for team ${team.id}:`, fetchMappingsError);
          throw new Error(`Failed to fetch profile mappings: ${fetchMappingsError.message}`);
        }

        if (!profileMappings || profileMappings.length === 0) {
          console.log(`Team ${team.team_name} has no profile mappings. Skipping event sync.`);
          syncResults.push({
            teamId: team.id,
            teamName: team.team_name,
            platform: team.platform,
            status: 'skipped',
            message: 'No profiles mapped to this team',
            profileCount: 0
          });
          continue;
        }

        console.log(`Found ${profileMappings.length} profile mapping(s) for team ${team.team_name}`);

        // Update team status to pending before sync
        await supabaseClient
          .from('platform_teams')
          .update({ sync_status: 'pending' })
          .eq('id', team.id);

        let successfulProfileSyncs = 0;
        let totalEventsForTeam = 0;
        const errorMessages: string[] = [];

        // Process each profile mapping for this team
        for (const mapping of profileMappings) {
          const profileId = mapping.profile_id;
          console.log(`  Syncing events for profile ${profileId}...`);

          try {
            let syncFunctionName: string | null = null;
            let syncBody: any = null;

            // Determine which sync function to call based on platform
            switch (team.platform) {
              case 'SportsEngine':
                if (!team.ics_url) {
                  throw new Error('No ICS URL configured for SportsEngine team');
                }
                syncFunctionName = 'sync-sportsengine-calendar';
                syncBody = { 
                  icsUrl: team.ics_url, 
                  teamId: team.id, 
                  profileId: profileId 
                };
                break;

              case 'Playmetrics':
                if (!team.ics_url) {
                  throw new Error('No ICS URL configured for Playmetrics team');
                }
                syncFunctionName = 'sync-playmetrics-calendar';
                syncBody = { 
                  icsUrl: team.ics_url, 
                  teamId: team.id, 
                  profileId: profileId 
                };
                break;

              case 'GameChanger':
                if (!team.ics_url) {
                  throw new Error('No ICS URL configured for GameChanger team');
                }
                syncFunctionName = 'sync-gamechanger-calendar';
                syncBody = { 
                  icsUrl: team.ics_url, 
                  teamId: team.id, 
                  profileId: profileId 
                };
                break;

              case 'TeamSnap':
                syncFunctionName = 'sync-teamsnap-calendar';
                syncBody = { 
                  teamId: team.id, 
                  profileId: mapping.profile_id, 
                  userId: team.user_id 
                };
                break;

              default:
                console.warn(`Unknown platform: ${team.platform}. Skipping sync for team ${team.id}.`);
                errorMessages.push(`Unknown platform: ${team.platform}`);
                continue;
            }

            if (syncFunctionName && syncBody) {
              console.log(`    Invoking ${syncFunctionName} for profile ${profileId}...`);
              
              // Invoke the platform-specific sync function
              const invokeResponse = await supabaseClient.functions.invoke(syncFunctionName, {
                body: syncBody
              });

              if (invokeResponse.error) {
                console.error(`    Error invoking ${syncFunctionName}:`, invokeResponse.error);
                throw new Error(`Function invocation failed: ${invokeResponse.error.message}`);
              }

              const responseData = invokeResponse.data;
              if (!responseData?.success) {
                console.error(`    Sync function returned error:`, responseData?.error);
                throw new Error(responseData?.error || 'Sync function returned failure');
              }

              successfulProfileSyncs++;
              totalEventsForTeam += responseData.eventCount || 0;
              console.log(`    ✅ Successfully synced ${responseData.eventCount || 0} events for profile ${profileId}`);
            }

          } catch (profileSyncError) {
            console.error(`    ❌ Error syncing profile ${profileId}:`, profileSyncError);
            errorMessages.push(`Profile ${profileId}: ${profileSyncError.message || 'Unknown error'}`);
          }
        }

        // Update team status based on sync results
        const finalSyncStatus = errorMessages.length > 0 ? 'error' : 'success';
        await supabaseClient
          .from('platform_teams')
          .update({
            sync_status: finalSyncStatus,
            last_synced: new Date().toISOString()
          })
          .eq('id', team.id);

        // Record the result
        const result: SyncResult = {
          teamId: team.id,
          teamName: team.team_name,
          platform: team.platform,
          status: finalSyncStatus,
          profileCount: profileMappings.length,
          eventCount: totalEventsForTeam
        };

        if (errorMessages.length > 0) {
          result.message = errorMessages.join('; ');
          totalErrors++;
        } else {
          result.message = `Successfully synced ${totalEventsForTeam} events for ${successfulProfileSyncs} profile(s)`;
          totalSuccessfulSyncs++;
        }

        syncResults.push(result);
        console.log(`✅ Completed processing team ${team.team_name}: ${result.status}`);

      } catch (teamProcessError) {
        console.error(`❌ Failed to process team ${team.id} (${team.team_name}):`, teamProcessError);
        
        // Update team status to error
        try {
          await supabaseClient
            .from('platform_teams')
            .update({
              sync_status: 'error',
              last_synced: new Date().toISOString()
            })
            .eq('id', team.id);
        } catch (updateError) {
          console.error(`Failed to update error status for team ${team.id}:`, updateError);
        }

        syncResults.push({
          teamId: team.id,
          teamName: team.team_name,
          platform: team.platform,
          status: 'error',
          message: teamProcessError.message || 'Unknown processing error'
        });
        totalErrors++;
      }
    }

    // Log final summary
    console.log('\n=== SYNC SUMMARY ===');
    console.log(`Total teams processed: ${totalTeamsProcessed}`);
    console.log(`Successful syncs: ${totalSuccessfulSyncs}`);
    console.log(`Errors: ${totalErrors}`);
    console.log(`Skipped: ${syncResults.filter(r => r.status === 'skipped').length}`);

    // Group results by status for the response
    const summary = {
      totalTeams: totalTeamsProcessed,
      successful: totalSuccessfulSyncs,
      errors: totalErrors,
      skipped: syncResults.filter(r => r.status === 'skipped').length,
      totalEvents: syncResults.reduce((sum, r) => sum + (r.eventCount || 0), 0)
    };

    console.log('Refresh-all-user-schedules function completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${totalTeamsProcessed} teams: ${totalSuccessfulSyncs} successful, ${totalErrors} errors`,
        summary,
        results: syncResults
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('=== GLOBAL REFRESH FUNCTION ERROR ===');
    console.error('Error type:', typeof error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred during global refresh',
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

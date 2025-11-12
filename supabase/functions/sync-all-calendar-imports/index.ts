import { createClient } from 'npm:@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('Missing Supabase environment variables');
      throw new Error('Server configuration error');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    console.log('Starting scheduled sync of all calendar imports');

    const { data: calendarImports, error: fetchError } = await supabase
      .from('calendar_imports')
      .select('id, calendar_name, user_id')
      .eq('is_active', true);

    if (fetchError) {
      console.error('Error fetching calendar imports:', fetchError);
      throw fetchError;
    }

    if (!calendarImports || calendarImports.length === 0) {
      console.log('No active calendar imports found');
      return new Response(
        JSON.stringify({ success: true, message: 'No active calendar imports to sync' }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Found ${calendarImports.length} active calendar imports to sync`);

    const results = [];

    for (const calendarImport of calendarImports) {
      console.log(`Syncing calendar: ${calendarImport.calendar_name} (${calendarImport.id})`);

      try {
        const syncResponse = await fetch(
          `${supabaseUrl}/functions/v1/sync-external-calendar`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceRoleKey}`,
            },
            body: JSON.stringify({
              calendar_import_id: calendarImport.id,
            }),
          }
        );

        if (syncResponse.ok) {
          const result = await syncResponse.json();
          console.log(`Successfully synced ${calendarImport.calendar_name}:`, result);
          results.push({
            id: calendarImport.id,
            name: calendarImport.calendar_name,
            success: true,
            result,
          });
        } else {
          const error = await syncResponse.text();
          console.error(`Failed to sync ${calendarImport.calendar_name}:`, error);
          results.push({
            id: calendarImport.id,
            name: calendarImport.calendar_name,
            success: false,
            error,
          });
        }
      } catch (error) {
        console.error(`Error syncing ${calendarImport.calendar_name}:`, error);
        results.push({
          id: calendarImport.id,
          name: calendarImport.calendar_name,
          success: false,
          error: error.message,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    console.log(`Sync complete: ${successCount} successful, ${failureCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        total: calendarImports.length,
        successful: successCount,
        failed: failureCount,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error in scheduled calendar sync:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to sync calendars', details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

import { createClient } from 'npm:@supabase/supabase-js@2.39.0';
import ICAL from 'npm:ical.js@1.5.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface CalendarImport {
  id: string;
  user_id: string;
  profile_id: string;
  calendar_url: string;
  calendar_name: string;
}

interface ParsedEvent {
  external_event_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  location: string | null;
  is_cancelled: boolean;
}

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

    const { calendar_import_id } = await req.json();

    if (!calendar_import_id) {
      return new Response(
        JSON.stringify({ error: 'Missing calendar_import_id' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Syncing calendar import:', calendar_import_id);

    const { data: calendarImport, error: fetchError } = await supabase
      .from('calendar_imports')
      .select('*')
      .eq('id', calendar_import_id)
      .maybeSingle();

    if (fetchError || !calendarImport) {
      console.error('Error fetching calendar import:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Calendar import not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    await supabase
      .from('calendar_imports')
      .update({ sync_status: 'syncing', error_message: null })
      .eq('id', calendar_import_id);

    console.log('Fetching calendar from URL:', calendarImport.calendar_url);

    let icsData: string;
    try {
      const response = await fetch(calendarImport.calendar_url, {
        headers: {
          'User-Agent': 'FamSink Calendar Sync/1.0',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch calendar: ${response.status} ${response.statusText}`);
      }

      icsData = await response.text();
      console.log('Successfully fetched calendar data');
    } catch (fetchErr) {
      console.error('Error fetching calendar:', fetchErr);
      await supabase
        .from('calendar_imports')
        .update({
          sync_status: 'error',
          error_message: `Failed to fetch calendar: ${fetchErr.message}`,
        })
        .eq('id', calendar_import_id);

      return new Response(
        JSON.stringify({ error: 'Failed to fetch calendar', details: fetchErr.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const events = parseICSData(icsData);
    console.log(`Parsed ${events.length} events from calendar`);

    const existingEvents = await supabase
      .from('events')
      .select('id, external_event_id')
      .eq('calendar_import_id', calendar_import_id);

    const existingEventMap = new Map(
      (existingEvents.data || []).map((e) => [e.external_event_id, e.id])
    );

    const parsedEventIds = new Set(events.map((e) => e.external_event_id));

    const eventsToDelete = (existingEvents.data || [])
      .filter((e) => !parsedEventIds.has(e.external_event_id))
      .map((e) => e.id);

    if (eventsToDelete.length > 0) {
      console.log(`Deleting ${eventsToDelete.length} events no longer in calendar`);
      await supabase
        .from('events')
        .delete()
        .in('id', eventsToDelete);
    }

    let insertCount = 0;
    let updateCount = 0;

    for (const event of events) {
      const existingEventId = existingEventMap.get(event.external_event_id);

      const eventData = {
        profile_id: calendarImport.profile_id,
        title: event.title,
        description: event.description,
        start_time: event.start_time,
        end_time: event.end_time,
        location: event.location,
        location_name: event.location,
        sport: 'General',
        color: '#3B82F6',
        platform: 'Imported',
        platform_color: '#8B5CF6',
        external_source: 'calendar_import',
        external_event_id: event.external_event_id,
        calendar_import_id: calendar_import_id,
        is_read_only: true,
        is_cancelled: event.is_cancelled,
        visibility: 'public' as const,
        updated_at: new Date().toISOString(),
      };

      if (existingEventId) {
        await supabase
          .from('events')
          .update(eventData)
          .eq('id', existingEventId);
        updateCount++;
      } else {
        await supabase
          .from('events')
          .insert({
            ...eventData,
            created_at: new Date().toISOString(),
          });
        insertCount++;
      }
    }

    console.log(`Sync complete: ${insertCount} inserted, ${updateCount} updated, ${eventsToDelete.length} deleted`);

    await supabase
      .from('calendar_imports')
      .update({
        sync_status: 'success',
        last_synced_at: new Date().toISOString(),
        error_message: null,
      })
      .eq('id', calendar_import_id);

    return new Response(
      JSON.stringify({
        success: true,
        inserted: insertCount,
        updated: updateCount,
        deleted: eventsToDelete.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error syncing calendar:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to sync calendar', details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function parseICSData(icsData: string): ParsedEvent[] {
  try {
    const jcalData = ICAL.parse(icsData);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents('vevent');

    const events: ParsedEvent[] = [];

    for (const vevent of vevents) {
      const event = new ICAL.Event(vevent);

      const uid = event.uid || `imported-${Date.now()}-${Math.random()}`;
      const summary = event.summary || 'Untitled Event';
      const description = event.description || null;
      const location = event.location || null;

      const startTime = event.startDate.toJSDate();
      const endTime = event.endDate.toJSDate();

      const status = vevent.getFirstPropertyValue('status');
      const isCancelled = status === 'CANCELLED';

      events.push({
        external_event_id: uid,
        title: summary,
        description,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        location,
        is_cancelled: isCancelled,
      });
    }

    return events;
  } catch (error) {
    console.error('Error parsing ICS data:', error);
    throw new Error(`Failed to parse calendar data: ${error.message}`);
  }
}

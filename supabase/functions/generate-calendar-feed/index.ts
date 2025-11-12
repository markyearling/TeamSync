import { createClient } from 'npm:@supabase/supabase-js@2.39.0';
import ICAL from 'npm:ical.js@1.5.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface Event {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  location: string | null;
  location_name: string | null;
  sport: string;
  platform: string;
  is_cancelled: boolean;
  recurring_group_id: string | null;
  recurrence_pattern: string | null;
  recurrence_end_date: string | null;
  profile_id: string;
}

interface Profile {
  id: string;
  name: string;
  user_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response('Missing token parameter', {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate token and get user_id
    const { data: tokenData, error: tokenError } = await supabase
      .from('calendar_feed_tokens')
      .select('user_id')
      .eq('token', token)
      .maybeSingle();

    if (tokenError || !tokenData) {
      return new Response('Invalid calendar feed token', {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }

    const userId = tokenData.user_id;

    // Update last accessed time and increment access count
    await supabase
      .from('calendar_feed_tokens')
      .update({
        last_accessed_at: new Date().toISOString(),
        access_count: supabase.rpc('increment', { row_id: token }),
      })
      .eq('token', token);

    // Get user's timezone
    const { data: userSettings } = await supabase
      .from('user_settings')
      .select('timezone')
      .eq('user_id', userId)
      .maybeSingle();

    const timezone = userSettings?.timezone || 'UTC';

    // Get all profiles for this user
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name, user_id')
      .eq('user_id', userId);

    if (profilesError || !profiles || profiles.length === 0) {
      // Return empty calendar if no profiles
      const calendar = generateEmptyCalendar();
      return new Response(calendar, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/calendar; charset=utf-8',
          'Content-Disposition': 'attachment; filename="famsink-calendar.ics"',
        },
      });
    }

    const profileIds = profiles.map((p: Profile) => p.id);

    // Get all events for these profiles
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .in('profile_id', profileIds)
      .order('start_time', { ascending: true });

    if (eventsError) {
      throw eventsError;
    }

    // Generate ICS calendar
    const calendar = generateICSCalendar(events || [], profiles, timezone);

    return new Response(calendar, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="famsink-calendar.ics"',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error generating calendar feed:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate calendar feed' }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});

function generateEmptyCalendar(): string {
  const cal = new ICAL.Component(['vcalendar', [], []]);
  cal.updatePropertyWithValue('version', '2.0');
  cal.updatePropertyWithValue('prodid', '-//FamSink//Calendar Feed//EN');
  cal.updatePropertyWithValue('calscale', 'GREGORIAN');
  cal.updatePropertyWithValue('method', 'PUBLISH');
  cal.updatePropertyWithValue('x-wr-calname', 'FamSink Calendar');
  cal.updatePropertyWithValue('x-wr-timezone', 'UTC');
  cal.updatePropertyWithValue('x-wr-caldesc', 'Your FamSink family events calendar');

  return cal.toString();
}

function generateICSCalendar(
  events: Event[],
  profiles: Profile[],
  timezone: string
): string {
  const cal = new ICAL.Component(['vcalendar', [], []]);
  cal.updatePropertyWithValue('version', '2.0');
  cal.updatePropertyWithValue('prodid', '-//FamSink//Calendar Feed//EN');
  cal.updatePropertyWithValue('calscale', 'GREGORIAN');
  cal.updatePropertyWithValue('method', 'PUBLISH');
  cal.updatePropertyWithValue('x-wr-calname', 'FamSink Calendar');
  cal.updatePropertyWithValue('x-wr-timezone', timezone);
  cal.updatePropertyWithValue('x-wr-caldesc', 'Your FamSink family events calendar');

  // Create a timezone component
  const vtimezone = new ICAL.Component('vtimezone');
  vtimezone.updatePropertyWithValue('tzid', timezone);
  cal.addSubcomponent(vtimezone);

  events.forEach((event: Event) => {
    const profile = profiles.find((p: Profile) => p.id === event.profile_id);
    const profileName = profile?.name || 'Unknown';

    const vevent = new ICAL.Component('vevent');

    // UID - unique identifier for the event
    vevent.updatePropertyWithValue('uid', `${event.id}@famsink.com`);

    // Summary (title)
    const summary = `${event.title} - ${profileName}`;
    vevent.updatePropertyWithValue('summary', summary);

    // Description
    let description = `Child: ${profileName}\nSport: ${event.sport}\nPlatform: ${event.platform}`;
    if (event.description) {
      description += `\n\n${event.description}`;
    }
    vevent.updatePropertyWithValue('description', description);

    // Start time
    const startTime = ICAL.Time.fromDateTimeString(event.start_time);
    vevent.updatePropertyWithValue('dtstart', startTime);

    // End time
    const endTime = ICAL.Time.fromDateTimeString(event.end_time);
    vevent.updatePropertyWithValue('dtend', endTime);

    // Location
    if (event.location_name || event.location) {
      vevent.updatePropertyWithValue('location', event.location_name || event.location || '');
    }

    // Status - mark cancelled events
    if (event.is_cancelled) {
      vevent.updatePropertyWithValue('status', 'CANCELLED');
    } else {
      vevent.updatePropertyWithValue('status', 'CONFIRMED');
    }

    // Categories
    vevent.updatePropertyWithValue('categories', [event.sport, event.platform]);

    // Created/Modified timestamps
    const now = ICAL.Time.now();
    vevent.updatePropertyWithValue('dtstamp', now);
    vevent.updatePropertyWithValue('created', now);
    vevent.updatePropertyWithValue('last-modified', now);

    // Add organizer
    vevent.updatePropertyWithValue('organizer', `mailto:noreply@famsink.com`);

    // Handle recurring events
    if (event.recurring_group_id && event.recurrence_pattern && !event.is_cancelled) {
      const rrule = generateRecurrenceRule(event.recurrence_pattern, event.recurrence_end_date);
      if (rrule) {
        vevent.updatePropertyWithValue('rrule', rrule);
      }
    }

    cal.addSubcomponent(vevent);
  });

  return cal.toString();
}

function generateRecurrenceRule(pattern: string, endDate: string | null): any {
  const freq = pattern.toUpperCase();
  const rule: any = { freq };

  // Map patterns to ICAL frequency
  switch (pattern.toLowerCase()) {
    case 'daily':
      rule.freq = 'DAILY';
      break;
    case 'weekly':
      rule.freq = 'WEEKLY';
      break;
    case 'biweekly':
      rule.freq = 'WEEKLY';
      rule.interval = 2;
      break;
    case 'monthly':
      rule.freq = 'MONTHLY';
      break;
    default:
      return null;
  }

  // Add end date if specified
  if (endDate) {
    const until = ICAL.Time.fromDateTimeString(endDate);
    rule.until = until;
  }

  return rule;
}

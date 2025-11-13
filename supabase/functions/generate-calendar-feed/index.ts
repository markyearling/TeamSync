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
  all_day?: boolean;
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
      console.error('Missing token parameter in request');
      return new Response('Missing token parameter', {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }

    console.log('Calendar feed requested for token:', token);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('Missing Supabase environment variables');
      throw new Error('Server configuration error');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    console.log('Validating token...');

    const { data: tokenData, error: tokenError } = await supabase
      .from('calendar_feed_tokens')
      .select('user_id')
      .eq('token', token)
      .maybeSingle();

    if (tokenError) {
      console.error('Error validating token:', tokenError);
      return new Response('Error validating calendar feed token', {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }

    if (!tokenData) {
      console.error('Token not found in database:', token);
      return new Response('Invalid calendar feed token', {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    }

    console.log('Token validated for user:', tokenData.user_id);

    const userId = tokenData.user_id;

    const { error: updateError } = await supabase
      .from('calendar_feed_tokens')
      .update({
        last_accessed_at: new Date().toISOString(),
      })
      .eq('token', token);

    if (updateError) {
      console.error('Error updating token access time:', updateError);
    }

    const { error: incrementError } = await supabase.rpc('increment_access_count', { token_value: token });
    if (incrementError) {
      console.error('Error incrementing access count:', incrementError);
    }

    console.log('Fetching user settings for timezone...');
    const { data: userSettings, error: settingsError } = await supabase
      .from('user_settings')
      .select('timezone')
      .eq('user_id', userId)
      .maybeSingle();

    if (settingsError) {
      console.error('Error fetching user settings:', settingsError);
    }

    const timezone = userSettings?.timezone || 'UTC';
    console.log('Using timezone:', timezone);

    console.log('Fetching profiles for user...');
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, name, user_id')
      .eq('user_id', userId);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
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

    if (!profiles || profiles.length === 0) {
      console.log('No profiles found for user - returning empty calendar');
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

    console.log(`Found ${profiles.length} profiles:`, profiles.map((p: Profile) => ({ id: p.id, name: p.name })));

    const profileIds = profiles.map((p: Profile) => p.id);

    const now = new Date();
    const pastCutoff = new Date(now);
    pastCutoff.setDate(pastCutoff.getDate() - 90);
    const futureCutoff = new Date(now);
    futureCutoff.setDate(futureCutoff.getDate() + 365);

    console.log('Date range filter:', {
      past: pastCutoff.toISOString(),
      future: futureCutoff.toISOString(),
    });

    console.log('Fetching events for profiles:', profileIds);
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .in('profile_id', profileIds)
      .is('calendar_import_id', null)
      .gte('start_time', pastCutoff.toISOString())
      .lte('start_time', futureCutoff.toISOString())
      .order('start_time', { ascending: true });

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
      throw eventsError;
    }

    console.log(`Found ${events?.length || 0} events for calendar feed (after filtering)`);

    if (!events || events.length === 0) {
      console.log('No events found - returning empty calendar');
    } else {
      console.log('Sample event:', events[0]);
      console.log(`Events included: Manual and platform-synced (TeamSnap, SportsEngine, Playmetrics, GameChanger)`);
      console.log(`Events excluded: Calendar imports (external_source = 'calendar_import')`);
    }

    const calendar = generateICSCalendar(events || [], profiles, timezone);
    console.log(`Generated ICS calendar with ${events?.length || 0} events`);

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

  events.forEach((event: Event) => {
    const profile = profiles.find((p: Profile) => p.id === event.profile_id);
    const profileName = profile?.name || 'Unknown';

    const vevent = new ICAL.Component('vevent');

    vevent.updatePropertyWithValue('uid', `${event.id}@famsink.com`);

    const summary = `${event.title} - ${profileName}`;
    vevent.updatePropertyWithValue('summary', summary);

    let description = `Child: ${profileName}\nSport: ${event.sport}\nPlatform: ${event.platform}`;
    if (event.description) {
      description += `\n\n${event.description}`;
    }
    vevent.updatePropertyWithValue('description', description);

    const isAllDay = isAllDayEvent(event.start_time, event.end_time);

    if (isAllDay) {
      const startDate = ICAL.Time.fromDateTimeString(event.start_time);
      startDate.isDate = true;
      vevent.updatePropertyWithValue('dtstart', startDate);

      const endDate = ICAL.Time.fromDateTimeString(event.end_time);
      endDate.isDate = true;
      vevent.updatePropertyWithValue('dtend', endDate);
    } else {
      const startTime = ICAL.Time.fromDateTimeString(event.start_time);
      startTime.zone = ICAL.Timezone.utcTimezone;
      vevent.updatePropertyWithValue('dtstart', startTime);

      const endTime = ICAL.Time.fromDateTimeString(event.end_time);
      endTime.zone = ICAL.Timezone.utcTimezone;
      vevent.updatePropertyWithValue('dtend', endTime);
    }

    if (event.location_name || event.location) {
      vevent.updatePropertyWithValue('location', event.location_name || event.location || '');
    }

    if (event.is_cancelled) {
      vevent.updatePropertyWithValue('status', 'CANCELLED');
    } else {
      vevent.updatePropertyWithValue('status', 'CONFIRMED');
    }

    vevent.updatePropertyWithValue('categories', `${event.sport}, ${event.platform}`);

    const now = ICAL.Time.now();
    now.zone = ICAL.Timezone.utcTimezone;
    vevent.updatePropertyWithValue('dtstamp', now);
    vevent.updatePropertyWithValue('created', now);
    vevent.updatePropertyWithValue('last-modified', now);

    vevent.updatePropertyWithValue('organizer', `mailto:noreply@famsink.com`);

    if (event.recurring_group_id && event.recurrence_pattern && !event.is_cancelled) {
      try {
        const rrule = generateRecurrenceRule(event.recurrence_pattern, event.recurrence_end_date);
        if (rrule) {
          vevent.updatePropertyWithValue('rrule', rrule);
        }
      } catch (error) {
        console.error(`Failed to generate RRULE for event ${event.id}:`, error);
      }
    }

    cal.addSubcomponent(vevent);
  });

  return cal.toString();
}

function isAllDayEvent(startTime: string, endTime: string): boolean {
  const start = new Date(startTime);
  const end = new Date(endTime);

  const startAtMidnight = start.getUTCHours() === 0 && start.getUTCMinutes() === 0 && start.getUTCSeconds() === 0;

  const endAtMidnight = end.getUTCHours() === 0 && end.getUTCMinutes() === 0 && end.getUTCSeconds() === 0;

  const durationMs = end.getTime() - start.getTime();
  const durationHours = durationMs / (1000 * 60 * 60);
  const isFullDays = durationHours % 24 === 0;

  return startAtMidnight && endAtMidnight && isFullDays;
}


function generateRecurrenceRule(pattern: string, endDate: string | null): any {
  const freq = pattern.toUpperCase();
  const rule: any = { freq };

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

  if (endDate && endDate.trim() !== '') {
    try {
      const date = new Date(endDate);

      if (isNaN(date.getTime())) {
        console.error(`Invalid recurrence end date: ${endDate}`);
        return rule;
      }

      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      const hours = String(date.getUTCHours()).padStart(2, '0');
      const minutes = String(date.getUTCMinutes()).padStart(2, '0');
      const seconds = String(date.getUTCSeconds()).padStart(2, '0');

      const isDateOnly = hours === '00' && minutes === '00' && seconds === '00';

      if (isDateOnly) {
        rule.until = `${year}${month}${day}`;
      } else {
        rule.until = `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
      }
    } catch (error) {
      console.error(`Error parsing recurrence end date "${endDate}":`, error);
    }
  }

  return rule;
}
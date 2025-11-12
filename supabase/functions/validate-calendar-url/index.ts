import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { calendar_url } = await req.json();

    if (!calendar_url || typeof calendar_url !== 'string') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'calendar_url is required and must be a string',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    let url: URL;
    try {
      url = new URL(calendar_url);
    } catch {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid URL format',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Only HTTP and HTTPS protocols are supported',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const response = await fetch(calendar_url, {
      method: 'GET',
      headers: {
        'User-Agent': 'FamSink Calendar Validator/1.0',
        'Accept': 'text/calendar, text/plain, */*',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to fetch calendar: ${response.status} ${response.statusText}`,
          status_code: response.status,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const contentType = response.headers.get('content-type');
    const icsData = await response.text();

    if (!icsData.includes('BEGIN:VCALENDAR')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid calendar format - not a valid ICS file',
          content_type: contentType,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const eventMatches = icsData.match(/BEGIN:VEVENT/g);
    const eventCount = eventMatches ? eventMatches.length : 0;

    const calendarNameMatch = icsData.match(/X-WR-CALNAME:(.+)/);
    const calendarName = calendarNameMatch ? calendarNameMatch[1].trim() : null;

    const calendarDescMatch = icsData.match(/X-WR-CALDESC:(.+)/);
    const calendarDescription = calendarDescMatch ? calendarDescMatch[1].trim() : null;

    return new Response(
      JSON.stringify({
        success: true,
        event_count: eventCount,
        calendar_name: calendarName,
        calendar_description: calendarDescription,
        content_type: contentType,
        message: `Calendar is valid! Found ${eventCount} event${eventCount !== 1 ? 's' : ''}.`,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error validating calendar URL:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to validate calendar URL',
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});

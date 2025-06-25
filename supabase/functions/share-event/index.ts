import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import sgMail from 'npm:@sendgrid/mail@8.1.1';

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

    const { event, recipientEmail } = await req.json();
    
    // Use environment variable for sender email with fallback
    const fromEmail = Deno.env.get('EMAIL_FROM_ADDRESS') ?? 'noreply@teamsync.com';

    // Set SendGrid API key
    sgMail.setApiKey(Deno.env.get('SENDGRID_API_KEY') ?? '');

    const msg = {
      to: recipientEmail,
      from: fromEmail,
      subject: `Shared Event: ${event.title}`,
      html: `
        <h2>${event.title}</h2>
        <p><strong>Date:</strong> ${event.startTime}</p>
        <p><strong>Time:</strong> ${event.startTime.split('T')[1].slice(0, 5)} - ${event.endTime.split('T')[1].slice(0, 5)}</p>
        ${event.location ? `<p><strong>Location:</strong> ${event.location}</p>` : ''}
        ${event.description ? `<p><strong>Description:</strong> ${event.description}</p>` : ''}
        <p><strong>Child:</strong> ${event.child.name}</p>
        <p><strong>Sport:</strong> ${event.sport}</p>
      `,
    };

    await sgMail.send(msg);

    return new Response(
      JSON.stringify({ message: 'Event shared successfully' }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
        status: 200,
      }
    );
  } catch (error) {
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
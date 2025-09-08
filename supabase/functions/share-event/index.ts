
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface ShareEventRequest {
  event: any;
  recipientEmail: string;
}

Deno.serve(async (req) => {
  console.log('=== Share Event Function Started ===');
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
    console.log('Processing POST request...');
    
    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
      console.log('Request body parsed successfully');
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      throw new Error('Invalid JSON in request body');
    }

    const { event, recipientEmail }: ShareEventRequest = requestBody;

    if (!event || !recipientEmail) {
      console.error('Missing required fields:', { hasEvent: !!event, recipientEmail: !!recipientEmail });
      throw new Error('Event and recipient email are required');
    }

    console.log('Validation passed for sharing event:', event.title, 'to:', recipientEmail);

    // Check environment variables
    const sendGridApiKey = Deno.env.get('SENDGRID_API_KEY');
    const fromEmail = Deno.env.get('EMAIL_FROM_ADDRESS') ?? 'noreply@famsink.com';

    console.log('Environment variables check:');
    console.log('- FROM_EMAIL:', fromEmail);
    console.log('- SENDGRID_API_KEY:', sendGridApiKey ? 'Present' : 'Missing');

    if (!sendGridApiKey) {
      console.log('SendGrid API key not configured, skipping email notification');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Event sharing skipped (SendGrid not configured)' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Format event date and time
    const eventDate = new Date(event.startTime);
    const eventEndDate = new Date(event.endTime);
    
    const formattedDate = eventDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const formattedStartTime = eventDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    const formattedEndTime = eventEndDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    console.log('Formatted event details:', { formattedDate, formattedStartTime, formattedEndTime });

    // Prepare email content
    const emailContent = {
      personalizations: [
        {
          to: [{ email: recipientEmail }],
          subject: `Shared Event: ${event.title}`
        }
      ],
      from: { email: fromEmail },
      content: [
        {
          type: 'text/plain',
          value: `
            ${event.title}
            
            Date: ${formattedDate}
            Time: ${formattedStartTime} - ${formattedEndTime}
            ${event.location ? `Location: ${event.location}` : ''}
            ${event.description ? `Description: ${event.description}` : ''}
            Child: ${event.child.name}
            Sport: ${event.sport}
            Platform: ${event.platform}
            
            This event was shared with you via FamSink.
          `
        },
        {
          type: 'text/html',
          value: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Shared Event: ${event.title}</title>
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">FamSink</h1>
                <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 16px;">Event Shared With You</p>
              </div>
              
              <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                <div style="text-align: center; margin-bottom: 30px;">
                  <h2 style="color: #1f2937; margin: 0 0 10px 0; font-size: 24px; font-weight: 600;">${event.title}</h2>
                  <div style="display: inline-flex; align-items: center; background: ${event.color}20; color: ${event.color}; padding: 6px 12px; border-radius: 20px; font-size: 14px; font-weight: 500;">
                    ${event.sport}
                  </div>
                </div>
                
                <div style="background: #f9fafb; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
                  <div style="display: grid; gap: 15px;">
                    <div style="display: flex; align-items: center;">
                      <div style="width: 40px; height: 40px; background: #3b82f6; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px;">
                        <span style="color: white; font-size: 18px;">📅</span>
                      </div>
                      <div>
                        <div style="font-weight: 600; color: #374151;">${formattedDate}</div>
                        <div style="color: #6b7280; font-size: 14px;">${formattedStartTime} - ${formattedEndTime}</div>
                      </div>
                    </div>
                    
                    ${event.location ? `
                    <div style="display: flex; align-items: center;">
                      <div style="width: 40px; height: 40px; background: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px;">
                        <span style="color: white; font-size: 18px;">📍</span>
                      </div>
                      <div>
                        <div style="font-weight: 600; color: #374151;">Location</div>
                        <div style="color: #6b7280; font-size: 14px;">${event.location_name || event.location}</div>
                      </div>
                    </div>
                    ` : ''}
                    
                    <div style="display: flex; align-items: center;">
                      <div style="width: 40px; height: 40px; background: ${event.child.color}; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 15px;">
                        <span style="color: white; font-size: 16px; font-weight: bold;">${event.child.name.charAt(0)}</span>
                      </div>
                      <div>
                        <div style="font-weight: 600; color: #374151;">${event.child.name}</div>
                        <div style="color: #6b7280; font-size: 14px;">Participant</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                ${event.description ? `
                <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                  <h3 style="color: #92400e; margin: 0 0 10px 0; font-size: 14px; font-weight: 600;">Event Details</h3>
                  <p style="color: #92400e; margin: 0; white-space: pre-wrap;">${event.description}</p>
                </div>
                ` : ''}
                
                <div style="background: #e0f2fe; border: 1px solid #0284c7; padding: 15px; border-radius: 6px; margin-bottom: 20px;">
                  <div style="display: flex; align-items: center; color: #0369a1;">
                    <span style="margin-right: 8px;">ℹ️</span>
                    <span style="font-size: 14px; font-weight: 500;">Synced from ${event.platform}</span>
                  </div>
                </div>
                
                ${event.location ? `
                <div style="text-align: center; margin-bottom: 20px;">
                  <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}" 
                     style="display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">
                    Get Directions
                  </a>
                </div>
                ` : ''}
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                    This event was shared with you via FamSink.
                  </p>
                  <p style="color: #9ca3af; font-size: 12px; margin: 5px 0 0 0;">
                    © 2025 FamSink. All rights reserved.
                  </p>
                </div>
              </div>
            </body>
            </html>
          `
        }
      ]
    };

    console.log('Email content prepared');
    console.log('SendGrid API URL: https://api.sendgrid.com/v3/mail/send');

    // Send email using SendGrid
    console.log('Making request to SendGrid API...');
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendGridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailContent),
    });

    console.log('SendGrid API response status:', response.status);
    console.log('SendGrid API response status text:', response.statusText);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.text();
        console.error('SendGrid API error response body:', errorData);
      } catch (readError) {
        console.error('Could not read error response body:', readError);
        errorData = 'Could not read error details';
      }

      console.error('SendGrid API error details:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: errorData
      });

      throw new Error(`SendGrid API error: ${response.status} ${response.statusText} - ${errorData}`);
    }

    console.log('Email sent successfully via SendGrid API');
    console.log('Event shared successfully to:', recipientEmail);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Event shared successfully' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('=== ERROR IN SHARE EVENT FUNCTION ===');
    console.error('Error type:', typeof error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Full error object:', error);

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
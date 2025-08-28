const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface SupportEmailRequest {
  userEmail: string;
  summary: string;
}

Deno.serve(async (req) => {
  console.log('=== Support Email Function Started ===');
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
      console.log('Request body parsed successfully:', { 
        userEmail: requestBody.userEmail, 
        summary: requestBody.summary ? 'Present' : 'Missing'
      });
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      throw new Error('Invalid JSON in request body');
    }

    const { userEmail, summary }: SupportEmailRequest = requestBody;

    if (!userEmail || !summary) {
      console.error('Missing required fields:', { userEmail: !!userEmail, summary: !!summary });
      throw new Error('User email and summary are required');
    }

    console.log('Validation passed for support request from:', userEmail);

    // Check environment variables
    const sendGridApiKey = Deno.env.get('SENDGRID_API_KEY');
    const fromEmail = Deno.env.get('EMAIL_FROM_ADDRESS') ?? 'noreply@famsink.com';
    const supportEmail = 'support@famsink.com';

    console.log('Environment variables check:');
    console.log('- FROM_EMAIL:', fromEmail);
    console.log('- SUPPORT_EMAIL:', supportEmail);
    console.log('- SENDGRID_API_KEY:', sendGridApiKey ? 'Present' : 'Missing');

    if (!sendGridApiKey) {
      console.log('SendGrid API key not configured, skipping email notification');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Support email skipped (SendGrid not configured)' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Format current date and time
    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const formattedTime = now.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short'
    });

    console.log('Formatted date/time:', { formattedDate, formattedTime });

    // Prepare email content
    const emailContent = {
      personalizations: [
        {
          to: [{ email: supportEmail }],
          subject: `FamSink Support Request from ${userEmail}`
        }
      ],
      from: { email: fromEmail },
      content: [
        {
          type: 'text/plain',
          value: `
            New Support Request
            
            From: ${userEmail}
            Date: ${formattedDate}
            Time: ${formattedTime}
            
            Summary:
            ${summary}
            
            This email was sent from the FamSink support form.
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
              <title>FamSink Support Request</title>
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">FamSink Support</h1>
                <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 16px;">New Support Request</p>
              </div>
              
              <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                <div style="margin-bottom: 30px;">
                  <h2 style="color: #1f2937; margin: 0 0 20px 0; font-size: 18px;">Support Request Details</h2>
                  
                  <div style="background: #f9fafb; padding: 20px; border-radius: 6px; margin-bottom: 20px;">
                    <p style="margin: 0 0 10px 0; color: #374151;"><strong>From:</strong> ${userEmail}</p>
                    <p style="margin: 0 0 10px 0; color: #374151;"><strong>Date:</strong> ${formattedDate}</p>
                    <p style="margin: 0; color: #374151;"><strong>Time:</strong> ${formattedTime}</p>
                  </div>
                  
                  <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 20px; border-radius: 6px;">
                    <h3 style="color: #92400e; margin: 0 0 10px 0; font-size: 16px; font-weight: 600;">Issue Summary</h3>
                    <p style="color: #92400e; margin: 0; white-space: pre-wrap;">${summary}</p>
                  </div>
                </div>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                    This email was sent from the FamSink support form.
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
    console.log('Support email sent successfully to:', supportEmail);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Support email sent successfully' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('=== ERROR IN SUPPORT EMAIL FUNCTION ===');
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
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface FriendRequestEmailRequest {
  to_email: string;
  requester_name: string;
  message?: string;
}

Deno.serve(async (req) => {
  console.log('=== Friend Request Email Function Started ===');
  console.log('Request method:', req.method);

  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    console.log('Processing friend request email...');

    let requestBody;
    try {
      requestBody = await req.json();
      console.log('Request body parsed successfully:', {
        to_email: requestBody.to_email,
        requester_name: requestBody.requester_name,
        has_message: !!requestBody.message
      });
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      throw new Error('Invalid JSON in request body');
    }

    const { to_email, requester_name, message }: FriendRequestEmailRequest = requestBody;

    if (!to_email || !requester_name) {
      console.error('Missing required fields:', {
        to_email: !!to_email,
        requester_name: !!requester_name
      });
      throw new Error('Missing required fields: to_email or requester_name');
    }

    console.log('Email validation passed for:', to_email);

    const fromEmail = Deno.env.get('EMAIL_FROM_ADDRESS') ?? 'noreply@famsink.com';
    const sendGridApiKey = Deno.env.get('SENDGRID_API_KEY');

    console.log('Environment variables check:');
    console.log('- FROM_EMAIL:', fromEmail);
    console.log('- SENDGRID_API_KEY:', sendGridApiKey ? 'Present' : 'Missing');

    if (!sendGridApiKey) {
      console.log('SendGrid API key not configured, skipping email notification');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Friend request email skipped (SendGrid not configured)'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log('Preparing email content for friend request');

    const appUrl = 'https://sprightly-lebkuchen-6e85b6.netlify.app';
    const friendsPageUrl = `${appUrl}/friends`;

    const emailContent = {
      personalizations: [
        {
          to: [{ email: to_email }],
          subject: `${requester_name} sent you a friend request on FamSink`
        }
      ],
      from: { email: fromEmail },
      content: [
        {
          type: 'text/plain',
          value: `
            ${requester_name} sent you a friend request on FamSink!

            ${message ? `Message: "${message}"` : ''}

            To accept or decline this friend request, please visit your Friends page:
            ${friendsPageUrl}

            About Friend Requests:
            - Accepting a friend request allows you to chat with ${requester_name}.
            - You can also grant viewing or administrator permissions to share schedules and events.

            © 2025 FamSink. All rights reserved.
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
              <title>New Friend Request on FamSink</title>
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
                <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">FamSink</h1>
                <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 16px;">Your Family Sports Hub</p>
              </div>

              <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                <div style="text-align: center; margin-bottom: 30px;">
                  <div style="display: inline-block; background: #dbeafe; color: #1e40af; padding: 10px 20px; border-radius: 50px; font-size: 14px; font-weight: 500; margin-bottom: 20px;">
                    New Friend Request
                  </div>
                  <h2 style="color: #1f2937; margin: 0 0 10px 0; font-size: 20px;">
                    ${requester_name} sent you a friend request!
                  </h2>
                  ${message ? `
                    <div style="background: #f9fafb; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 3px solid #2563eb;">
                      <p style="color: #6b7280; margin: 0; font-size: 14px; font-style: italic;">
                        "${message}"
                      </p>
                    </div>
                  ` : ''}
                </div>

                <div style="background: #f9fafb; padding: 20px; border-radius: 6px; margin-bottom: 30px;">
                  <h3 style="color: #374151; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">About Friend Requests</h3>
                  <ul style="list-style: none; padding: 0; margin: 0; color: #6b7280; font-size: 14px;">
                    <li style="margin-bottom: 10px;">
                      <span style="color: #2563eb; font-weight: bold; margin-right: 5px;">•</span>
                      Accepting allows you to chat with ${requester_name}.
                    </li>
                    <li style="margin-bottom: 10px;">
                      <span style="color: #2563eb; font-weight: bold; margin-right: 5px;">•</span>
                      You can grant viewing permissions to share schedules.
                    </li>
                    <li>
                      <span style="color: #2563eb; font-weight: bold; margin-right: 5px;">•</span>
                      Administrator access allows managing events and profiles.
                    </li>
                  </ul>
                </div>

                <div style="text-align: center;">
                  <a href="${friendsPageUrl}"
                     style="display: inline-block; background: #2563eb; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">
                    View Friend Request
                  </a>
                </div>

                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
                  <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                    This email was sent to ${to_email}.
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

    console.log('Email content prepared, sending via SendGrid...');

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendGridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailContent),
    });

    console.log('SendGrid API response status:', response.status);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.text();
        console.error('SendGrid API error response:', errorData);
      } catch (readError) {
        console.error('Could not read error response:', readError);
        errorData = 'Could not read error details';
      }

      throw new Error(`SendGrid API error: ${response.status} ${response.statusText} - ${errorData}`);
    }

    console.log('Friend request email sent successfully to:', to_email);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Friend request email sent successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('=== ERROR IN FRIEND REQUEST EMAIL FUNCTION ===');
    console.error('Error type:', typeof error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');

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
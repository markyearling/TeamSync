const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface WelcomeEmailRequest {
  email: string;
  full_name?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const { email, full_name }: WelcomeEmailRequest = await req.json();

    if (!email) {
      throw new Error('Email address is required');
    }

    // Use environment variable for sender email with fallback
    const fromEmail = Deno.env.get('EMAIL_FROM_ADDRESS') ?? 'noreply@famsink.com';
    const sendGridApiKey = Deno.env.get('SENDGRID_API_KEY');

    if (!sendGridApiKey) {
      console.log('SendGrid API key not configured, skipping email notification');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Welcome email skipped (SendGrid not configured)' 
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const userName = full_name || email; // Fallback to email if name not provided

    // Prepare email content
    const emailContent = {
      to: email,
      from: fromEmail,
      subject: 'Welcome to FamSink!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to FamSink!</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">FamSink</h1>
            <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 16px;">Your Family Sports Hub</p>
          </div>
          
          <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h2 style="color: #1f2937; margin: 0 0 10px 0; font-size: 20px;">Hello ${userName},</h2>
              <p style="color: #6b7280; margin: 0; font-size: 16px;">
                Welcome to FamSink! We're thrilled to have you join our community.
                FamSink helps you effortlessly manage your children's sports schedules, connect with other parents, and stay organized.
              </p>
            </div>
            
            <div style="background: #f9fafb; padding: 20px; border-radius: 6px; margin-bottom: 30px;">
              <h3 style="color: #374151; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">What's Next?</h3>
              <ul style="list-style: none; padding: 0; margin: 0; color: #6b7280; font-size: 14px;">
                <li style="margin-bottom: 10px;">
                  <span style="color: #2563eb; font-weight: bold; margin-right: 5px;">•</span>
                  Create profiles for your children and add their sports activities.
                </li>
                <li style="margin-bottom: 10px;">
                  <span style="color: #2563eb; font-weight: bold; margin-right: 5px;">•</span>
                  Connect to popular sports platforms like TeamSnap and SportsEngine to import schedules.
                </li>
                <li>
                  <span style="color: #2563eb; font-weight: bold; margin-right: 5px;">•</span>
                  Invite friends and family to share schedules and communicate easily.
                </li>
              </ul>
            </div>
            
            <div style="text-align: center;">
              <a href="https://sprightly-lebkuchen-6e85b6.netlify.app/" 
                 style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">
                Go to Your Dashboard
              </a>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                This email was sent to ${email}.
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 5px 0 0 0;">
                © 2025 FamSink. All rights reserved.
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
        Welcome to FamSink, ${userName}!
        
        We're thrilled to have you join our community. FamSink helps you effortlessly manage your children's sports schedules, connect with other parents, and stay organized.
        
        What's Next?
        - Create profiles for your children and add their sports activities.
        - Connect to popular sports platforms like TeamSnap and SportsEngine to import schedules.
        - Invite friends and family to share schedules and communicate easily.
        
        Go to your dashboard: https://sprightly-lebkuchen-6e85b6.netlify.app/
        
        © 2025 FamSink. All rights reserved.
      `
    };

    console.log('Sending email with SendGrid API...');
    console.log('From email:', fromEmail);
    console.log('To email:', email);

    // Send email using SendGrid
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${sendGridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailContent),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('SendGrid API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      throw new Error(`Failed to send email: ${response.status} ${response.statusText}`);
    }

    console.log('Welcome email sent successfully to:', email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Welcome email sent successfully' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error sending welcome email:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
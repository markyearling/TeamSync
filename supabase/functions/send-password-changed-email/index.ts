const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface PasswordChangedEmailRequest {
  email: string;
  userAgent?: string;
  ipAddress?: string;
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
    const { email, userAgent, ipAddress }: PasswordChangedEmailRequest = await req.json();

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
          message: 'Password changed successfully (email notification skipped - not configured)' 
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

    // Prepare email content
    const emailContent = {
      to: email,
      from: fromEmail,
      subject: 'Your FamSink password has been changed',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Changed - FamSink</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">FamSink</h1>
            <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 16px;">Password Changed Successfully</p>
          </div>
          
          <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="width: 60px; height: 60px; background: #10b981; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 20px;">
                <span style="color: white; font-size: 24px;">✓</span>
              </div>
              <h2 style="color: #1f2937; margin: 0 0 10px 0; font-size: 20px;">Password Updated</h2>
              <p style="color: #6b7280; margin: 0; font-size: 16px;">Your account password has been successfully changed.</p>
            </div>
            
            <div style="background: #f9fafb; padding: 20px; border-radius: 6px; margin-bottom: 30px;">
              <h3 style="color: #374151; margin: 0 0 15px 0; font-size: 16px; font-weight: 600;">Change Details:</h3>
              <div style="color: #6b7280; font-size: 14px; line-height: 1.5;">
                <p style="margin: 5px 0;"><strong>Date:</strong> ${formattedDate}</p>
                <p style="margin: 5px 0;"><strong>Time:</strong> ${formattedTime}</p>
                ${userAgent ? `<p style="margin: 5px 0;"><strong>Device:</strong> ${userAgent}</p>` : ''}
                ${ipAddress ? `<p style="margin: 5px 0;"><strong>IP Address:</strong> ${ipAddress}</p>` : ''}
              </div>
            </div>
            
            <div style="background: #fef3c7; border: 1px solid #f59e0b; padding: 15px; border-radius: 6px; margin-bottom: 30px;">
              <h3 style="color: #92400e; margin: 0 0 10px 0; font-size: 14px; font-weight: 600;">Security Notice</h3>
              <p style="color: #92400e; margin: 0; font-size: 13px;">
                If you didn't make this change, please contact our support team immediately and consider securing your account.
              </p>
            </div>
            
            <div style="text-align: center;">
              <a href="https://soft-zuccutto-53a90d.netlify.app/auth/signin" 
                 style="display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px;">
                Sign In to FamSink
              </a>
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                This email was sent to ${email} because your FamSink account password was changed.
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
        FamSink - Password Changed Successfully
        
        Your account password has been successfully changed.
        
        Change Details:
        Date: ${formattedDate}
        Time: ${formattedTime}
        ${userAgent ? `Device: ${userAgent}` : ''}
        ${ipAddress ? `IP Address: ${ipAddress}` : ''}
        
        Security Notice:
        If you didn't make this change, please contact our support team immediately.
        
        Sign in to your account: https://soft-zuccutto-53a90d.netlify.app/auth/signin
        
        This email was sent to ${email} because your FamSink account password was changed.
      `
    };

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

    console.log('Password changed email sent successfully to:', email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Password changed email sent successfully' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error sending password changed email:', error);

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
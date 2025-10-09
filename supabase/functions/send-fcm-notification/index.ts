import { create, getNumericDate } from 'https://deno.land/x/djwt@v2.8/mod.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface FCMNotificationRequest {
  fcmToken: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

// Helper function to convert PEM private key to CryptoKey
async function importPrivateKey(privateKeyPem: string): Promise<CryptoKey> {
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  
  console.log('--- Debugging importPrivateKey ---');
  console.log('Step 1: Original privateKeyPem (first 100 chars):', privateKeyPem.substring(0, Math.min(privateKeyPem.length, 100)));
  console.log('Step 1: Original privateKeyPem length:', privateKeyPem.length);

  let pemContents = privateKeyPem
    .replace(pemHeader, '')
    .replace(pemFooter, '');
  
  console.log('Step 2: pemContents after header/footer removal (first 100 chars):', pemContents.substring(0, Math.min(pemContents.length, 100)));
  console.log('Step 2: pemContents length:', pemContents.length);

  // Remove ALL whitespace characters (including newlines, spaces, tabs, etc.)
  // This assumes the input `privateKeyPem` contains actual newline characters (`\n`)
  // after JSON.parse has processed the `\\n` from the environment variable.
  pemContents = pemContents.replace(/\s/g, ''); 

  console.log('Step 3: pemContents after whitespace removal (first 100 chars):', pemContents.substring(0, Math.min(pemContents.length, 100)));
  console.log('Step 3: pemContents length before atob:', pemContents.length);
  
  // Ensure proper base64 padding.
  while (pemContents.length % 4 !== 0) {
    pemContents += '=';
  }
  console.log('Step 3.1: pemContents after ensuring padding (first 100 chars):', pemContents.substring(0, Math.min(pemContents.length, 100)));
  console.log('Step 3.1: pemContents length after ensuring padding:', pemContents.length);

  // Log the exact string being passed to atob
  console.log('Step 4: String passed to atob (first 100 chars):', pemContents.substring(0, Math.min(pemContents.length, 100)));
  console.log('Step 4: String passed to atob length:', pemContents.length);
  
  let binaryDer;
  try {
    binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  } catch (e) {
    console.error('Error during atob decoding:', e);
    console.error('Problematic pemContents (first 100 chars):', pemContents.substring(0, Math.min(pemContents.length, 100)));
    console.error('Problematic pemContents length:', pemContents.length);
    throw e; // Re-throw to propagate the original error
  }

  console.log('Step 5: Successfully base64 decoded. Binary data length:', binaryDer.length);

  return await crypto.subtle.importKey(
    'pkcs8',
    binaryDer,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );
}

// Helper function to generate OAuth 2.0 access token from Service Account Key
async function getOAuthAccessToken(serviceAccount: any): Promise<string> {
  const now = getNumericDate(0); // Current timestamp in seconds
  const expires = getNumericDate(3600); // Token expires in 1 hour (3600 seconds)

  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const payload = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: expires,
  };

  console.log('--- getOAuthAccessToken Debugging ---');
  console.log('Service Account Project ID:', serviceAccount.project_id);
  console.log('Service Account Client Email:', serviceAccount.client_email);
  console.log('JWT Payload being created:', JSON.stringify(payload, null, 2));

  console.log('Creating JWT with payload:', payload);

  // Import the private key from the service account
  const cryptoKey = await importPrivateKey(serviceAccount.private_key);

  // Create and sign the JWT
  const jwt = await create(header, payload, cryptoKey);
  console.log('JWT created successfully');

  // Exchange JWT for OAuth 2.0 access token
  console.log('Exchanging JWT for OAuth access token...');
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('Error exchanging JWT for OAuth token:', errorText);
    throw new Error(`Failed to get OAuth access token: ${tokenResponse.status} ${tokenResponse.statusText}`);
  }

  const tokenData = await tokenResponse.json();
  console.log('OAuth access token obtained successfully');
  return tokenData.access_token;
}

Deno.serve(async (req) => {
  console.log('=== FCM Notification Sender Function Started ===');
  console.log('Request method:', req.method);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    console.log('Processing FCM notification request...');
    
    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
      console.log('Request body parsed successfully:', {
        hasFcmToken: !!requestBody.fcmToken,
        title: requestBody.title,
        body: requestBody.body,
        hasData: !!requestBody.data
      });
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      throw new Error('Invalid JSON in request body');
    }

    const { fcmToken, title, body, data }: FCMNotificationRequest = requestBody;

    if (!fcmToken || !title || !body) {
      console.error('Missing required fields:', { 
        fcmToken: !!fcmToken, 
        title: !!title, 
        body: !!body 
      });
      throw new Error('Missing required fields: fcmToken, title, or body');
    }

    // Detailed logging for debugging
    console.log(`[FCM Sender] Received fcmToken: ${fcmToken.substring(0, 20)}...`);
    console.log(`[FCM Sender] FCM Token length: ${fcmToken.length}`);
    console.log(`[FCM Sender] Notification Title: ${title}`);
    console.log(`[FCM Sender] Notification Body: ${body}`);
    console.log(`[FCM Sender] Notification Data:`, JSON.stringify(data));

    // Get Firebase Service Account JSON from environment
    const serviceAccountJson = Deno.env.get('FIREBASE_SERVICE_ACCOUNT_JSON');

    if (!serviceAccountJson) {
      console.error('FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not set');
      throw new Error('FCM credentials missing - Firebase Service Account JSON not configured');
    }

    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
      console.log('Service account parsed successfully:', {
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email
      });
    } catch (parseError) {
      console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON:', parseError);
      throw new Error('Invalid Firebase Service Account JSON format');
    }

    // Validate required fields in service account
    if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
      throw new Error('Invalid Firebase Service Account JSON - missing required fields');
    }

    console.log('Getting OAuth access token...');
    const accessToken = await getOAuthAccessToken(serviceAccount);

    // Prepare FCM payload
    const fcmPayload = {
      message: {
        token: fcmToken,
        notification: {
          title: title,
          body: body,
        },
        data: data || {}, // Custom data payload (must be string key-value pairs)
        android: {
          notification: {
            click_action: 'FLUTTER_NOTIFICATION_CLICK', // For handling notification taps
            sound: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      },
    };

    console.log('Sending FCM notification...');
    console.log('[FCM Sender] FCM Payload being sent:', JSON.stringify(fcmPayload, null, 2));

    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;
    console.log('[FCM Sender] FCM API URL:', fcmUrl);
    console.log('[FCM Sender] FCM API URL:', fcmUrl);
    
    const response = await fetch(fcmUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(fcmPayload),
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
        console.error('FCM API error response:', errorData);
      } catch (readError) {
        console.error('Could not read FCM error response:', readError);
        errorData = { error: 'Could not read error details' };
      }

      console.error('FCM send failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });

      // Check if the error is due to invalid/expired token
      const errorCode = errorData?.error?.details?.[0]?.errorCode || errorData?.error?.code;
      const isInvalidToken = errorCode === 'UNREGISTERED' ||
                            errorCode === 'INVALID_ARGUMENT' ||
                            response.status === 404;

      if (isInvalidToken) {
        console.log('[FCM Cleanup] Detected invalid/expired token, removing from database...');
        console.log(`[FCM Cleanup] Token to remove (first 20 chars): ${fcmToken.substring(0, 20)}...`);

        // Initialize Supabase client for cleanup
        const supabaseCleanup = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
          {
            auth: {
              persistSession: false,
            }
          }
        );

        try {
          // Remove the invalid token from user_devices table
          const { error: cleanupError } = await supabaseCleanup
            .rpc('remove_invalid_device_token', { p_fcm_token: fcmToken });

          if (cleanupError) {
            console.error('[FCM Cleanup] Error removing invalid token:', cleanupError);
          } else {
            console.log('[FCM Cleanup] Successfully removed invalid/expired device token from database');
          }
        } catch (cleanupException) {
          console.error('[FCM Cleanup] Exception while cleaning up invalid token:', cleanupException);
        }
      }

      throw new Error(`FCM send failed: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const responseData = await response.json();
    console.log('FCM notification sent successfully:', responseData);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'FCM notification sent successfully',
        fcmResponse: responseData
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );

  } catch (error) {
    console.error('=== ERROR IN FCM NOTIFICATION SENDER ===');
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
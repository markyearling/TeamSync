import { create, getNumericDate } from 'https://deno.land/x/djwt@v2.8/mod.ts';

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
  // Remove PEM headers and footers, and decode base64
  const pemHeader = '-----BEGIN PRIVATE KEY-----';
  const pemFooter = '-----END PRIVATE KEY-----';
  
  let pemContents = privateKeyPem
    .replace(pemHeader, '')
    .replace(pemFooter, '');
  
  // Remove all whitespace characters (including actual newlines)
  // and then aggressively remove any characters that are NOT valid base64 characters.
  // This ensures only valid base64 characters remain.
  pemContents = pemContents.replace(/\s/g, '').replace(/[^A-Za-z0-9+/=]/g, ''); 

  // Add extensive logging here to inspect the string before atob
  console.log('--- Debugging importPrivateKey ---');
  console.log('Original privateKeyPem (first 100 chars):', privateKeyPem.substring(0, Math.min(privateKeyPem.length, 100)));
  console.log('pemContents after header/footer removal (first 100 chars):', pemContents.substring(0, Math.min(pemContents.length, 100)));
  console.log('pemContents after whitespace and invalid char removal (first 100 chars):', pemContents.substring(0, Math.min(pemContents.length, 100)));
  console.log('pemContents length:', pemContents.length);
  
  // Log the exact string being passed to atob
  console.log('String passed to atob (first 100 chars):', pemContents.substring(0, Math.min(pemContents.length, 100)));
  console.log('String passed to atob length:', pemContents.length);
  
  const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
  
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
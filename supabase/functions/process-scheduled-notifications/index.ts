import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface ScheduledNotification {
  id: string;
  user_id: string;
  event_id: string;
  title: string;
  body: string;
  trigger_time: string;
  status: 'pending' | 'scheduled' | 'cancelled' | 'sent';
  local_notification_id?: number;
}

Deno.serve(async (req) => {
  console.log('=== Process Scheduled Notifications Function Started ===');
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
    // Initialize Supabase client with service role key for admin access
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        }
      }
    );

    console.log('Fetching pending scheduled notifications...');
    const { data: notifications, error: fetchError } = await supabaseClient
      .from('scheduled_local_notifications')
      .select('*')
      .eq('status', 'pending')
      .lte('trigger_time', new Date().toISOString()); // Notifications whose trigger time is now or in the past

    if (fetchError) {
      console.error('Error fetching scheduled notifications:', fetchError);
      throw new Error(`Failed to fetch scheduled notifications: ${fetchError.message}`);
    }

    console.log(`Found ${notifications?.length || 0} notifications to process.`);

    const results = [];

    for (const notification of notifications || []) {
      console.log(`Processing notification ID: ${notification.id} for user: ${notification.user_id}`);
      try {
        // Get recipient's FCM token and notification preferences
        const { data: userSettings, error: settingsError } = await supabaseClient
          .from('user_settings')
          .select('fcm_token, schedule_updates')
          .eq('user_id', notification.user_id)
          .single();

        if (settingsError) {
          console.warn(`Error fetching settings for user ${notification.user_id}:`, settingsError);
          results.push({ id: notification.id, status: 'skipped', reason: 'Settings fetch error' });

          // Mark as sent so we don't keep retrying
          await supabaseClient
            .from('scheduled_local_notifications')
            .update({ status: 'sent', updated_at: new Date().toISOString() })
            .eq('id', notification.id);
          continue;
        }

        // Check if user has event notifications enabled
        if (!userSettings?.schedule_updates) {
          console.log(`User ${notification.user_id} has event notifications disabled. Skipping notification.`);
          results.push({ id: notification.id, status: 'skipped', reason: 'Event notifications disabled by user' });

          // Mark as sent since user doesn't want notifications
          await supabaseClient
            .from('scheduled_local_notifications')
            .update({ status: 'sent', updated_at: new Date().toISOString() })
            .eq('id', notification.id);
          continue;
        }

        if (!userSettings?.fcm_token) {
          console.warn(`FCM token not found for user ${notification.user_id}. Skipping push notification.`);
          results.push({ id: notification.id, status: 'skipped', reason: 'FCM token not found' });

          // Mark as sent if no FCM token, as we can't send it anyway
          await supabaseClient
            .from('scheduled_local_notifications')
            .update({ status: 'sent', updated_at: new Date().toISOString() })
            .eq('id', notification.id);
          continue;
        }

        const recipientFcmToken = userSettings.fcm_token;

        // Detailed logging for debugging
        console.log(`[Scheduled Notif] Recipient FCM token (first 20 chars): ${recipientFcmToken.substring(0, 20)}...`);
        console.log(`[Scheduled Notif] FCM Token length: ${recipientFcmToken.length}`);

        // Send FCM push notification
        console.log(`Sending FCM notification for scheduled reminder to user ${notification.user_id}...`);
        const fcmResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-fcm-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // No Authorization header needed here as this is a service-to-service call
            // and send-fcm-notification uses a service role key internally.
          },
          body: JSON.stringify({
            fcmToken: recipientFcmToken,
            title: notification.title,
            body: notification.body,
            data: {
              type: 'event_reminder',
              event_id: notification.event_id,
              notification_id: notification.id,
            }
          })
        });

        // Detailed logging for FCM response
        console.log('[Scheduled Notif] FCM Push Notification Response Status:', fcmResponse.status);
        const fcmResponseBody = await fcmResponse.text(); // Read response body once
        console.log('[Scheduled Notif] FCM Push Notification Response Body:', fcmResponseBody);

        if (!fcmResponse.ok) {
          // Use the already read fcmResponseBody
          let fcmError;
          try {
            fcmError = JSON.parse(fcmResponseBody);
          } catch (parseError) {
            fcmError = { error: 'Could not parse FCM error response', body: fcmResponseBody };
          }
          console.error('Failed to send FCM notification:', fcmError);
          throw new Error(`FCM send failed: ${fcmResponse.status} ${fcmResponse.statusText}`);
        }

        console.log('FCM notification sent successfully.');

        // Update notification status to 'sent'
        await supabaseClient
          .from('scheduled_local_notifications')
          .update({ status: 'sent', updated_at: new Date().toISOString() })
          .eq('id', notification.id);
        
        results.push({ id: notification.id, status: 'sent' });

      } catch (processError) {
        console.error(`Error processing notification ${notification.id}:`, processError);
        results.push({ id: notification.id, status: 'error', error: processError.message });
        
        // Optionally update status to 'error' in DB if you want to track failures
        await supabaseClient
          .from('scheduled_local_notifications')
          .update({ status: 'error', updated_at: new Date().toISOString() })
          .eq('id', notification.id);
      }
    }

    console.log('Finished processing scheduled notifications.');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Processed ${notifications?.length || 0} scheduled notifications.`,
        results: results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );

  } catch (error) {
    console.error('=== GLOBAL ERROR IN PROCESS SCHEDULED NOTIFICATIONS FUNCTION ===');
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
      },
    );
  }
});
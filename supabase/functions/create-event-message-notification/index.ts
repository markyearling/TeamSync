import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface EventMessageNotificationRequest {
  message_id: string;
  event_id: string;
  sender_id: string;
  content: string;
  image_url?: string | null;
}

Deno.serve(async (req) => {
  console.log('=== Create Event Message Notification Function Started ===');
  console.log('Request method:', req.method);

  if (req.method === 'OPTIONS') {
    console.log('Handling CORS preflight request');
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    console.log('Processing event message notification request...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        }
      }
    );

    let requestBody;
    try {
      requestBody = await req.json();
      console.log('Request body parsed successfully:', {
        hasMessageId: !!requestBody.message_id,
        hasEventId: !!requestBody.event_id,
        hasSenderId: !!requestBody.sender_id,
        hasContent: !!requestBody.content,
        hasImage: !!requestBody.image_url
      });
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      throw new Error('Invalid JSON in request body');
    }

    const { message_id, event_id, sender_id, content, image_url }: EventMessageNotificationRequest = requestBody;

    if (!message_id || !event_id || !sender_id || !content) {
      console.error('Missing required fields:', {
        message_id: !!message_id,
        event_id: !!event_id,
        sender_id: !!sender_id,
        content: !!content
      });
      throw new Error('Missing required fields');
    }

    console.log('Validation passed for event message notification');

    // Get event details
    console.log('Fetching event details for:', event_id);
    const { data: event, error: eventError } = await supabaseClient
      .from('events')
      .select('id, title, profile_id, profiles(user_id)')
      .eq('id', event_id)
      .single();

    if (eventError || !event) {
      console.error('Event not found:', eventError);
      throw new Error('Event not found');
    }

    console.log('Event found:', event.title);

    // Get the profile owner (event owner)
    const profileOwnerId = event.profiles?.user_id;
    console.log('Profile owner ID:', profileOwnerId);

    // Get all users who have access to this event (friends with viewer or administrator roles)
    console.log('Fetching users with access to event...');
    const { data: friendships, error: friendshipsError } = await supabaseClient
      .from('friendships')
      .select('friend_id, role')
      .eq('user_id', profileOwnerId)
      .in('role', ['viewer', 'administrator']);

    if (friendshipsError) {
      console.error('Error fetching friendships:', friendshipsError);
    }

    // Create a set of recipient IDs (event owner + friends with access)
    const recipientIds = new Set<string>();

    // Add profile owner
    if (profileOwnerId && profileOwnerId !== sender_id) {
      recipientIds.add(profileOwnerId);
    }

    // Add friends with access
    if (friendships && friendships.length > 0) {
      friendships.forEach(friendship => {
        if (friendship.friend_id !== sender_id) {
          recipientIds.add(friendship.friend_id);
        }
      });
    }

    console.log(`Found ${recipientIds.size} recipients for notifications`);

    // Get sender info
    console.log('Fetching sender information for:', sender_id);
    const { data: senderSettings, error: senderError } = await supabaseClient
      .from('user_settings')
      .select('full_name, profile_photo_url')
      .eq('user_id', sender_id)
      .maybeSingle();

    if (senderError) {
      console.error('Error fetching sender info:', senderError);
    }

    const senderName = senderSettings?.full_name || 'Someone';
    console.log('Sender name determined:', senderName);

    // Create notifications and send push notifications for each recipient
    const notificationPromises = Array.from(recipientIds).map(async (recipientId) => {
      console.log('Creating notification for recipient:', recipientId);

      // Get all recipient's FCM tokens for multi-device support
      const { data: recipientDevices, error: devicesError } = await supabaseClient
        .rpc('get_user_fcm_tokens', { p_user_id: recipientId });

      if (devicesError) {
        console.error('Error fetching recipient devices:', devicesError);
      }

      const hasDevices = recipientDevices && recipientDevices.length > 0;
      console.log(`Recipient ${recipientId} has ${recipientDevices?.length || 0} device(s)`);

      // Prepare notification message
      let notificationMessage = `${senderName}: ${content.length > 50 ? content.substring(0, 50) + '...' : content}`;
      if (image_url) {
        notificationMessage = `${senderName} shared an image`;
        if (content.trim() && content.trim() !== ' ') {
          notificationMessage += `: ${content.length > 30 ? content.substring(0, 30) + '...' : content}`;
        }
      }

      // Create database notification
      const { data: notification, error: notificationError } = await supabaseClient
        .from('notifications')
        .insert({
          user_id: recipientId,
          type: 'message',
          title: `New message in ${event.title}`,
          message: notificationMessage,
          data: {
            message_id,
            event_id,
            event_title: event.title,
            sender_id,
            sender_name: senderName,
            sender_photo: senderSettings?.profile_photo_url,
            image_url
          },
          read: false
        })
        .select()
        .maybeSingle();

      if (notificationError) {
        console.error('Error creating notification for recipient:', recipientId, notificationError);
        return { success: false, recipientId, error: notificationError };
      }

      console.log('Database notification created for recipient:', recipientId);

      // Send push notification to all recipient devices
      let devicesSent = 0;
      if (hasDevices) {
        console.log(`Sending push notifications to ${recipientDevices.length} device(s) for recipient:`, recipientId);

        for (const device of recipientDevices) {
          try {
            console.log(`Sending to device: ${device.device_name || device.device_id} (${device.platform})`);

            const fcmResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-fcm-notification`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': req.headers.get('Authorization') || '',
              },
              body: JSON.stringify({
                fcmToken: device.fcm_token,
                title: `New message in ${event.title}`,
                body: notificationMessage,
                data: {
                  type: 'event_message',
                  message_id,
                  event_id,
                  event_title: event.title,
                  sender_id,
                  sender_name: senderName,
                  notification_id: notification?.id,
                  device_id: device.device_id
                }
              })
            });

            const fcmResponseBody = await fcmResponse.text();
            console.log(`FCM Response Status for ${device.device_name}:`, fcmResponse.status);

            if (!fcmResponse.ok) {
              console.error(`Failed to send push notification to device ${device.device_name}:`, fcmResponseBody);
            } else {
              console.log(`Push notification sent successfully to device ${device.device_name}`);
              devicesSent++;

              // Update device last_active timestamp
              await supabaseClient
                .rpc('update_device_last_active', {
                  p_device_id: device.device_id,
                  p_user_id: recipientId
                });
            }
          } catch (fcmError) {
            console.error(`Exception sending push notification to device ${device.device_name}:`, fcmError);
          }
        }

        console.log(`Sent push notifications to ${devicesSent}/${recipientDevices.length} device(s) for recipient:`, recipientId);
      } else {
        console.log('No devices found for recipient:', recipientId);
      }

      return {
        success: true,
        recipientId,
        notification,
        devicesSent,
        totalDevices: recipientDevices?.length || 0
      };
    });

    const results = await Promise.all(notificationPromises);
    const successCount = results.filter(r => r.success).length;

    console.log(`Created ${successCount} notifications out of ${results.length} recipients`);

    return new Response(
      JSON.stringify({
        success: true,
        recipientsNotified: successCount,
        totalRecipients: results.length,
        results
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('=== ERROR IN CREATE EVENT MESSAGE NOTIFICATION FUNCTION ===');
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

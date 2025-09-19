import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface MessageNotificationRequest {
  message_id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
}

Deno.serve(async (req) => {
  console.log('=== Create Message Notification Function Started ===');
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
    console.log('Processing message notification request...');
    
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        }
      }
    );

    // Parse request body
    let requestBody;
    try {
      requestBody = await req.json();
      console.log('Request body parsed successfully:', {
        hasMessageId: !!requestBody.message_id,
        hasConversationId: !!requestBody.conversation_id,
        hasSenderId: !!requestBody.sender_id,
        hasContent: !!requestBody.content
      });
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      throw new Error('Invalid JSON in request body');
    }

    const { message_id, conversation_id, sender_id, content }: MessageNotificationRequest = requestBody;

    if (!message_id || !conversation_id || !sender_id || !content) {
      console.error('Missing required fields:', {
        message_id: !!message_id,
        conversation_id: !!conversation_id,
        sender_id: !!sender_id,
        content: !!content
      });
      throw new Error('Missing required fields');
    }

    console.log('Validation passed for message notification');

    // Get conversation details to find the recipient
    console.log('Fetching conversation details for:', conversation_id);
    const { data: conversation, error: conversationError } = await supabaseClient
      .from('conversations')
      .select('*')
      .eq('id', conversation_id)
      .single();

    if (conversationError || !conversation) {
      console.error('Conversation not found:', conversationError);
      throw new Error('Conversation not found');
    }

    // Determine the recipient (the other participant)
    const recipientId = conversation.participant_1_id === sender_id 
      ? conversation.participant_2_id 
      : conversation.participant_1_id;

    console.log('Message recipient determined:', recipientId);

    // Get sender info
    console.log('Fetching sender information for:', sender_id);
    const { data: senderSettings, error: senderError } = await supabaseClient
      .from('user_settings')
      .select('full_name, profile_photo_url, fcm_token')
      .eq('user_id', sender_id)
      .single();

    if (senderError) {
      console.error('Error fetching sender info:', senderError);
    }

    const senderName = senderSettings?.full_name || 'Someone';
    console.log('Sender name determined:', senderName);

    // Get recipient's FCM token for push notification
    console.log('Fetching recipient FCM token for:', recipientId);
    const { data: recipientSettings, error: recipientError } = await supabaseClient
      .from('user_settings')
      .select('fcm_token')
      .eq('user_id', recipientId)
      .single();

    if (recipientError) {
      console.error('Error fetching recipient info:', recipientError);
    }

    const recipientFcmToken = recipientSettings?.fcm_token;
    console.log('Recipient FCM token status:', recipientFcmToken ? 'Present' : 'Not found');

    // Create notification for the recipient
    console.log('Creating database notification for recipient:', recipientId);
    const { data: notification, error: notificationError } = await supabaseClient
      .from('notifications')
      .insert({
        user_id: recipientId,
        type: 'message',
        title: 'New Message',
        message: `${senderName}: ${content.length > 50 ? content.substring(0, 50) + '...' : content}`,
        data: {
          message_id,
          conversation_id,
          sender_id,
          sender_name: senderName,
          sender_photo: senderSettings?.profile_photo_url
        },
        read: false
      })
      .select()
      .single();

    if (notificationError) throw notificationError;
    console.log('Database notification created successfully:', notification.id);

    // Send push notification if recipient has FCM token
    if (recipientFcmToken) {
      console.log('Sending push notification to recipient...');
      try {
        const fcmResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-fcm-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': req.headers.get('Authorization') || '', // Forward the auth header
          },
          body: JSON.stringify({
            fcmToken: recipientFcmToken,
            title: 'New Message',
            body: `${senderName}: ${content.length > 50 ? content.substring(0, 50) + '...' : content}`,
            data: {
              type: 'message',
              message_id,
              conversation_id,
              sender_id,
              sender_name: senderName,
              notification_id: notification.id
            }
          })
        });

        if (!fcmResponse.ok) {
          const fcmError = await fcmResponse.json();
          console.error('Failed to send push notification:', fcmError);
          // Don't throw here - database notification was successful
        } else {
          const fcmResult = await fcmResponse.json();
          console.log('Push notification sent successfully:', fcmResult);
        }
      } catch (fcmError) {
        console.error('Exception while sending push notification:', fcmError);
        // Don't throw here - database notification was successful
      }
    } else {
      console.log('No FCM token found for recipient, skipping push notification');
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        notification,
        pushNotificationSent: !!recipientFcmToken
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('=== ERROR IN CREATE MESSAGE NOTIFICATION FUNCTION ===');
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
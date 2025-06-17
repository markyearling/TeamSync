import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
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
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
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

    const { message_id, conversation_id, sender_id, content }: MessageNotificationRequest = await req.json();

    if (!message_id || !conversation_id || !sender_id || !content) {
      throw new Error('Missing required fields');
    }

    // Get conversation details to find the recipient
    const { data: conversation, error: conversationError } = await supabaseClient
      .from('conversations')
      .select('*')
      .eq('id', conversation_id)
      .single();

    if (conversationError || !conversation) {
      throw new Error('Conversation not found');
    }

    // Determine the recipient (the other participant)
    const recipientId = conversation.participant_1_id === sender_id 
      ? conversation.participant_2_id 
      : conversation.participant_1_id;

    // Get sender info
    const { data: senderSettings, error: senderError } = await supabaseClient
      .from('user_settings')
      .select('full_name, profile_photo_url')
      .eq('user_id', sender_id)
      .single();

    if (senderError) {
      console.error('Error fetching sender info:', senderError);
    }

    const senderName = senderSettings?.full_name || 'Someone';

    // Create notification for the recipient
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

    return new Response(
      JSON.stringify({ 
        success: true, 
        notification 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error creating message notification:', error);

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
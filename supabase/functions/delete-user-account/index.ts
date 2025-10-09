import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req) => {
  console.log('=== Delete User Account Function Started ===');
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
    console.log('Processing DELETE request...');
    
    // Initialize Supabase client with service role key for admin access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          persistSession: false,
        }
      }
    );

    // Get the authorization header to verify the user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Missing or invalid authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Verify the user's JWT token and get user info
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError) {
      console.error('Error verifying user token:', userError);
      throw new Error('Invalid or expired token');
    }
    
    if (!user) {
      throw new Error('No user found for the provided token');
    }

    const userId = user.id;
    console.log(`Attempting to delete account for user ID: ${userId}`);
    console.log(`User email: ${user.email}`);

    // Log what will be deleted via CASCADE
    console.log('The following data will be automatically deleted via CASCADE:');
    console.log('- User profiles (children)');
    console.log('- User settings and preferences');
    console.log('- Platform connections (TeamSnap, SportsEngine, etc.)');
    console.log('- Events and team mappings');
    console.log('- Friend requests (sent and received)');
    console.log('- Friendships (bidirectional cleanup)');
    console.log('- Notifications');
    console.log('- Active conversations');
    console.log('- Device registrations');
    console.log('Note: Messages and event messages will remain for other users');

    // Delete the user from auth.users table
    // This will automatically cascade and delete all related records in public schema tables
    // due to the ON DELETE CASCADE foreign key constraints
    console.log('Deleting user from auth.users table (this will cascade to all related tables)...');

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error('=== FAILED TO DELETE USER ===');
      console.error('User ID:', userId);
      console.error('Error code:', deleteError.code);
      console.error('Error message:', deleteError.message);
      console.error('Error details:', JSON.stringify(deleteError, null, 2));

      // Provide more helpful error messages
      let userFriendlyMessage = deleteError.message;
      if (deleteError.message.includes('foreign key') || deleteError.message.includes('violates')) {
        userFriendlyMessage = 'Database constraint error. Some data references are preventing deletion. Please contact support.';
      } else if (deleteError.message.includes('not found')) {
        userFriendlyMessage = 'User account not found or already deleted.';
      }

      throw new Error(`Failed to delete user account: ${userFriendlyMessage}`);
    }

    console.log('=== USER ACCOUNT DELETED SUCCESSFULLY ===');
    console.log('User ID:', userId);
    console.log('All related data in public schema tables has been automatically deleted via CASCADE rules');
    console.log('User has been removed from all friend lists');
    console.log('All pending friend requests involving this user have been deleted');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'User account deleted successfully' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('=== ERROR IN DELETE USER ACCOUNT FUNCTION ===');
    console.error('Error type:', typeof error);
    console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.error('Full error object:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred during account deletion',
        details: error instanceof Error ? error.stack : undefined
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
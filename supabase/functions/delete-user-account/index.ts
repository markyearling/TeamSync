const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

    // Delete the user from auth.users table
    // This will automatically cascade and delete all related records in public schema tables
    // due to the ON DELETE CASCADE foreign key constraints
    console.log('Deleting user from auth.users table (this will cascade to all related tables)...');
    
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (deleteError) {
      console.error('Error deleting user from auth.users:', deleteError);
      throw new Error(`Failed to delete user account: ${deleteError.message}`);
    }

    console.log('User account deleted successfully from auth.users table');
    console.log('All related data in public schema tables has been automatically deleted via CASCADE rules');

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
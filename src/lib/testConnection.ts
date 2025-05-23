import { supabase } from './supabase';

export async function testSupabaseConnection() {
  try {
    // Test 1: Basic connection test
    const { data, error } = await supabase.from('profiles').select('count').limit(0);
    
    if (error) {
      console.error('Database connection test failed:', error);
      return {
        success: false,
        error: error.message,
        details: {
          code: error.code,
          hint: error.hint,
          details: error.details
        }
      };
    }

    // Test 2: Auth service test
    const { data: authData, error: authError } = await supabase.auth.getSession();
    
    if (authError) {
      console.error('Auth service test failed:', authError);
      return {
        success: false,
        error: authError.message,
        details: {
          name: authError.name,
          status: authError?.status
        }
      };
    }

    return {
      success: true,
      message: 'Connection successful',
      details: {
        dbConnected: true,
        authConnected: true
      }
    };
  } catch (error) {
    console.error('Connection test failed:', error);
    return {
      success: false,
      error: error.message,
      details: {
        name: error.name,
        stack: error.stack
      }
    };
  }
}
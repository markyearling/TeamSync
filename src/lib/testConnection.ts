import { supabase } from './supabase';

export async function testSupabaseConnection() {
  try {
    // Test 1: Basic connection test
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(0)
      .throwOnError();
    
    if (error) {
      console.error('Database connection test failed:', error);
      return {
        success: false,
        error: 'Database connection failed',
        details: {
          message: error.message,
          code: error.code,
          hint: error.hint
        }
      };
    }

    // Test 2: Auth service test
    const { data: authData, error: authError } = await supabase.auth.getSession();
    
    if (authError) {
      console.error('Auth service test failed:', authError);
      return {
        success: false,
        error: 'Authentication service failed',
        details: {
          message: authError.message,
          name: authError.name
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
      error: 'Connection test failed',
      details: {
        message: error.message,
        name: error.name
      }
    };
  }
}
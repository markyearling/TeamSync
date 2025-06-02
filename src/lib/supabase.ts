import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'supabase.auth.token',
    flowType: 'pkce'
  }
});

// Test connection
export async function testConnection() {
  try {
    const { data, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Auth initialization failed:', error.message);
      return false;
    }

    const { error: dbError } = await supabase
      .from('profiles')
      .select('count')
      .limit(0);

    if (dbError) {
      console.error('Database connection test failed:', dbError.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Supabase connection test failed:', error);
    return false;
  }
}
import { createClient } from '@supabase/supabase-js';
import type { UserSettings } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false, // Important: Disable automatic detection to handle recovery links manually
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

export async function saveSettings(settings: Partial<UserSettings> & { photo_file?: File }) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No user found');

    let profile_photo_url = settings.profile_photo_url;

    // Handle photo upload if a new file is provided
    if (settings.photo_file) {
      const fileExt = settings.photo_file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `profile-photos/${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('profile-photos')
        .upload(filePath, settings.photo_file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(filePath);

      profile_photo_url = publicUrl;
    }

    // Remove the photo_file from settings before database update
    const { photo_file, ...settingsToSave } = settings;

    const { data, error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        ...settingsToSave,
        profile_photo_url,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;
    return { data, error: null };

  } catch (error) {
    console.error('Error saving settings:', error);
    return { data: null, error };
  }
}
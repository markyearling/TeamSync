import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables. Please check your environment configuration.');
}

export const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
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
    const { error } = await supabase.from('profiles').select('count').limit(0);
    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Supabase connection test failed:', error);
    return false;
  }
}

interface SaveSettingsParams {
  full_name?: string;
  phone_number?: string;
  profile_photo_url?: string | null;
  email_notifications?: boolean;
  sms_notifications?: boolean;
  in_app_notifications?: boolean;
  schedule_updates?: boolean;
  team_communications?: boolean;
  all_notifications?: boolean;
  language?: string;
  theme?: string;
  additional_emails?: string[];
  photo_file?: File | null;
}

export async function saveSettings(settings: SaveSettingsParams) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated user found');

    let profile_photo_url = settings.profile_photo_url;

    // Handle photo upload if a new file is provided
    if (settings.photo_file) {
      const fileExt = settings.photo_file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `profile-photos/${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('profile-photos')
        .upload(filePath, settings.photo_file);

      if (uploadError) throw uploadError;

      // Get the public URL for the uploaded file
      const { data: { publicUrl } } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(filePath);

      profile_photo_url = publicUrl;
    }

    // Remove the photo_file from settings before saving to database
    const { photo_file, ...settingsToSave } = settings;

    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.id,
        ...settingsToSave,
        profile_photo_url,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Error saving settings:', error);
    throw error;
  }
}
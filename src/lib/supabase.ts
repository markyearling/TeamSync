import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file');
}

// Ensure URL uses http for development
const apiUrl = supabaseUrl.replace('https://', 'http://');

// Validate URL format
try {
  new URL(apiUrl);
} catch (e) {
  throw new Error('Invalid VITE_SUPABASE_URL format. Please check your .env file');
}

export const supabase = createClient(apiUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'supabase.auth.token'
  },
  global: {
    headers: {
      'X-Client-Info': 'supabase-js/2.39.0',
    },
    fetch: (url, options = {}) => {
      // Configure fetch with SSL settings
      const fetchOptions = {
        ...options,
        keepalive: true,
        credentials: 'include',
        mode: 'cors',
        headers: {
          ...options.headers,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        }
      };

      // Add SSL verification options
      if (typeof window === 'undefined') {
        // Node.js environment
        fetchOptions.agent = new (require('https').Agent)({
          rejectUnauthorized: false // Only for development
        });
      }

      return fetch(url, fetchOptions);
    }
  }
});

export async function saveProfile(profileData: any) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('No authenticated user');

  // First create/update the profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: profileData.id,
      user_id: user.id,
      name: profileData.name,
      age: profileData.age,
      color: profileData.color,
      photo_url: profileData.photo_url,
      notes: profileData.notes
    })
    .select()
    .single();

  if (profileError) throw profileError;

  // Delete existing sports and insert new ones
  if (profileData.sports) {
    await supabase
      .from('profile_sports')
      .delete()
      .match({ profile_id: profile.id });

    const { error: sportsError } = await supabase
      .from('profile_sports')
      .insert(
        profileData.sports.map((sport: any) => ({
          profile_id: profile.id,
          sport: sport.name,
          color: sport.color
        }))
      );

    if (sportsError) throw sportsError;
  }

  return profile;
}

export async function saveSettings(settingsData: any) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error('No authenticated user');

  // Handle photo upload if a new photo is provided
  let photoUrl = settingsData.profile_photo_url;
  if (settingsData.photo_file) {
    const fileExt = settingsData.photo_file.name.split('.').pop();
    const fileName = `${user.id}-${Date.now()}.${fileExt}`;

    // Delete old photo if it exists
    if (photoUrl) {
      const oldFileName = photoUrl.split('/').pop();
      if (oldFileName) {
        await supabase.storage
          .from('profile-photos')
          .remove([oldFileName]);
      }
    }
    
    const { error: uploadError } = await supabase.storage
      .from('profile-photos')
      .upload(fileName, settingsData.photo_file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('profile-photos')
      .getPublicUrl(fileName);

    photoUrl = publicUrl;
  }

  // Save all settings
  const { data, error } = await supabase
    .from('user_settings')
    .upsert({
      user_id: user.id,
      full_name: settingsData.full_name,
      phone_number: settingsData.phone_number,
      profile_photo_url: photoUrl,
      email_notifications: settingsData.email_notifications,
      sms_notifications: settingsData.sms_notifications,
      in_app_notifications: settingsData.in_app_notifications,
      schedule_updates: settingsData.schedule_updates,
      team_communications: settingsData.team_communications,
      all_notifications: settingsData.all_notifications,
      language: settingsData.language,
      theme: settingsData.theme,
      additional_emails: settingsData.additional_emails
    }, {
      onConflict: 'user_id'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
/*
  # Auto-create user_settings record on user signup

  1. Changes
    - Add trigger function to automatically create user_settings record when new auth user is created
    - This ensures onboarding process has a record to update
    
  2. Security
    - Function runs as SECURITY DEFINER to insert into user_settings table
    - Only triggers on INSERT to auth.users table
*/

-- Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.user_settings (user_id, email_notifications, sms_notifications, in_app_notifications, schedule_updates, team_communications, all_notifications, language, theme)
  VALUES (
    NEW.id,
    true,
    false,
    true,
    true,
    true,
    true,
    'en',
    'light'
  );
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Backfill: Create user_settings for any existing users that don't have one
INSERT INTO public.user_settings (user_id, email_notifications, sms_notifications, in_app_notifications, schedule_updates, team_communications, all_notifications, language, theme)
SELECT 
  au.id,
  true,
  false,
  true,
  true,
  true,
  true,
  'en',
  'light'
FROM auth.users au
LEFT JOIN public.user_settings us ON us.user_id = au.id
WHERE us.id IS NULL;

/*
  # Add FCM token column to user_settings

  1. Schema Changes
    - Add `fcm_token` column to `user_settings` table
      - `fcm_token` (text, nullable) - stores Firebase Cloud Messaging registration token

  2. Purpose
    - Enables storing device-specific FCM tokens for push notifications
    - Allows targeting specific devices for real-time notifications
    - Supports multiple devices per user (last token overwrites previous)

  3. Notes
    - Column is nullable since not all users may have FCM tokens
    - Web users or users who deny notification permissions won't have tokens
    - Tokens can change when app is restored or updated
*/

-- Add fcm_token column to user_settings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'fcm_token'
  ) THEN
    ALTER TABLE public.user_settings ADD COLUMN fcm_token TEXT;
    COMMENT ON COLUMN public.user_settings.fcm_token IS 'Firebase Cloud Messaging registration token for push notifications';
  END IF;
END $$;
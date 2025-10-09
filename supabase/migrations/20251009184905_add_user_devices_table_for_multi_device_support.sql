/*
  # Add user_devices table for multi-device push notification support

  1. New Tables
    - `user_devices`
      - `id` (uuid, primary key) - Unique identifier for the device record
      - `user_id` (uuid, foreign key to auth.users) - The user who owns the device
      - `device_id` (text, not null) - Unique device identifier from Capacitor Device API
      - `device_name` (text) - User-friendly name for the device (e.g., "John's iPhone")
      - `platform` (text, not null) - Platform: 'ios' or 'android'
      - `device_model` (text) - Device model (e.g., "iPhone 14 Pro", "Pixel 7")
      - `os_version` (text) - Operating system version (e.g., "iOS 17.1", "Android 13")
      - `fcm_token` (text, not null) - Firebase Cloud Messaging registration token
      - `last_active` (timestamptz, not null) - Last time this device was active (token used)
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())
      - UNIQUE constraint on (user_id, device_id) - Prevent duplicate device registrations

  2. Purpose
    - Enables storing multiple FCM tokens per user for multi-device support
    - Users can receive push notifications on all their registered devices (iPhone, iPad, etc.)
    - Tracks device information and activity for management and cleanup
    - Allows automatic cleanup of inactive/stale devices

  3. Migration Strategy
    - Creates new user_devices table alongside existing user_settings.fcm_token column
    - Migrates existing FCM tokens from user_settings to user_devices
    - Keeps user_settings.fcm_token for backward compatibility during transition
    - Future migration can deprecate user_settings.fcm_token after full transition

  4. Security
    - Enable RLS on user_devices table
    - Users can only view and manage their own devices
    - Policies ensure users cannot access other users' device information
    - Service role key required for notification functions to access all devices

  5. Indexes
    - Primary key index on id
    - Index on user_id for fast device lookups per user
    - Unique index on (user_id, device_id) to prevent duplicates
    - Index on last_active for cleanup queries

  6. Device Cleanup
    - Devices inactive for 90+ days should be considered stale
    - Invalid/expired tokens should be removed when FCM returns errors
    - Users can manually remove devices via device management UI
*/

-- Create user_devices table
CREATE TABLE IF NOT EXISTS public.user_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  device_id text NOT NULL,
  device_name text,
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  device_model text,
  os_version text,
  fcm_token text NOT NULL,
  last_active timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_user_device UNIQUE (user_id, device_id)
);

-- Add comments for documentation
COMMENT ON TABLE public.user_devices IS 'Stores FCM tokens for multiple devices per user to support multi-device push notifications';
COMMENT ON COLUMN public.user_devices.device_id IS 'Unique device identifier from Capacitor Device API or generated stable ID';
COMMENT ON COLUMN public.user_devices.device_name IS 'User-friendly device name like "Johns iPhone" or "Work iPad"';
COMMENT ON COLUMN public.user_devices.platform IS 'Device platform: ios or android';
COMMENT ON COLUMN public.user_devices.fcm_token IS 'Firebase Cloud Messaging registration token for push notifications';
COMMENT ON COLUMN public.user_devices.last_active IS 'Last time device was active (token used for notification)';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON public.user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_user_devices_last_active ON public.user_devices(last_active);
CREATE INDEX IF NOT EXISTS idx_user_devices_fcm_token ON public.user_devices(fcm_token);

-- Enable RLS
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own devices"
  ON public.user_devices
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own devices"
  ON public.user_devices
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own devices"
  ON public.user_devices
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own devices"
  ON public.user_devices
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_user_devices_updated_at
  BEFORE UPDATE ON public.user_devices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Migrate existing FCM tokens from user_settings to user_devices
-- This creates a default device for users who already have an FCM token
-- Device ID is set to 'migrated-device' as we don't have historical device info
INSERT INTO public.user_devices (user_id, device_id, device_name, platform, fcm_token, last_active)
SELECT 
  user_id,
  'migrated-device-' || substring(fcm_token from 1 for 8) as device_id,
  'Primary Device (Migrated)' as device_name,
  'android' as platform, -- Default to android, will be updated on next app launch
  fcm_token,
  updated_at as last_active
FROM public.user_settings
WHERE fcm_token IS NOT NULL 
  AND fcm_token != ''
  AND NOT EXISTS (
    SELECT 1 FROM public.user_devices ud 
    WHERE ud.user_id = user_settings.user_id
  );

-- Create function to get all active FCM tokens for a user
-- This is used by notification functions to send to all user devices
CREATE OR REPLACE FUNCTION public.get_user_fcm_tokens(p_user_id uuid)
RETURNS TABLE (
  device_id text,
  fcm_token text,
  platform text,
  device_name text
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ud.device_id,
    ud.fcm_token,
    ud.platform,
    ud.device_name
  FROM public.user_devices ud
  WHERE ud.user_id = p_user_id
    AND ud.fcm_token IS NOT NULL
    AND ud.fcm_token != ''
  ORDER BY ud.last_active DESC;
END;
$$;

COMMENT ON FUNCTION public.get_user_fcm_tokens IS 'Returns all active FCM tokens for a user across all their devices';

-- Create function to update device last_active timestamp
-- Called after successfully sending a notification to a device
CREATE OR REPLACE FUNCTION public.update_device_last_active(p_device_id text, p_user_id uuid)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.user_devices
  SET last_active = now(),
      updated_at = now()
  WHERE device_id = p_device_id
    AND user_id = p_user_id;
END;
$$;

COMMENT ON FUNCTION public.update_device_last_active IS 'Updates the last_active timestamp for a device after successful notification delivery';

-- Create function to remove invalid/expired device tokens
-- Called when FCM returns token errors
CREATE OR REPLACE FUNCTION public.remove_invalid_device_token(p_fcm_token text)
RETURNS void
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.user_devices
  WHERE fcm_token = p_fcm_token;
END;
$$;

COMMENT ON FUNCTION public.remove_invalid_device_token IS 'Removes a device with an invalid or expired FCM token';

-- Create function to cleanup stale devices (inactive for 90+ days)
CREATE OR REPLACE FUNCTION public.cleanup_stale_devices()
RETURNS TABLE (
  deleted_count bigint
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_deleted_count bigint;
BEGIN
  WITH deleted AS (
    DELETE FROM public.user_devices
    WHERE last_active < now() - INTERVAL '90 days'
    RETURNING *
  )
  SELECT count(*) INTO v_deleted_count FROM deleted;
  
  RETURN QUERY SELECT v_deleted_count;
END;
$$;

COMMENT ON FUNCTION public.cleanup_stale_devices IS 'Removes devices that have been inactive for 90+ days';
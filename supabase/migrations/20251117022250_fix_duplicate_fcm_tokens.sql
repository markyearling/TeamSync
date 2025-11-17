/*
  # Fix Duplicate FCM Token Issue in User Devices
  
  1. Immediate Cleanup
    - Remove duplicate FCM tokens, keeping only the most recently active device
    - This resolves the current issue where one physical device has multiple database records
  
  2. Schema Changes
    - Drop the existing UNIQUE constraint on (user_id, device_id)
    - Create a new UNIQUE constraint on (user_id, fcm_token)
    - This prevents the same FCM token from being registered multiple times per user
  
  3. Logic
    - When a device updates (e.g., iOS version upgrade changes device_id), the old record
      will be replaced instead of creating a duplicate
    - Ensures each FCM token appears only once per user in the database
  
  4. Benefits
    - Eliminates duplicate push notifications to the same physical device
    - Handles OS updates that change device_id but keep the same FCM token
    - Automatic cleanup when device re-registers with new device_id
  
  5. Important Notes
    - The cleanup uses last_active timestamp to determine which record to keep
    - Most recently active device record is preserved for each duplicate FCM token
    - This migration is safe to run multiple times (idempotent)
*/

-- Step 1: Clean up existing duplicate FCM tokens
-- For each (user_id, fcm_token) combination, keep only the most recently active device
WITH ranked_devices AS (
  SELECT 
    id,
    user_id,
    fcm_token,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, fcm_token 
      ORDER BY last_active DESC, created_at DESC
    ) as rn
  FROM public.user_devices
  WHERE fcm_token IS NOT NULL AND fcm_token != ''
),
devices_to_delete AS (
  SELECT id 
  FROM ranked_devices 
  WHERE rn > 1
)
DELETE FROM public.user_devices
WHERE id IN (SELECT id FROM devices_to_delete);

-- Step 2: Drop the existing unique constraint on (user_id, device_id)
ALTER TABLE public.user_devices 
DROP CONSTRAINT IF EXISTS unique_user_device;

-- Step 3: Create a new unique constraint on (user_id, fcm_token)
-- This ensures one FCM token can only exist once per user
CREATE UNIQUE INDEX IF NOT EXISTS unique_user_fcm_token
ON public.user_devices (user_id, fcm_token)
WHERE fcm_token IS NOT NULL AND fcm_token != '';

-- Step 4: Add a comment explaining the constraint
COMMENT ON INDEX unique_user_fcm_token IS 'Ensures each FCM token is registered only once per user. When device_id changes (e.g., OS update) but FCM token remains the same, the old record will be replaced.';

-- Step 5: Update the get_user_fcm_tokens function to add extra safety
-- Returns distinct FCM tokens only, even if duplicates somehow exist
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
  SELECT DISTINCT ON (ud.fcm_token)
    ud.device_id,
    ud.fcm_token,
    ud.platform,
    ud.device_name
  FROM public.user_devices ud
  WHERE ud.user_id = p_user_id
    AND ud.fcm_token IS NOT NULL
    AND ud.fcm_token != ''
  ORDER BY ud.fcm_token, ud.last_active DESC;
END;
$$;

COMMENT ON FUNCTION public.get_user_fcm_tokens IS 'Returns distinct FCM tokens for a user across all devices. Uses DISTINCT ON to prevent duplicate tokens even if data integrity issues exist.';

@@ .. @@
 -- Create function to get user timezone
 CREATE OR REPLACE FUNCTION get_user_timezone(p_user_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 AS $$
 DECLARE
   user_timezone text;
 BEGIN
   -- Get timezone from user_settings table
   SELECT timezone INTO user_timezone
   FROM user_settings
   WHERE user_id = p_user_id;
   
   -- Return timezone or default to UTC if not found
   RETURN COALESCE(user_timezone, 'UTC');
 EXCEPTION
   WHEN OTHERS THEN
     -- Return UTC as fallback if any error occurs
     RETURN 'UTC';
 END;
 $$;
+
+-- Create function to get user timezone by profile_id
+CREATE OR REPLACE FUNCTION get_user_timezone_by_profile(p_profile_id uuid)
+RETURNS text
+LANGUAGE plpgsql
+SECURITY DEFINER
+AS $$
+DECLARE
+  user_timezone text;
+  profile_user_id uuid;
+BEGIN
+  -- First get the user_id from the profile
+  SELECT user_id INTO profile_user_id
+  FROM profiles
+  WHERE id = p_profile_id;
+  
+  -- If profile not found, return UTC
+  IF profile_user_id IS NULL THEN
+    RETURN 'UTC';
+  END IF;
+  
+  -- Get timezone from user_settings table
+  SELECT timezone INTO user_timezone
+  FROM user_settings
+  WHERE user_id = profile_user_id;
+  
+  -- Return timezone or default to UTC if not found
+  RETURN COALESCE(user_timezone, 'UTC');
+EXCEPTION
+  WHEN OTHERS THEN
+    -- Return UTC as fallback if any error occurs
+    RETURN 'UTC';
+END;
+$$;
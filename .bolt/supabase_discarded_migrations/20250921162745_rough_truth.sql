```diff
--- a/supabase/migrations/20250921161011_stark_bread.sql
+++ b/supabase/migrations/20250921161011_stark_bread.sql
@@ -1,3 +1,17 @@
+CREATE OR REPLACE FUNCTION public.get_user_timezone(p_user_id uuid)
+ RETURNS text
+ LANGUAGE plpgsql
+ SECURITY DEFINER
+AS $function$
+DECLARE
+    user_tz text;
+BEGIN
+    SELECT timezone INTO user_tz
+    FROM public.user_settings
+    WHERE user_id = p_user_id;
+
+    RETURN user_tz;
+END;
+$function$;
+
 -- Grant usage to authenticated role if needed, though SECURITY DEFINER might handle it
+GRANT EXECUTE ON FUNCTION public.get_user_timezone(uuid) TO authenticated;
+
 ```
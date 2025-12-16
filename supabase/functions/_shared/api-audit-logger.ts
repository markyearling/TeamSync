import { createClient } from 'npm:@supabase/supabase-js@2';

/**
 * Google API Audit Logger
 *
 * Logs Google API usage for cost monitoring and debugging purposes.
 * Controlled by system_settings.enable_google_api_audit flag.
 * All logging errors are suppressed to avoid breaking main application flow.
 */

interface AuditLogEntry {
  user_id?: string;
  api_type: 'geocoding' | 'places';
  endpoint_url?: string;
  request_query: string;
  response_status: string;
  cache_hit: boolean;
  event_id?: number;
  request_id?: string;
}

/**
 * Logs a Google API call to the audit table if auditing is enabled.
 *
 * @param entry - The audit log entry containing API call details
 * @returns Promise that resolves when logging is complete (or skipped)
 *
 * @example
 * await logGoogleApiCall({
 *   user_id: 'user-uuid',
 *   api_type: 'geocoding',
 *   request_query: '123 Main St',
 *   response_status: 'OK',
 *   cache_hit: false,
 *   event_id: 12345
 * });
 */
export async function logGoogleApiCall(entry: AuditLogEntry): Promise<void> {
  try {
    // Create service role client for audit logging
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn('Supabase credentials not available for audit logging');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if audit logging is enabled
    const { data: setting, error: settingError } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'enable_google_api_audit')
      .maybeSingle();

    if (settingError) {
      console.warn('Error checking audit setting:', settingError);
      return;
    }

    // If audit is not enabled, skip logging
    if (!setting || setting.value !== 'true') {
      return;
    }

    // Insert audit log entry
    const { error: insertError } = await supabase
      .from('google_api_audit_logs')
      .insert({
        user_id: entry.user_id || null,
        api_type: entry.api_type,
        endpoint_url: entry.endpoint_url || null,
        request_query: entry.request_query,
        response_status: entry.response_status,
        cache_hit: entry.cache_hit,
        event_id: entry.event_id || null,
        request_id: entry.request_id || null
      });

    if (insertError) {
      console.warn('Error inserting audit log:', insertError);
    }

  } catch (error) {
    // Suppress all logging errors to avoid breaking main flow
    console.warn('Audit logging failed:', error);
  }
}
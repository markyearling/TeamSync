import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GeocodeResult {
  locationName: string | null;
  formattedAddress: string | null;
}

const geocodeAddress = async (address: string, apiKey: string): Promise<GeocodeResult> => {
  if (!address || address.trim() === '') {
    return { locationName: null, formattedAddress: null };
  }

  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const result = data.results[0];
      let locationName: string | null = null;

      for (const component of result.address_components) {
        if (component.types.includes('establishment') ||
            component.types.includes('point_of_interest') ||
            component.types.includes('premise')) {
          locationName = component.long_name;
          break;
        }
      }

      if (!locationName && result.name && result.name !== result.formatted_address) {
        locationName = result.name;
      }

      return {
        locationName,
        formattedAddress: result.formatted_address
      };
    }

    return { locationName: null, formattedAddress: null };
  } catch (error) {
    console.error('[Geocoding] Error:', error);
    return { locationName: null, formattedAddress: null };
  }
};

Deno.serve(async (req: Request) => {
  const sessionId = Math.random().toString(36).substring(7);
  console.log(`[Enrich:${sessionId}] ========================================`);
  console.log(`[Enrich:${sessionId}] NEW ENRICHMENT REQUEST`);
  console.log(`[Enrich:${sessionId}] ========================================`);

  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log(`[Enrich:${sessionId}] Environment check:`);
    console.log(`[Enrich:${sessionId}] - SUPABASE_URL: ${!!Deno.env.get('SUPABASE_URL')}`);
    console.log(`[Enrich:${sessionId}] - SUPABASE_SERVICE_ROLE_KEY: ${!!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`);
    console.log(`[Enrich:${sessionId}] - VITE_GOOGLE_MAPS_API_KEY: ${!!Deno.env.get('VITE_GOOGLE_MAPS_API_KEY')}`);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const googleMapsApiKey = Deno.env.get('VITE_GOOGLE_MAPS_API_KEY');
    if (!googleMapsApiKey) {
      console.error(`[Enrich:${sessionId}] ERROR: Google Maps API key not configured!`);
      throw new Error('Google Maps API key not configured');
    }

    const apiKeyMasked = googleMapsApiKey.length >= 8
      ? `${googleMapsApiKey.substring(0, 4)}...${googleMapsApiKey.substring(googleMapsApiKey.length - 4)}`
      : '[INVALID_KEY]';
    console.log(`[Enrich:${sessionId}] Google Maps API key present (masked): ${apiKeyMasked}`);

    const url = new URL(req.url);
    const batchSize = parseInt(url.searchParams.get('batch_size') || '50');
    const dryRun = url.searchParams.get('dry_run') === 'true';
    const forceReGeocode = url.searchParams.get('force') === 'true';

    console.log(`[Enrich:${sessionId}] Parameters:`);
    console.log(`[Enrich:${sessionId}] - batch_size: ${batchSize}`);
    console.log(`[Enrich:${sessionId}] - dry_run: ${dryRun}`);
    console.log(`[Enrich:${sessionId}] - force: ${forceReGeocode}`);

    let query = supabaseClient
      .from('events')
      .select('id, location, location_name')
      .not('location', 'is', null);

    if (!forceReGeocode) {
      query = query.or('location_name.is.null,location_name.eq.');
      console.log(`[Enrich:${sessionId}] Query filter: location NOT NULL AND (location_name IS NULL OR location_name = '')`);
    } else {
      console.log(`[Enrich:${sessionId}] Query filter: location NOT NULL (force mode, will re-geocode all)`);
    }

    console.log(`[Enrich:${sessionId}] Fetching events from database...`);
    const fetchStart = Date.now();
    const { data: events, error: fetchError } = await query.limit(batchSize);
    const fetchTime = Date.now() - fetchStart;

    if (fetchError) {
      console.error(`[Enrich:${sessionId}] Database fetch error (${fetchTime}ms):`, fetchError);
      throw fetchError;
    }

    console.log(`[Enrich:${sessionId}] Fetched ${events?.length || 0} events in ${fetchTime}ms`);

    if (!events || events.length === 0) {
      console.log(`[Enrich:${sessionId}] No events need enrichment`);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No events need location name enrichment',
          eventsProcessed: 0
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log(`[Enrich:${sessionId}] Processing ${events.length} events...`);
    console.log(`[Enrich:${sessionId}] Sample events:`, events.slice(0, 3).map(e => ({
      id: e.id,
      location: e.location,
      location_name: e.location_name
    })));

    const results = {
      processed: 0,
      enriched: 0,
      cached: 0,
      failed: 0,
      skipped: 0
    };

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      console.log(`[Enrich:${sessionId}] -------- Event ${i + 1}/${events.length} (ID: ${event.id}) --------`);

      try {
        if (!event.location || event.location.trim() === '') {
          console.log(`[Enrich:${sessionId}] Event ${event.id}: Empty location, skipping`);
          results.skipped++;
          continue;
        }

        const hasValidLocationName = event.location_name && event.location_name.trim() !== '';
        console.log(`[Enrich:${sessionId}] Event ${event.id}:`);
        console.log(`[Enrich:${sessionId}]   - location: "${event.location}"`);
        console.log(`[Enrich:${sessionId}]   - location_name: "${event.location_name || 'NULL'}"`);
        console.log(`[Enrich:${sessionId}]   - hasValidLocationName: ${hasValidLocationName}`);
        console.log(`[Enrich:${sessionId}]   - forceReGeocode: ${forceReGeocode}`);

        if (!forceReGeocode && hasValidLocationName) {
          console.log(`[Enrich:${sessionId}] Event ${event.id}: Already has valid location_name, skipping`);
          results.skipped++;
          continue;
        }

        const normalizedAddress = event.location.trim().toLowerCase();
        console.log(`[Enrich:${sessionId}] Event ${event.id}: Normalized address: "${normalizedAddress}"`);

        console.log(`[Enrich:${sessionId}] Event ${event.id}: Checking cache...`);
        const cacheCheckStart = Date.now();
        const { data: cachedResult, error: cacheError } = await supabaseClient
          .from('location_cache')
          .select('location_name, formatted_address')
          .eq('address', normalizedAddress)
          .maybeSingle();
        const cacheCheckTime = Date.now() - cacheCheckStart;

        if (cacheError) {
          console.error(`[Enrich:${sessionId}] Event ${event.id}: Cache check error (${cacheCheckTime}ms):`, cacheError.message);
        }

        let locationName: string | null = null;

        if (cachedResult && !forceReGeocode) {
          console.log(`[Enrich:${sessionId}] Event ${event.id}: ✓ Cache hit (${cacheCheckTime}ms)`);
          console.log(`[Enrich:${sessionId}]   - cached location_name: "${cachedResult.location_name}"`);
          locationName = cachedResult.location_name;
          results.cached++;
        } else {
          if (cachedResult && forceReGeocode) {
            console.log(`[Enrich:${sessionId}] Event ${event.id}: Cache found but force=true, will re-geocode`);
          } else {
            console.log(`[Enrich:${sessionId}] Event ${event.id}: Cache miss, calling geocode API...`);
          }

          const geocodeResult = await geocodeAddress(event.location, googleMapsApiKey, supabaseClient);
          locationName = geocodeResult.locationName;

          console.log(`[Enrich:${sessionId}] Event ${event.id}: Geocode returned locationName: "${locationName}"`);

          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (locationName && locationName.trim() !== '') {
          console.log(`[Enrich:${sessionId}] Event ${event.id}: Valid location name found: "${locationName}"`);

          if (!dryRun) {
            console.log(`[Enrich:${sessionId}] Event ${event.id}: Updating database...`);
            const updateStart = Date.now();
            const { error: updateError } = await supabaseClient
              .from('events')
              .update({ location_name: locationName })
              .eq('id', event.id);
            const updateTime = Date.now() - updateStart;

            if (updateError) {
              console.error(`[Enrich:${sessionId}] Event ${event.id}: ✗ Database update failed (${updateTime}ms):`, updateError.message);
              results.failed++;
            } else {
              console.log(`[Enrich:${sessionId}] Event ${event.id}: ✓ Successfully updated (${updateTime}ms)`);
              console.log(`[Enrich:${sessionId}]   "${event.location}" -> "${locationName}"`);
              results.enriched++;
            }
          } else {
            console.log(`[Enrich:${sessionId}] Event ${event.id}: [DRY RUN] Would update with: "${locationName}"`);
            results.enriched++;
          }
        } else {
          console.warn(`[Enrich:${sessionId}] Event ${event.id}: ⚠ No location name found for: "${event.location}"`);
        }

        results.processed++;
      } catch (error) {
        console.error(`[Enrich:${sessionId}] Event ${event.id}: ✗ Exception:`, error);
        if (error instanceof Error) {
          console.error(`[Enrich:${sessionId}]   Error message: ${error.message}`);
          console.error(`[Enrich:${sessionId}]   Error stack:`, error.stack);
        }
        results.failed++;
      }
    }

    console.log(`[Enrich:${sessionId}] ========================================`);
    console.log(`[Enrich:${sessionId}] FINAL RESULTS:`);
    console.log(`[Enrich:${sessionId}]   - Total processed: ${results.processed}`);
    console.log(`[Enrich:${sessionId}]   - Successfully enriched: ${results.enriched}`);
    console.log(`[Enrich:${sessionId}]   - Cache hits: ${results.cached}`);
    console.log(`[Enrich:${sessionId}]   - Skipped: ${results.skipped}`);
    console.log(`[Enrich:${sessionId}]   - Failed: ${results.failed}`);
    console.log(`[Enrich:${sessionId}] ========================================`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${results.processed} events`,
        results,
        dryRun
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error(`[Enrich:${sessionId}] ========================================`);
    console.error(`[Enrich:${sessionId}] FATAL ERROR`);
    console.error(`[Enrich:${sessionId}] ========================================`);
    console.error(`[Enrich:${sessionId}] Exception:`, error);
    if (error instanceof Error) {
      console.error(`[Enrich:${sessionId}] Error message: ${error.message}`);
      console.error(`[Enrich:${sessionId}] Error stack:`, error.stack);
    }
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

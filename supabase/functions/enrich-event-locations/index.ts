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
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const googleMapsApiKey = Deno.env.get('VITE_GOOGLE_MAPS_API_KEY');
    if (!googleMapsApiKey) {
      throw new Error('Google Maps API key not configured');
    }

    const url = new URL(req.url);
    const batchSize = parseInt(url.searchParams.get('batch_size') || '50');
    const dryRun = url.searchParams.get('dry_run') === 'true';

    console.log(`[Enrich Locations] Starting enrichment (batch_size: ${batchSize}, dry_run: ${dryRun})`);

    const { data: events, error: fetchError } = await supabaseClient
      .from('events')
      .select('id, location, location_name')
      .not('location', 'is', null)
      .or('location_name.is.null,location_name.eq.')
      .limit(batchSize);

    if (fetchError) {
      throw fetchError;
    }

    if (!events || events.length === 0) {
      console.log('[Enrich Locations] No events need enrichment');
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

    console.log(`[Enrich Locations] Found ${events.length} events to process`);

    const results = {
      processed: 0,
      enriched: 0,
      cached: 0,
      failed: 0,
      skipped: 0
    };

    for (const event of events) {
      try {
        if (!event.location || event.location.trim() === '') {
          results.skipped++;
          continue;
        }

        const normalizedAddress = event.location.trim().toLowerCase();

        const { data: cachedResult } = await supabaseClient
          .from('location_cache')
          .select('location_name, formatted_address')
          .eq('address', normalizedAddress)
          .maybeSingle();

        let locationName: string | null = null;

        if (cachedResult) {
          console.log(`[Enrich Locations] Cache hit for: ${event.location}`);
          locationName = cachedResult.location_name;
          results.cached++;
        } else {
          console.log(`[Enrich Locations] Geocoding: ${event.location}`);
          const geocodeResult = await geocodeAddress(event.location, googleMapsApiKey);
          locationName = geocodeResult.locationName;

          if (!dryRun) {
            await supabaseClient
              .from('location_cache')
              .upsert({
                address: normalizedAddress,
                location_name: geocodeResult.locationName,
                formatted_address: geocodeResult.formattedAddress
              }, {
                onConflict: 'address'
              });
          }

          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (locationName) {
          if (!dryRun) {
            const { error: updateError } = await supabaseClient
              .from('events')
              .update({ location_name: locationName })
              .eq('id', event.id);

            if (updateError) {
              console.error(`[Enrich Locations] Failed to update event ${event.id}:`, updateError);
              results.failed++;
            } else {
              results.enriched++;
            }
          } else {
            console.log(`[Enrich Locations] Would enrich event ${event.id} with: ${locationName}`);
            results.enriched++;
          }
        } else {
          console.log(`[Enrich Locations] No location name found for: ${event.location}`);
        }

        results.processed++;
      } catch (error) {
        console.error(`[Enrich Locations] Error processing event ${event.id}:`, error);
        results.failed++;
      }
    }

    console.log('[Enrich Locations] Results:', results);

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
    console.error('[Enrich Locations] Error:', error);
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

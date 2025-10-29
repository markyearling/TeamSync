export interface GeocodeResult {
  locationName: string | null;
  formattedAddress: string | null;
}

const maskApiKey = (key: string): string => {
  if (!key || key.length < 8) return '[INVALID_KEY]';
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
};

export const geocodeAddress = async (
  address: string,
  apiKey: string,
  supabaseClient?: any
): Promise<GeocodeResult> => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  console.log(`[Geocoding:${requestId}] ========== START GEOCODING ==========`);
  console.log(`[Geocoding:${requestId}] Input address: "${address}"`);
  console.log(`[Geocoding:${requestId}] API key present: ${!!apiKey}, masked: ${maskApiKey(apiKey)}`);
  console.log(`[Geocoding:${requestId}] Supabase client available: ${!!supabaseClient}`);

  if (!address || address.trim() === '') {
    console.log(`[Geocoding:${requestId}] Empty address, returning null result`);
    return { locationName: null, formattedAddress: null };
  }

  if (!apiKey || apiKey.trim() === '') {
    console.error(`[Geocoding:${requestId}] ERROR: API key is missing or empty!`);
    return { locationName: null, formattedAddress: null };
  }

  const normalizedAddress = address.trim().toLowerCase();
  console.log(`[Geocoding:${requestId}] Normalized address: "${normalizedAddress}"`);

  if (supabaseClient) {
    const cacheStartTime = Date.now();
    try {
      console.log(`[Geocoding:${requestId}] Checking cache for: "${normalizedAddress}"`);
      const { data: cachedResult, error: cacheError } = await supabaseClient
        .from('location_cache')
        .select('location_name, formatted_address')
        .eq('address', normalizedAddress)
        .maybeSingle();

      const cacheTime = Date.now() - cacheStartTime;

      if (cacheError) {
        console.error(`[Geocoding:${requestId}] Cache lookup error (${cacheTime}ms):`, cacheError.message);
      } else if (cachedResult) {
        console.log(`[Geocoding:${requestId}] ✓ CACHE HIT (${cacheTime}ms)`);
        console.log(`[Geocoding:${requestId}] Cached location_name: "${cachedResult.location_name}"`);
        console.log(`[Geocoding:${requestId}] Cached formatted_address: "${cachedResult.formatted_address}"`);
        const totalTime = Date.now() - startTime;
        console.log(`[Geocoding:${requestId}] ========== END (CACHED, ${totalTime}ms) ==========`);
        return {
          locationName: cachedResult.location_name,
          formattedAddress: cachedResult.formatted_address
        };
      } else {
        console.log(`[Geocoding:${requestId}] Cache miss (${cacheTime}ms), will call API`);
      }
    } catch (error) {
      console.error(`[Geocoding:${requestId}] Cache lookup exception:`, error);
    }
  } else {
    console.log(`[Geocoding:${requestId}] No Supabase client, skipping cache`);
  }

  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${maskApiKey(apiKey)}`;
    console.log(`[Geocoding:${requestId}] API URL (masked): ${url}`);

    const apiStartTime = Date.now();
    console.log(`[Geocoding:${requestId}] Making Google Maps API request...`);
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`);
    const apiTime = Date.now() - apiStartTime;

    console.log(`[Geocoding:${requestId}] API response status: ${response.status} (${apiTime}ms)`);

    const data = await response.json();
    console.log(`[Geocoding:${requestId}] API response status field: "${data.status}"`);
    console.log(`[Geocoding:${requestId}] API response results count: ${data.results?.length || 0}`);

    if (data.status !== 'OK') {
      console.error(`[Geocoding:${requestId}] API returned non-OK status: ${data.status}`);
      if (data.error_message) {
        console.error(`[Geocoding:${requestId}] API error message: ${data.error_message}`);
      }

      if (data.status === 'REQUEST_DENIED') {
        console.error(`[Geocoding:${requestId}] REQUEST_DENIED - Check API key permissions and billing`);
      } else if (data.status === 'OVER_QUERY_LIMIT') {
        console.error(`[Geocoding:${requestId}] OVER_QUERY_LIMIT - API quota exceeded`);
      } else if (data.status === 'ZERO_RESULTS') {
        console.warn(`[Geocoding:${requestId}] ZERO_RESULTS - No results for address: "${address}"`);
      }

      return { locationName: null, formattedAddress: null };
    }

    if (data.results && data.results.length > 0) {
      const result = data.results[0];
      console.log(`[Geocoding:${requestId}] Processing first result...`);
      console.log(`[Geocoding:${requestId}] Result formatted_address: "${result.formatted_address}"`);
      console.log(`[Geocoding:${requestId}] Result name: "${result.name || 'N/A'}"`);
      console.log(`[Geocoding:${requestId}] Result address_components count: ${result.address_components?.length || 0}`);

      let locationName: string | null = null;

      const locationTypes = [
        'establishment',
        'point_of_interest',
        'premise',
        'school',
        'stadium',
        'park',
        'gym',
        'sports_complex',
        'university',
        'secondary_school',
        'primary_school'
      ];

      console.log(`[Geocoding:${requestId}] Searching for location types: ${locationTypes.join(', ')}`);

      for (const component of result.address_components) {
        const componentTypes = component.types || [];
        const hasLocationType = locationTypes.some(type => componentTypes.includes(type));

        if (hasLocationType) {
          locationName = component.long_name;
          const matchedTypes = componentTypes.filter((t: string) => locationTypes.includes(t));
          console.log(`[Geocoding:${requestId}] ✓ FOUND location name from matched types [${matchedTypes.join(', ')}]: "${locationName}"`);
          break;
        }
      }

      if (!locationName) {
        console.log(`[Geocoding:${requestId}] No match in address_components, checking result.name...`);
        if (result.name && result.name !== result.formatted_address) {
          locationName = result.name;
          console.log(`[Geocoding:${requestId}] ✓ Using result.name as location name: "${locationName}"`);
        } else {
          console.log(`[Geocoding:${requestId}] result.name is empty or equals formatted_address`);
        }
      }

      if (!locationName) {
        console.warn(`[Geocoding:${requestId}] ⚠ NO LOCATION NAME FOUND`);
        console.log(`[Geocoding:${requestId}] All address_components:`, JSON.stringify(
          result.address_components.map((c: any) => ({
            long_name: c.long_name,
            short_name: c.short_name,
            types: c.types
          })),
          null,
          2
        ));
      }

      const geocodeResult = {
        locationName,
        formattedAddress: result.formatted_address
      };

      console.log(`[Geocoding:${requestId}] Final result - locationName: "${geocodeResult.locationName}", formattedAddress: "${geocodeResult.formattedAddress}"`);

      if (supabaseClient) {
        const cacheWriteStart = Date.now();
        try {
          console.log(`[Geocoding:${requestId}] Writing to cache...`);
          const { error: cacheWriteError } = await supabaseClient
            .from('location_cache')
            .upsert({
              address: normalizedAddress,
              location_name: geocodeResult.locationName,
              formatted_address: geocodeResult.formattedAddress
            }, {
              onConflict: 'address',
              ignoreDuplicates: false
            });

          const cacheWriteTime = Date.now() - cacheWriteStart;

          if (cacheWriteError) {
            console.error(`[Geocoding:${requestId}] Failed to write to cache (${cacheWriteTime}ms):`, cacheWriteError.message);
          } else {
            console.log(`[Geocoding:${requestId}] ✓ Successfully cached result (${cacheWriteTime}ms)`);
          }
        } catch (error) {
          console.error(`[Geocoding:${requestId}] Cache write exception:`, error);
        }
      }

      const totalTime = Date.now() - startTime;
      console.log(`[Geocoding:${requestId}] ========== END (SUCCESS, ${totalTime}ms) ==========`);
      return geocodeResult;
    }

    console.warn(`[Geocoding:${requestId}] No results array in response`);
    const totalTime = Date.now() - startTime;
    console.log(`[Geocoding:${requestId}] ========== END (NO RESULTS, ${totalTime}ms) ==========`);
    return { locationName: null, formattedAddress: null };
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[Geocoding:${requestId}] ========== ERROR (${totalTime}ms) ==========`);
    console.error(`[Geocoding:${requestId}] Exception:`, error);
    if (error instanceof Error) {
      console.error(`[Geocoding:${requestId}] Error message: ${error.message}`);
      console.error(`[Geocoding:${requestId}] Error stack:`, error.stack);
    }
    return { locationName: null, formattedAddress: null };
  }
};
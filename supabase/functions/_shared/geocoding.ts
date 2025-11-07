export interface GeocodeResult {
  locationName: string | null;
  formattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
}

const maskApiKey = (key: string): string => {
  if (!key || key.length < 8) return '[INVALID_KEY]';
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
};

const findPlaceByTextSearch = async (
  address: string,
  apiKey: string,
  requestId: string
): Promise<{ locationName: string | null; formattedAddress: string | null; latitude: number | null; longitude: number | null }> => {
  try {
    const query = `place at ${address}`;
    const encodedQuery = encodeURIComponent(query);
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodedQuery}&key=${apiKey}`;

    console.log(`[PlaceAt:${requestId}] Searching: "${query}"`);

    const startTime = Date.now();
    const response = await fetch(url);
    const responseTime = Date.now() - startTime;

    const data = await response.json();
    console.log(`[PlaceAt:${requestId}] Response: ${data.status} with ${data.results?.length || 0} results (${responseTime}ms)`);

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const place = data.results[0];
      const placeName = place.name || null;
      const formattedAddress = place.formatted_address || null;
      const lat = place.geometry?.location?.lat || null;
      const lng = place.geometry?.location?.lng || null;

      console.log(`[PlaceAt:${requestId}] ✓ Found: "${placeName}"`);
      return {
        locationName: placeName,
        formattedAddress: formattedAddress,
        latitude: lat,
        longitude: lng
      };
    }

    console.log(`[PlaceAt:${requestId}] No results found`);
    return { locationName: null, formattedAddress: null, latitude: null, longitude: null };
  } catch (error) {
    console.error(`[PlaceAt:${requestId}] Error:`, error);
    return { locationName: null, formattedAddress: null, latitude: null, longitude: null };
  }
};

const findPopularPlaceByTextSearch = async (
  address: string,
  apiKey: string,
  requestId: string
): Promise<{ locationName: string | null; formattedAddress: string | null; latitude: number | null; longitude: number | null }> => {
  try {
    const query = `popular place at ${address}`;
    const encodedQuery = encodeURIComponent(query);
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodedQuery}&key=${apiKey}`;

    console.log(`[PopularPlace:${requestId}] Searching: "${query}"`);

    const startTime = Date.now();
    const response = await fetch(url);
    const responseTime = Date.now() - startTime;

    const data = await response.json();
    console.log(`[PopularPlace:${requestId}] Response: ${data.status} with ${data.results?.length || 0} results (${responseTime}ms)`);

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const place = data.results[0];
      const placeName = place.name || null;
      const formattedAddress = place.formatted_address || null;
      const lat = place.geometry?.location?.lat || null;
      const lng = place.geometry?.location?.lng || null;

      console.log(`[PopularPlace:${requestId}] ✓ Found: "${placeName}"`);
      return {
        locationName: placeName,
        formattedAddress: formattedAddress,
        latitude: lat,
        longitude: lng
      };
    }

    console.log(`[PopularPlace:${requestId}] No results found`);
    return { locationName: null, formattedAddress: null, latitude: null, longitude: null };
  } catch (error) {
    console.error(`[PopularPlace:${requestId}] Error:`, error);
    return { locationName: null, formattedAddress: null, latitude: null, longitude: null };
  }
};

export const geocodeAddress = async (
  address: string,
  apiKey: string,
  supabaseClient?: any,
  providedLocationName?: string | null
): Promise<GeocodeResult> => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  console.log(`[Lookup:${requestId}] ========== START ==========`);
  console.log(`[Lookup:${requestId}] Address: "${address}"`);
  console.log(`[Lookup:${requestId}] Provided location_name: "${providedLocationName || 'N/A'}"`);

  // TIER 1: Use provided location name if available
  if (providedLocationName && providedLocationName.trim() !== '') {
    console.log(`[Lookup:${requestId}] ✓ Using provided location_name (0 API calls)`);
    const totalTime = Date.now() - startTime;
    console.log(`[Lookup:${requestId}] ========== END (${totalTime}ms) ==========`);
    return {
      locationName: providedLocationName.trim(),
      formattedAddress: address || null,
      latitude: null,
      longitude: null
    };
  }

  if (!address || address.trim() === '') {
    console.log(`[Lookup:${requestId}] Empty address, returning null`);
    return { locationName: null, formattedAddress: null, latitude: null, longitude: null };
  }

  if (!apiKey || apiKey.trim() === '') {
    console.error(`[Lookup:${requestId}] ERROR: API key missing!`);
    return { locationName: null, formattedAddress: null, latitude: null, longitude: null };
  }

  const normalizedAddress = address.trim().toLowerCase();

  // Check exact address cache
  if (supabaseClient) {
    try {
      const { data: cachedResult, error: cacheError } = await supabaseClient
        .from('location_cache')
        .select('location_name, formatted_address, latitude, longitude')
        .eq('address', normalizedAddress)
        .not('location_name', 'is', null)
        .maybeSingle();

      if (!cacheError && cachedResult) {
        console.log(`[Lookup:${requestId}] ✓ Cache hit: "${cachedResult.location_name}"`);
        const totalTime = Date.now() - startTime;
        console.log(`[Lookup:${requestId}] ========== END (${totalTime}ms) ==========`);
        return {
          locationName: cachedResult.location_name,
          formattedAddress: cachedResult.formatted_address,
          latitude: cachedResult.latitude,
          longitude: cachedResult.longitude
        };
      }
    } catch (error) {
      console.error(`[Lookup:${requestId}] Cache error:`, error);
    }
  }

  try {
    // TIER 2: Try "place at" search
    let result = await findPlaceByTextSearch(address, apiKey, requestId);

    if (result.locationName !== null) {
      console.log(`[Lookup:${requestId}] ✓ Place at search succeeded: "${result.locationName}"`);

      // Check proximity cache if we have coordinates
      if (supabaseClient && result.latitude !== null && result.longitude !== null) {
        try {
          const { data: nearbyResult } = await supabaseClient
            .rpc('find_nearby_location', {
              search_lat: result.latitude,
              search_lng: result.longitude,
              max_distance_meters: 50
            });

          if (nearbyResult && nearbyResult.length > 0) {
            const nearby = nearbyResult[0];
            console.log(`[Lookup:${requestId}] ✓ Proximity cache hit: "${nearby.location_name}" (${nearby.distance_meters.toFixed(1)}m)`);

            // Cache this address pointing to the nearby result
            await supabaseClient
              .from('location_cache')
              .upsert({
                address: normalizedAddress,
                location_name: nearby.location_name,
                formatted_address: nearby.formatted_address,
                latitude: nearby.latitude,
                longitude: nearby.longitude
              }, {
                onConflict: 'address',
                ignoreDuplicates: false
              });

            const totalTime = Date.now() - startTime;
            console.log(`[Lookup:${requestId}] ========== END (${totalTime}ms) ==========`);
            return {
              locationName: nearby.location_name,
              formattedAddress: nearby.formatted_address,
              latitude: nearby.latitude,
              longitude: nearby.longitude
            };
          }
        } catch (error) {
          console.error(`[Lookup:${requestId}] Proximity cache error:`, error);
        }

        // Cache the new result
        try {
          await supabaseClient
            .from('location_cache')
            .upsert({
              address: normalizedAddress,
              location_name: result.locationName,
              formatted_address: result.formattedAddress,
              latitude: result.latitude,
              longitude: result.longitude
            }, {
              onConflict: 'address',
              ignoreDuplicates: false
            });
        } catch (error) {
          console.error(`[Lookup:${requestId}] Cache write error:`, error);
        }
      }

      const totalTime = Date.now() - startTime;
      console.log(`[Lookup:${requestId}] ========== END (${totalTime}ms) ==========`);
      return result;
    }

    // TIER 3: Try "popular place at" search
    console.log(`[Lookup:${requestId}] Place at search failed, trying popular place...`);
    result = await findPopularPlaceByTextSearch(address, apiKey, requestId);

    if (result.locationName !== null) {
      console.log(`[Lookup:${requestId}] ✓ Popular place search succeeded: "${result.locationName}"`);

      // Cache the result
      if (supabaseClient && result.latitude !== null && result.longitude !== null) {
        try {
          await supabaseClient
            .from('location_cache')
            .upsert({
              address: normalizedAddress,
              location_name: result.locationName,
              formatted_address: result.formattedAddress,
              latitude: result.latitude,
              longitude: result.longitude
            }, {
              onConflict: 'address',
              ignoreDuplicates: false
            });
        } catch (error) {
          console.error(`[Lookup:${requestId}] Cache write error:`, error);
        }
      }

      const totalTime = Date.now() - startTime;
      console.log(`[Lookup:${requestId}] ========== END (${totalTime}ms) ==========`);
      return result;
    }

    // Both searches failed
    console.log(`[Lookup:${requestId}] All searches failed, returning null`);
    const totalTime = Date.now() - startTime;
    console.log(`[Lookup:${requestId}] ========== END (${totalTime}ms) ==========`);
    return { locationName: null, formattedAddress: null, latitude: null, longitude: null };

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[Lookup:${requestId}] ========== ERROR (${totalTime}ms) ==========`);
    console.error(`[Lookup:${requestId}] Exception:`, error);
    return { locationName: null, formattedAddress: null, latitude: null, longitude: null };
  }
};

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

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

const geocodeAddressCoordinates = async (
  address: string,
  apiKey: string,
  requestId: string
): Promise<{ latitude: number; longitude: number } | null> => {
  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;

    console.log(`[Geocode:${requestId}] Getting coordinates for address...`);
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const location = data.results[0].geometry?.location;
      if (location && location.lat && location.lng) {
        console.log(`[Geocode:${requestId}] ✓ Address coordinates: (${location.lat}, ${location.lng})`);
        return { latitude: location.lat, longitude: location.lng };
      }
    }

    console.log(`[Geocode:${requestId}] Could not geocode address`);
    return null;
  } catch (error) {
    console.error(`[Geocode:${requestId}] Error:`, error);
    return null;
  }
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

    console.log(`[PlaceSearch:${requestId}] Searching: "${query}"`);

    const startTime = Date.now();
    const response = await fetch(url);
    const responseTime = Date.now() - startTime;

    const data = await response.json();
    console.log(`[PlaceSearch:${requestId}] Response: ${data.status} with ${data.results?.length || 0} results (${responseTime}ms)`);

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const place = data.results[0];
      const placeName = place.name || null;
      const formattedAddress = place.formatted_address || null;
      const lat = place.geometry?.location?.lat || null;
      const lng = place.geometry?.location?.lng || null;
      const types = place.types || [];

      console.log(`[PlaceSearch:${requestId}] ✓ Found: "${placeName}" [types: ${types.join(', ')}]`);
      return {
        locationName: placeName,
        formattedAddress: formattedAddress,
        latitude: lat,
        longitude: lng
      };
    }

    console.log(`[PlaceSearch:${requestId}] No results found`);
    return { locationName: null, formattedAddress: null, latitude: null, longitude: null };
  } catch (error) {
    console.error(`[PlaceSearch:${requestId}] Error:`, error);
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

  if (supabaseClient) {
    try {
      const { data: cachedResult, error: cacheError } = await supabaseClient
        .from('location_cache')
        .select('location_name, formatted_address, latitude, longitude')
        .eq('address', normalizedAddress)
        .not('location_name', 'is', null)
        .maybeSingle();

      if (!cacheError && cachedResult) {
        console.log(`[Lookup:${requestId}] ✓ Exact cache hit: "${cachedResult.location_name}"`);
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
    console.log(`[Lookup:${requestId}] Step 1: Getting address coordinates for distance validation...`);
    const addressCoords = await geocodeAddressCoordinates(address, apiKey, requestId);

    if (!addressCoords) {
      console.log(`[Lookup:${requestId}] ✗ Could not geocode address, cannot validate distance`);
      const totalTime = Date.now() - startTime;
      console.log(`[Lookup:${requestId}] ========== END (${totalTime}ms) ==========`);
      return { locationName: null, formattedAddress: null, latitude: null, longitude: null };
    }

    console.log(`[Lookup:${requestId}] Step 2: Searching for place using Text Search API...`);
    const result = await findPlaceByTextSearch(address, apiKey, requestId);

    if (result.locationName === null || result.latitude === null || result.longitude === null) {
      console.log(`[Lookup:${requestId}] ✗ No place found by Text Search`);
      const totalTime = Date.now() - startTime;
      console.log(`[Lookup:${requestId}] ========== END (${totalTime}ms) ==========`);
      return { locationName: null, formattedAddress: null, latitude: null, longitude: null };
    }

    console.log(`[Lookup:${requestId}] Step 3: Validating distance (100m max threshold)...`);
    const distance = calculateDistance(
      addressCoords.latitude,
      addressCoords.longitude,
      result.latitude,
      result.longitude
    );

    console.log(`[Lookup:${requestId}] Distance from address to place: ${distance.toFixed(1)}m`);

    if (distance > 100) {
      console.log(`[Lookup:${requestId}] ✗ Place REJECTED: ${distance.toFixed(1)}m exceeds 100m threshold`);
      console.log(`[Lookup:${requestId}]   Address coords: (${addressCoords.latitude}, ${addressCoords.longitude})`);
      console.log(`[Lookup:${requestId}]   Place coords: (${result.latitude}, ${result.longitude})`);
      console.log(`[Lookup:${requestId}]   Place name: "${result.locationName}"`);
      const totalTime = Date.now() - startTime;
      console.log(`[Lookup:${requestId}] ========== END (${totalTime}ms) ==========`);
      return { locationName: null, formattedAddress: null, latitude: null, longitude: null };
    }

    console.log(`[Lookup:${requestId}] ✓ Place ACCEPTED: ${distance.toFixed(1)}m within 100m threshold`);
    console.log(`[Lookup:${requestId}]   Place name: "${result.locationName}"`);

    if (supabaseClient) {
      try {
        console.log(`[Lookup:${requestId}] Step 4: Checking proximity cache at (${result.latitude}, ${result.longitude})...`);
        const { data: nearbyResult } = await supabaseClient
          .rpc('find_nearby_location', {
            search_lat: result.latitude,
            search_lng: result.longitude,
            max_distance_meters: 50
          });

        if (nearbyResult && nearbyResult.length > 0) {
          const nearby = nearbyResult[0];
          const nearbyDistance = nearby.distance_meters;

          if (nearbyDistance <= 50) {
            console.log(`[Lookup:${requestId}] ✓ Proximity cache hit: "${nearby.location_name}" (${nearbyDistance.toFixed(1)}m away)`);

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
        }
      } catch (error) {
        console.error(`[Lookup:${requestId}] Proximity cache error:`, error);
      }

      try {
        console.log(`[Lookup:${requestId}] Step 5: Caching new result: "${result.locationName}"`);
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

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[Lookup:${requestId}] ========== ERROR (${totalTime}ms) ==========`);
    console.error(`[Lookup:${requestId}] Exception:`, error);
    return { locationName: null, formattedAddress: null, latitude: null, longitude: null };
  }
};
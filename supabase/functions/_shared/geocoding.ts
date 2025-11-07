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

const geocodeAddressToCoordinates = async (
  address: string,
  apiKey: string,
  requestId: string
): Promise<{ latitude: number; longitude: number; formattedAddress: string } | null> => {
  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;

    console.log(`[Step1-Geocode:${requestId}] Converting address to coordinates...`);
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const result = data.results[0];
      const location = result.geometry?.location;
      const formattedAddress = result.formatted_address;

      if (location && location.lat && location.lng) {
        console.log(`[Step1-Geocode:${requestId}] ✓ Coordinates: (${location.lat}, ${location.lng})`);
        console.log(`[Step1-Geocode:${requestId}] ✓ Formatted address: "${formattedAddress}"`);
        return {
          latitude: location.lat,
          longitude: location.lng,
          formattedAddress: formattedAddress
        };
      }
    }

    console.log(`[Step1-Geocode:${requestId}] ✗ Could not geocode address, status: ${data.status}`);
    return null;
  } catch (error) {
    console.error(`[Step1-Geocode:${requestId}] Error:`, error);
    return null;
  }
};

const findNearbyPlace = async (
  latitude: number,
  longitude: number,
  apiKey: string,
  requestId: string
): Promise<{ locationName: string | null; latitude: number; longitude: number } | null> => {
  try {
    const radius = 50;
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radius}&key=${apiKey}`;

    console.log(`[Step2-Nearby:${requestId}] Searching within ${radius}m radius...`);
    const response = await fetch(url);
    const data = await response.json();

    console.log(`[Step2-Nearby:${requestId}] Response: ${data.status} with ${data.results?.length || 0} results`);

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const place = data.results[0];
      const placeName = place.name || null;
      const placeLocation = place.geometry?.location;
      const types = place.types || [];

      console.log(`[Step2-Nearby:${requestId}] ✓ Top result: "${placeName}"`);
      console.log(`[Step2-Nearby:${requestId}]   Types: [${types.join(', ')}]`);
      console.log(`[Step2-Nearby:${requestId}]   Location: (${placeLocation?.lat}, ${placeLocation?.lng})`);

      return {
        locationName: placeName,
        latitude: placeLocation?.lat || latitude,
        longitude: placeLocation?.lng || longitude
      };
    }

    console.log(`[Step2-Nearby:${requestId}] ✗ No places found within ${radius}m radius`);
    return null;
  } catch (error) {
    console.error(`[Step2-Nearby:${requestId}] Error:`, error);
    return null;
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

  console.log(`[Geocoding:${requestId}] ========== START ==========`);
  console.log(`[Geocoding:${requestId}] Address: "${address}"`);
  console.log(`[Geocoding:${requestId}] Provided location_name: "${providedLocationName || 'N/A'}"`);

  if (providedLocationName && providedLocationName.trim() !== '') {
    console.log(`[Geocoding:${requestId}] ✓ Using provided location_name (0 API calls)`);
    const totalTime = Date.now() - startTime;
    console.log(`[Geocoding:${requestId}] ========== END (${totalTime}ms) ==========`);
    return {
      locationName: providedLocationName.trim(),
      formattedAddress: address || null,
      latitude: null,
      longitude: null
    };
  }

  if (!address || address.trim() === '') {
    console.log(`[Geocoding:${requestId}] Empty address, returning null`);
    return { locationName: null, formattedAddress: null, latitude: null, longitude: null };
  }

  if (!apiKey || apiKey.trim() === '') {
    console.error(`[Geocoding:${requestId}] ERROR: API key missing!`);
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
        console.log(`[Geocoding:${requestId}] ✓ Cache hit: "${cachedResult.location_name}"`);
        const totalTime = Date.now() - startTime;
        console.log(`[Geocoding:${requestId}] ========== END (${totalTime}ms) ==========`);
        return {
          locationName: cachedResult.location_name,
          formattedAddress: cachedResult.formatted_address,
          latitude: cachedResult.latitude,
          longitude: cachedResult.longitude
        };
      }
    } catch (error) {
      console.error(`[Geocoding:${requestId}] Cache error:`, error);
    }
  }

  try {
    console.log(`[Geocoding:${requestId}] STEP 1: Geocoding address to coordinates...`);
    const geocodeResult = await geocodeAddressToCoordinates(address, apiKey, requestId);

    if (!geocodeResult) {
      console.log(`[Geocoding:${requestId}] ✗ Geocoding failed`);
      const totalTime = Date.now() - startTime;
      console.log(`[Geocoding:${requestId}] ========== END (${totalTime}ms) ==========`);
      return { locationName: null, formattedAddress: null, latitude: null, longitude: null };
    }

    console.log(`[Geocoding:${requestId}] STEP 2: Searching for nearby places within 50m...`);
    const nearbyPlace = await findNearbyPlace(
      geocodeResult.latitude,
      geocodeResult.longitude,
      apiKey,
      requestId
    );

    let finalResult: GeocodeResult;

    if (nearbyPlace && nearbyPlace.locationName) {
      console.log(`[Geocoding:${requestId}] ✓ SUCCESS: Found location "${nearbyPlace.locationName}"`);
      finalResult = {
        locationName: nearbyPlace.locationName,
        formattedAddress: geocodeResult.formattedAddress,
        latitude: nearbyPlace.latitude,
        longitude: nearbyPlace.longitude
      };
    } else {
      console.log(`[Geocoding:${requestId}] ✗ No nearby place found, returning null location_name`);
      finalResult = {
        locationName: null,
        formattedAddress: geocodeResult.formattedAddress,
        latitude: geocodeResult.latitude,
        longitude: geocodeResult.longitude
      };
    }

    if (supabaseClient && finalResult.locationName) {
      try {
        console.log(`[Geocoding:${requestId}] Caching result: "${finalResult.locationName}"`);
        await supabaseClient
          .from('location_cache')
          .upsert({
            address: normalizedAddress,
            location_name: finalResult.locationName,
            formatted_address: finalResult.formattedAddress,
            latitude: finalResult.latitude,
            longitude: finalResult.longitude
          }, {
            onConflict: 'address',
            ignoreDuplicates: false
          });
        console.log(`[Geocoding:${requestId}] ✓ Cached successfully`);
      } catch (error) {
        console.error(`[Geocoding:${requestId}] Cache write error:`, error);
      }
    }

    const totalTime = Date.now() - startTime;
    console.log(`[Geocoding:${requestId}] ========== END (${totalTime}ms) ==========`);
    return finalResult;

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[Geocoding:${requestId}] ========== ERROR (${totalTime}ms) ==========`);
    console.error(`[Geocoding:${requestId}] Exception:`, error);
    return { locationName: null, formattedAddress: null, latitude: null, longitude: null };
  }
};

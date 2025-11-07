export interface GeocodeResult {
  locationName: string | null;
  formattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
}

const geocodeAddressToCoordinates = async (
  address: string,
  apiKey: string,
  requestId: string
): Promise<{ latitude: number; longitude: number; formattedAddress: string } | null> => {
  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;

    console.log(`[Step1-Geocode:$respo{requestId}] Converting address to coordinates...`);
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

const searchPlaceAtAddress = async (
  address: string,
  latitude: number,
  longitude: number,
  apiKey: string,
  requestId: string
): Promise<{ locationName: string | null; latitude: number; longitude: number } | null> => {
  try {
    const textQuery = `place at ${address}`;
    const url = `https://places.googleapis.com/v1/places:searchText`;

    const requestBody = {
      textQuery: textQuery,
      locationRestriction: {
        circle: {
          center: {
            latitude: latitude,
            longitude: longitude
          },
          radius: 50.0
        }
      }
    };

    console.log(`[Step2-PlaceAt:${requestId}] Searching: "${textQuery}"`);
    console.log(`[Step2-PlaceAt:${requestId}] Location restriction: 50m radius around (${latitude}, ${longitude})`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.types'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    console.log(`[Step2-PlaceAt:${requestId}] Response status: ${response.status}`);

    if (response.ok && data.places && data.places.length > 0) {
      const place = data.places[0];
      const placeName = place.displayName?.text || null;
      const placeLocation = place.location;
      const types = place.types || [];

      console.log(`[Step2-PlaceAt:${requestId}] ✓ Found: "${placeName}"`);
      console.log(`[Step2-PlaceAt:${requestId}]   Types: [${types.join(', ')}]`);
      console.log(`[Step2-PlaceAt:${requestId}]   Location: (${placeLocation?.latitude}, ${placeLocation?.longitude})`);

      return {
        locationName: placeName,
        latitude: placeLocation?.latitude || latitude,
        longitude: placeLocation?.longitude || longitude
      };
    }

    console.log(`[Step2-PlaceAt:${requestId}] ✗ No places found within 50m radius`);
    return null;
  } catch (error) {
    console.error(`[Step2-PlaceAt:${requestId}] Error:`, error);
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

    console.log(`[Geocoding:${requestId}] STEP 2: Searching for "place at ${address}" within 50m...`);
    const placeResult = await searchPlaceAtAddress(
      address,
      geocodeResult.latitude,
      geocodeResult.longitude,
      apiKey,
      requestId
    );

    let finalResult: GeocodeResult;

    if (placeResult && placeResult.locationName) {
      console.log(`[Geocoding:${requestId}] ✓ SUCCESS: Found location "${placeResult.locationName}"`);
      finalResult = {
        locationName: placeResult.locationName,
        formattedAddress: geocodeResult.formattedAddress,
        latitude: placeResult.latitude,
        longitude: placeResult.longitude
      };
    } else {
      console.log(`[Geocoding:${requestId}] ✗ No place found, returning null location_name`);
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

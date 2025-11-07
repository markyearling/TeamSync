export interface GeocodeResult {
  locationName: string | null;
  formattedAddress: string | null;
  latitude: number | null;
  longitude: number | null;
}

const VENUE_TYPES = [
  'stadium',
  'sports_complex',
  'tourist_attraction',
  'point_of_interest',
  'establishment',
  'park',
  'premise'
];

const EXCLUDE_TYPES = [
  'restaurant',
  'food',
  'cafe',
  'bar',
  'meal_takeaway',
  'meal_delivery'
];

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

const hasVenueType = (types: string[] | undefined): boolean => {
  if (!types || types.length === 0) return false;
  return types.some(type => VENUE_TYPES.includes(type));
};

const hasExcludedType = (types: string[] | undefined): boolean => {
  if (!types || types.length === 0) return false;
  return types.some(type => EXCLUDE_TYPES.includes(type));
};

const findBestVenue = (results: any[]): any | null => {
  const filtered = results.filter(place => {
    const types = place.types || [];
    const hasVenue = hasVenueType(types);
    const hasExcluded = hasExcludedType(types);
    return hasVenue && !hasExcluded;
  });

  if (filtered.length > 0) {
    return filtered[0];
  }

  return results[0] || null;
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

    console.log(`[TIER2-PopularPlace:${requestId}] Searching: "${query}"`);

    const startTime = Date.now();
    const response = await fetch(url);
    const responseTime = Date.now() - startTime;

    const data = await response.json();
    console.log(`[TIER2-PopularPlace:${requestId}] Response: ${data.status} with ${data.results?.length || 0} results (${responseTime}ms)`);

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const place = findBestVenue(data.results);
      if (!place) {
        console.log(`[TIER2-PopularPlace:${requestId}] No suitable venue found after filtering`);
        return { locationName: null, formattedAddress: null, latitude: null, longitude: null };
      }

      const placeName = place.name || null;
      const formattedAddress = place.formatted_address || null;
      const lat = place.geometry?.location?.lat || null;
      const lng = place.geometry?.location?.lng || null;
      const types = place.types || [];

      console.log(`[TIER2-PopularPlace:${requestId}] ✓ Found: "${placeName}" [types: ${types.join(', ')}]`);
      return {
        locationName: placeName,
        formattedAddress: formattedAddress,
        latitude: lat,
        longitude: lng
      };
    }

    console.log(`[TIER2-PopularPlace:${requestId}] No results found`);
    return { locationName: null, formattedAddress: null, latitude: null, longitude: null };
  } catch (error) {
    console.error(`[TIER2-PopularPlace:${requestId}] Error:`, error);
    return { locationName: null, formattedAddress: null, latitude: null, longitude: null };
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

    console.log(`[TIER3-PlaceAt:${requestId}] Searching: "${query}"`);

    const startTime = Date.now();
    const response = await fetch(url);
    const responseTime = Date.now() - startTime;

    const data = await response.json();
    console.log(`[TIER3-PlaceAt:${requestId}] Response: ${data.status} with ${data.results?.length || 0} results (${responseTime}ms)`);

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const place = findBestVenue(data.results);
      if (!place) {
        console.log(`[TIER3-PlaceAt:${requestId}] No suitable venue found after filtering`);
        return { locationName: null, formattedAddress: null, latitude: null, longitude: null };
      }

      const placeName = place.name || null;
      const formattedAddress = place.formatted_address || null;
      const lat = place.geometry?.location?.lat || null;
      const lng = place.geometry?.location?.lng || null;
      const types = place.types || [];

      console.log(`[TIER3-PlaceAt:${requestId}] ✓ Found: "${placeName}" [types: ${types.join(', ')}]`);
      return {
        locationName: placeName,
        formattedAddress: formattedAddress,
        latitude: lat,
        longitude: lng
      };
    }

    console.log(`[TIER3-PlaceAt:${requestId}] No results found`);
    return { locationName: null, formattedAddress: null, latitude: null, longitude: null };
  } catch (error) {
    console.error(`[TIER3-PlaceAt:${requestId}] Error:`, error);
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
    console.log(`[Lookup:${requestId}] ✓ TIER 1: Using provided location_name (0 API calls)`);
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
    const addressCoords = await geocodeAddressCoordinates(address, apiKey, requestId);

    console.log(`[Lookup:${requestId}] Starting TIER 2: Popular place search...`);
    let result = await findPopularPlaceByTextSearch(address, apiKey, requestId);

    if (result.locationName !== null) {
      console.log(`[Lookup:${requestId}] ✓ TIER 2 succeeded: "${result.locationName}"`);

      if (addressCoords && result.latitude !== null && result.longitude !== null) {
        const distance = calculateDistance(
          addressCoords.latitude,
          addressCoords.longitude,
          result.latitude,
          result.longitude
        );

        console.log(`[Lookup:${requestId}] Distance from address to place: ${distance.toFixed(1)}m`);

        if (distance > 100) {
          console.log(`[Lookup:${requestId}] ✗ Place rejected: ${distance.toFixed(1)}m exceeds 100m threshold`);
          result = { locationName: null, formattedAddress: null, latitude: null, longitude: null };
        } else {
          console.log(`[Lookup:${requestId}] ✓ Place accepted: ${distance.toFixed(1)}m within 100m threshold`);
        }
      }

      if (result.locationName !== null && supabaseClient && result.latitude !== null && result.longitude !== null) {
        try {
          console.log(`[Lookup:${requestId}] Checking proximity cache at (${result.latitude}, ${result.longitude})...`);
          const { data: nearbyResult } = await supabaseClient
            .rpc('find_nearby_location', {
              search_lat: result.latitude,
              search_lng: result.longitude,
              max_distance_meters: 50
            });

          if (nearbyResult && nearbyResult.length > 0) {
            const nearby = nearbyResult[0];
            const distance = nearby.distance_meters;

            if (distance <= 50) {
              console.log(`[Lookup:${requestId}] ✓ Proximity cache hit: "${nearby.location_name}" (${distance.toFixed(1)}m away)`);

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
            } else {
              console.log(`[Lookup:${requestId}] Nearby location too far: ${distance.toFixed(1)}m > 50m threshold`);
            }
          } else {
            console.log(`[Lookup:${requestId}] No nearby cached locations found within 50m`);
          }
        } catch (error) {
          console.error(`[Lookup:${requestId}] Proximity cache error:`, error);
        }

        try {
          console.log(`[Lookup:${requestId}] Caching new result: "${result.locationName}"`);
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

    console.log(`[Lookup:${requestId}] TIER 2 failed, starting TIER 3: Place at search...`);
    result = await findPlaceByTextSearch(address, apiKey, requestId);

    if (result.locationName !== null) {
      console.log(`[Lookup:${requestId}] ✓ TIER 3 succeeded: "${result.locationName}"`);

      if (addressCoords && result.latitude !== null && result.longitude !== null) {
        const distance = calculateDistance(
          addressCoords.latitude,
          addressCoords.longitude,
          result.latitude,
          result.longitude
        );

        console.log(`[Lookup:${requestId}] Distance from address to place: ${distance.toFixed(1)}m`);

        if (distance > 100) {
          console.log(`[Lookup:${requestId}] ✗ Place rejected: ${distance.toFixed(1)}m exceeds 100m threshold`);
          result = { locationName: null, formattedAddress: null, latitude: null, longitude: null };
        } else {
          console.log(`[Lookup:${requestId}] ✓ Place accepted: ${distance.toFixed(1)}m within 100m threshold`);
        }
      }

      if (result.locationName !== null && supabaseClient && result.latitude !== null && result.longitude !== null) {
        try {
          console.log(`[Lookup:${requestId}] Checking proximity cache at (${result.latitude}, ${result.longitude})...`);
          const { data: nearbyResult } = await supabaseClient
            .rpc('find_nearby_location', {
              search_lat: result.latitude,
              search_lng: result.longitude,
              max_distance_meters: 50
            });

          if (nearbyResult && nearbyResult.length > 0) {
            const nearby = nearbyResult[0];
            const distance = nearby.distance_meters;

            if (distance <= 50) {
              console.log(`[Lookup:${requestId}] ✓ Proximity cache hit: "${nearby.location_name}" (${distance.toFixed(1)}m away)`);

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
            } else {
              console.log(`[Lookup:${requestId}] Nearby location too far: ${distance.toFixed(1)}m > 50m threshold`);
            }
          } else {
            console.log(`[Lookup:${requestId}] No nearby cached locations found within 50m`);
          }
        } catch (error) {
          console.error(`[Lookup:${requestId}] Proximity cache error:`, error);
        }

        try {
          console.log(`[Lookup:${requestId}] Caching new result: "${result.locationName}"`);
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

    console.log(`[Lookup:${requestId}] All tiers failed, returning null`);
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
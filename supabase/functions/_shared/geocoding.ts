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

const isValidPlaceName = (name: string, address: string): boolean => {
  const lowerName = name.toLowerCase();
  const lowerAddress = address.toLowerCase();

  const addressPatterns = [
    /^\d+[\s-]+\w+[\s-]+(?:st|street|rd|road|ave|avenue|ln|lane|dr|drive|blvd|boulevard|way|ct|court|pl|place)/i,
    /^[news]\d+[news]\d+/i,
    /^\d+\s*[news]\s*\d+(st|nd|rd|th)?/i,
    /^(?:wi|us|state|county|highway|hwy|route|rt)[\s-]?\d+/i,
  ];

  for (const pattern of addressPatterns) {
    if (pattern.test(lowerName)) {
      console.log(`[Places] Rejected "${name}" - matches address pattern: ${pattern}`);
      return false;
    }
  }

  const genericTerms = ['grafton', 'mequon', 'milwaukee', 'wisconsin', 'port washington', 'germantown', 'brookfield', 'brown deer'];
  for (const term of genericTerms) {
    if (lowerName === term && lowerAddress.includes(term)) {
      console.log(`[Places] Rejected "${name}" - generic city/location name`);
      return false;
    }
  }

  if (lowerName === lowerAddress) {
    console.log(`[Places] Rejected "${name}" - same as address`);
    return false;
  }

  return true;
};

const isBusinessPlaceType = (types: string[]): boolean => {
  const businessTypes = [
    'establishment',
    'point_of_interest',
    'stadium',
    'park',
    'gym',
    'school',
    'primary_school',
    'secondary_school',
    'university',
    'sports_complex',
    'recreation_center',
    'community_center',
    'playground',
    'athletic_field'
  ];

  return types.some(type => businessTypes.includes(type));
};

const isGenericPlaceType = (types: string[]): boolean => {
  const genericTypes = [
    'street_address',
    'premise',
    'subpremise',
    'route',
    'neighborhood',
    'locality',
    'sublocality',
    'postal_code'
  ];

  return types.every(type => genericTypes.includes(type) || type === 'geocode');
};

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const geocodeAddressToCoordinates = async (
  address: string,
  apiKey: string,
  requestId: string
): Promise<{ latitude: number | null; longitude: number | null; formattedAddress: string | null }> => {
  try {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`;

    console.log(`[Geocode:${requestId}] Getting coordinates for address: "${address}"`);
    console.log(`[Geocode:${requestId}] API URL (masked): https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${maskApiKey(apiKey)}`);

    const startTime = Date.now();
    const response = await fetch(url);
    const responseTime = Date.now() - startTime;

    console.log(`[Geocode:${requestId}] API response status: ${response.status} (${responseTime}ms)`);

    const data = await response.json();
    console.log(`[Geocode:${requestId}] API response status field: "${data.status}"`);
    console.log(`[Geocode:${requestId}] API response results count: ${data.results?.length || 0}`);

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const result = data.results[0];
      const lat = result.geometry?.location?.lat || null;
      const lng = result.geometry?.location?.lng || null;
      const formattedAddress = result.formatted_address || null;

      console.log(`[Geocode:${requestId}] ✓ Successfully geocoded address`);
      console.log(`[Geocode:${requestId}]   - Coordinates: ${lat}, ${lng}`);
      console.log(`[Geocode:${requestId}]   - Formatted Address: "${formattedAddress}"`);

      return { latitude: lat, longitude: lng, formattedAddress };
    } else {
      console.log(`[Geocode:${requestId}] Failed to geocode address: ${data.status}`);
      if (data.error_message) {
        console.error(`[Geocode:${requestId}] API error message: ${data.error_message}`);
      }
      return { latitude: null, longitude: null, formattedAddress: null };
    }
  } catch (error) {
    console.error(`[Geocode:${requestId}] Exception during Geocode API call:`, error);
    if (error instanceof Error) {
      console.error(`[Geocode:${requestId}] Error message: ${error.message}`);
    }
    return { latitude: null, longitude: null, formattedAddress: null };
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

    console.log(`[TextSearch:${requestId}] TIER 2: Trying "place at" search: "${query}"`);
    console.log(`[TextSearch:${requestId}] API URL (masked): https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodedQuery}&key=${maskApiKey(apiKey)}`);

    const startTime = Date.now();
    const response = await fetch(url);
    const responseTime = Date.now() - startTime;

    console.log(`[TextSearch:${requestId}] API response status: ${response.status} (${responseTime}ms)`);

    const data = await response.json();
    console.log(`[TextSearch:${requestId}] API response status field: "${data.status}"`);
    console.log(`[TextSearch:${requestId}] API response results count: ${data.results?.length || 0}`);

    if (data.status !== 'OK') {
      if (data.status === 'ZERO_RESULTS') {
        console.log(`[TextSearch:${requestId}] No places found for "place at" query`);
      } else {
        console.error(`[TextSearch:${requestId}] API returned non-OK status: ${data.status}`);
        if (data.error_message) {
          console.error(`[TextSearch:${requestId}] API error message: ${data.error_message}`);
        }
      }
      return { locationName: null, formattedAddress: null, latitude: null, longitude: null };
    }

    if (data.results && data.results.length > 0) {
      console.log(`[TextSearch:${requestId}] Found ${data.results.length} places, filtering for valid business names...`);

      for (let i = 0; i < Math.min(data.results.length, 5); i++) {
        const place = data.results[i];
        const placeName = place.name || '';
        const placeTypes = place.types || [];
        const formattedAddress = place.formatted_address || null;
        const geometry = place.geometry || null;
        const lat = geometry?.location?.lat || null;
        const lng = geometry?.location?.lng || null;

        console.log(`[TextSearch:${requestId}] Checking result ${i + 1}:`);
        console.log(`[TextSearch:${requestId}]   - Name: "${placeName}"`);
        console.log(`[TextSearch:${requestId}]   - Types: [${placeTypes.join(', ')}]`);
        console.log(`[TextSearch:${requestId}]   - Formatted Address: "${formattedAddress}"`);
        console.log(`[TextSearch:${requestId}]   - Coordinates: ${lat}, ${lng}`);

        if (isGenericPlaceType(placeTypes)) {
          console.log(`[TextSearch:${requestId}]   - Rejected: Generic place type (address/premise)`);
          continue;
        }

        if (isBusinessPlaceType(placeTypes) && isValidPlaceName(placeName, address)) {
          console.log(`[TextSearch:${requestId}] ✓ TIER 2 SUCCESS: Found valid business place: "${placeName}"`);
          return {
            locationName: placeName,
            formattedAddress: formattedAddress,
            latitude: lat,
            longitude: lng
          };
        } else if (isBusinessPlaceType(placeTypes)) {
          console.log(`[TextSearch:${requestId}]   - Rejected: Business type but invalid name`);
        } else {
          console.log(`[TextSearch:${requestId}]   - Rejected: Not a business place type`);
        }
      }

      console.log(`[TextSearch:${requestId}] ⚠ No valid business names found in "place at" results`);
    }

    console.log(`[TextSearch:${requestId}] TIER 2 FAILED: No valid location name found with "place at"`);
    return { locationName: null, formattedAddress: null, latitude: null, longitude: null };
  } catch (error) {
    console.error(`[TextSearch:${requestId}] Exception during Text Search API call:`, error);
    if (error instanceof Error) {
      console.error(`[TextSearch:${requestId}] Error message: ${error.message}`);
    }
    return { locationName: null, formattedAddress: null, latitude: null, longitude: null };
  }
};

const findPopularPlaceByTextSearch = async (
  address: string,
  apiKey: string,
  requestId: string
): Promise<{ locationName: string | null; formattedAddress: string | null; latitude: number | null; longitude: number | null }> => {
  try {
    console.log(`[PopularPlace:${requestId}] TIER 3: Starting "popular places at" fallback`);
    console.log(`[PopularPlace:${requestId}] Step 1: Geocoding address to get coordinates...`);
    const geocodeResult = await geocodeAddressToCoordinates(address, apiKey, requestId);

    if (geocodeResult.latitude === null || geocodeResult.longitude === null) {
      console.log(`[PopularPlace:${requestId}] ⚠ TIER 3 FAILED: Cannot proceed - failed to geocode address`);
      return { locationName: null, formattedAddress: null, latitude: null, longitude: null };
    }

    console.log(`[PopularPlace:${requestId}] Step 2: Searching for popular places at this address...`);
    console.log(`[PopularPlace:${requestId}] Using coordinates: ${geocodeResult.latitude}, ${geocodeResult.longitude}`);

    const location = `${geocodeResult.latitude},${geocodeResult.longitude}`;
    const radius = 50;
    const query = `popular places at ${address}`;
    const encodedQuery = encodeURIComponent(query);
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodedQuery}&location=${location}&radius=${radius}&key=${apiKey}`;

    console.log(`[PopularPlace:${requestId}] Text search query: "${query}"`);
    console.log(`[PopularPlace:${requestId}] Search radius: ${radius}m from address coordinates`);
    console.log(`[PopularPlace:${requestId}] API URL (masked): https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodedQuery}&location=${location}&radius=${radius}&key=${maskApiKey(apiKey)}`);

    const startTime = Date.now();
    const response = await fetch(url);
    const responseTime = Date.now() - startTime;

    console.log(`[PopularPlace:${requestId}] API response status: ${response.status} (${responseTime}ms)`);

    const data = await response.json();
    console.log(`[PopularPlace:${requestId}] API response status field: "${data.status}"`);
    console.log(`[PopularPlace:${requestId}] API response results count: ${data.results?.length || 0}`);

    if (data.status !== 'OK') {
      if (data.status === 'ZERO_RESULTS') {
        console.log(`[PopularPlace:${requestId}] No places found within ${radius}m of address`);
      } else {
        console.error(`[PopularPlace:${requestId}] API returned non-OK status: ${data.status}`);
        if (data.error_message) {
          console.error(`[PopularPlace:${requestId}] API error message: ${data.error_message}`);
        }
      }
      return { locationName: null, formattedAddress: null, latitude: null, longitude: null };
    }

    if (data.results && data.results.length > 0) {
      console.log(`[PopularPlace:${requestId}] Found ${data.results.length} places, filtering for valid business names...`);

      for (let i = 0; i < Math.min(data.results.length, 5); i++) {
        const place = data.results[i];
        const placeName = place.name || '';
        const placeTypes = place.types || [];
        const formattedAddress = place.formatted_address || null;
        const geometry = place.geometry || null;
        const lat = geometry?.location?.lat || null;
        const lng = geometry?.location?.lng || null;

        if (lat && lng) {
          const distanceMeters = calculateDistance(
            geocodeResult.latitude!,
            geocodeResult.longitude!,
            lat,
            lng
          );

          console.log(`[PopularPlace:${requestId}] Checking result ${i + 1}:`);
          console.log(`[PopularPlace:${requestId}]   - Name: "${placeName}"`);
          console.log(`[PopularPlace:${requestId}]   - Types: [${placeTypes.join(', ')}]`);
          console.log(`[PopularPlace:${requestId}]   - Formatted Address: "${formattedAddress}"`);
          console.log(`[PopularPlace:${requestId}]   - Coordinates: ${lat}, ${lng}`);
          console.log(`[PopularPlace:${requestId}]   - Distance from address: ${distanceMeters.toFixed(1)}m`);

          if (distanceMeters > radius) {
            console.log(`[PopularPlace:${requestId}]   - Rejected: Too far from address (${distanceMeters.toFixed(1)}m > ${radius}m)`);
            continue;
          }

          if (isGenericPlaceType(placeTypes)) {
            console.log(`[PopularPlace:${requestId}]   - Rejected: Generic place type (address/premise)`);
            continue;
          }

          if (isBusinessPlaceType(placeTypes) && isValidPlaceName(placeName, address)) {
            console.log(`[PopularPlace:${requestId}] ✓ TIER 3 SUCCESS: Found valid business place within ${distanceMeters.toFixed(1)}m: "${placeName}"`);
            return {
              locationName: placeName,
              formattedAddress: formattedAddress,
              latitude: lat,
              longitude: lng
            };
          } else if (isBusinessPlaceType(placeTypes)) {
            console.log(`[PopularPlace:${requestId}]   - Rejected: Business type but invalid name`);
          } else {
            console.log(`[PopularPlace:${requestId}]   - Rejected: Not a business place type`);
          }
        }
      }

      console.log(`[PopularPlace:${requestId}] ⚠ No valid business names found within ${radius}m of address`);
    }

    console.log(`[PopularPlace:${requestId}] TIER 3 FAILED: No place name found`);
    return { locationName: null, formattedAddress: null, latitude: null, longitude: null };
  } catch (error) {
    console.error(`[PopularPlace:${requestId}] Exception during Popular Place Search:`, error);
    if (error instanceof Error) {
      console.error(`[PopularPlace:${requestId}] Error message: ${error.message}`);
    }
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

  console.log(`[Lookup:${requestId}] ========== START LOCATION LOOKUP ==========`);
  console.log(`[Lookup:${requestId}] Input address: "${address}"`);
  console.log(`[Lookup:${requestId}] Provided location_name: "${providedLocationName || 'N/A'}"`);
  console.log(`[Lookup:${requestId}] API key present: ${!!apiKey}, masked: ${maskApiKey(apiKey)}`);
  console.log(`[Lookup:${requestId}] Supabase client available: ${!!supabaseClient}`);

  if (providedLocationName && providedLocationName.trim() !== '') {
    console.log(`[Lookup:${requestId}] TIER 1 SUCCESS: Using provided location_name (0 API calls)`);
    const totalTime = Date.now() - startTime;
    console.log(`[Lookup:${requestId}] ========== END (PROVIDED, ${totalTime}ms) ==========`);
    return {
      locationName: providedLocationName.trim(),
      formattedAddress: address || null,
      latitude: null,
      longitude: null
    };
  }

  if (!address || address.trim() === '') {
    console.log(`[Lookup:${requestId}] Empty address, returning null result`);
    return { locationName: null, formattedAddress: null, latitude: null, longitude: null };
  }

  if (!apiKey || apiKey.trim() === '') {
    console.error(`[Lookup:${requestId}] ERROR: API key is missing or empty!`);
    return { locationName: null, formattedAddress: null, latitude: null, longitude: null };
  }

  const normalizedAddress = address.trim().toLowerCase();
  console.log(`[Lookup:${requestId}] Normalized address: "${normalizedAddress}"`);

  if (supabaseClient) {
    const cacheStartTime = Date.now();
    try {
      console.log(`[Lookup:${requestId}] Checking exact address cache for: "${normalizedAddress}"`);
      const { data: cachedResult, error: cacheError } = await supabaseClient
        .from('location_cache')
        .select('location_name, formatted_address, latitude, longitude')
        .eq('address', normalizedAddress)
        .not('location_name', 'is', null)
        .maybeSingle();

      const cacheTime = Date.now() - cacheStartTime;

      if (cacheError) {
        console.error(`[Lookup:${requestId}] Cache lookup error (${cacheTime}ms):`, cacheError.message);
      } else if (cachedResult) {
        console.log(`[Lookup:${requestId}] ✓ EXACT ADDRESS CACHE HIT (${cacheTime}ms)`);
        console.log(`[Lookup:${requestId}] Cached location_name: "${cachedResult.location_name}"`);
        console.log(`[Lookup:${requestId}] Cached formatted_address: "${cachedResult.formatted_address}"`);
        const totalTime = Date.now() - startTime;
        console.log(`[Lookup:${requestId}] ========== END (CACHED, ${totalTime}ms) ==========`);
        return {
          locationName: cachedResult.location_name,
          formattedAddress: cachedResult.formatted_address,
          latitude: cachedResult.latitude,
          longitude: cachedResult.longitude
        };
      } else {
        console.log(`[Lookup:${requestId}] Exact address cache miss (${cacheTime}ms)`);
      }
    } catch (error) {
      console.error(`[Lookup:${requestId}] Cache lookup exception:`, error);
    }
  } else {
    console.log(`[Lookup:${requestId}] No Supabase client, skipping cache`);
  }

  try {
    console.log(`[Lookup:${requestId}] Starting three-tier geocoding approach...`);

    let result = await findPlaceByTextSearch(address, apiKey, requestId);

    if (result.locationName !== null) {
      console.log(`[Lookup:${requestId}] TIER 2 succeeded, found location: "${result.locationName}"`);

      if (supabaseClient && result.latitude !== null && result.longitude !== null) {
        const proximitySearchStart = Date.now();
        const { data: nearbyResult, error: proximityError } = await supabaseClient
          .rpc('find_nearby_location', {
            search_lat: result.latitude,
            search_lng: result.longitude,
            max_distance_meters: 50
          });
        const proximitySearchTime = Date.now() - proximitySearchStart;

        if (!proximityError && nearbyResult && nearbyResult.length > 0) {
          const nearby = nearbyResult[0];
          console.log(`[Lookup:${requestId}] ✓ PROXIMITY CACHE HIT (${proximitySearchTime}ms)!`);
          console.log(`[Lookup:${requestId}] Found nearby location within ${nearby.distance_meters.toFixed(1)}m`);
          console.log(`[Lookup:${requestId}] Using cached result: "${nearby.location_name}"`);

          try {
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
            console.log(`[Lookup:${requestId}] ✓ Cached proximity result for exact address`);
          } catch (cacheWriteError) {
            console.error(`[Lookup:${requestId}] Failed to cache proximity result:`, cacheWriteError);
          }

          const totalTime = Date.now() - startTime;
          console.log(`[Lookup:${requestId}] ========== END (PROXIMITY CACHED, ${totalTime}ms) ==========`);
          return {
            locationName: nearby.location_name,
            formattedAddress: nearby.formatted_address,
            latitude: nearby.latitude,
            longitude: nearby.longitude
          };
        }
      }

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
          console.log(`[Lookup:${requestId}] ✓ Successfully cached TIER 2 result`);
        } catch (error) {
          console.error(`[Lookup:${requestId}] Cache write exception:`, error);
        }
      }

      const totalTime = Date.now() - startTime;
      console.log(`[Lookup:${requestId}] ========== END (TIER 2, ${totalTime}ms) ==========`);
      return result;
    }

    console.log(`[Lookup:${requestId}] TIER 2 failed, attempting TIER 3: "popular places at" fallback...`);
    result = await findPopularPlaceByTextSearch(address, apiKey, requestId);

    if (result.locationName !== null) {
      console.log(`[Lookup:${requestId}] TIER 3 succeeded, found location: "${result.locationName}"`);

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
          console.log(`[Lookup:${requestId}] ✓ Successfully cached TIER 3 result`);
        } catch (error) {
          console.error(`[Lookup:${requestId}] Cache write exception:`, error);
        }
      }

      const totalTime = Date.now() - startTime;
      console.log(`[Lookup:${requestId}] ========== END (TIER 3, ${totalTime}ms) ==========`);
      return result;
    }

    console.log(`[Lookup:${requestId}] ALL TIERS FAILED: No valid location name found`);
    const totalTime = Date.now() - startTime;
    console.log(`[Lookup:${requestId}] ========== END (FAILED, ${totalTime}ms) ==========`);
    return result;

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[Lookup:${requestId}] ========== ERROR (${totalTime}ms) ==========`);
    console.error(`[Lookup:${requestId}] Exception:`, error);
    if (error instanceof Error) {
      console.error(`[Lookup:${requestId}] Error message: ${error.message}`);
      console.error(`[Lookup:${requestId}] Error stack:`, error.stack);
    }
    return { locationName: null, formattedAddress: null, latitude: null, longitude: null };
  }
};

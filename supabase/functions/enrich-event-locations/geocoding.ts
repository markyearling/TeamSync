export interface GeocodeResult {
  locationName: string | null;
  formattedAddress: string | null;
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

const findPlaceByTextSearch = async (
  address: string,
  apiKey: string,
  requestId: string
): Promise<{ locationName: string | null; formattedAddress: string | null }> => {
  try {
    const queries = [
      `place at ${address}`,
      address
    ];

    for (let queryIndex = 0; queryIndex < queries.length; queryIndex++) {
      const query = queries[queryIndex];
      const encodedQuery = encodeURIComponent(query);
      const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodedQuery}&key=${apiKey}`;

      console.log(`[TextSearch:${requestId}] Attempt ${queryIndex + 1}/${queries.length}: "${query}"`);
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
          console.log(`[TextSearch:${requestId}] No places found for query: "${query}"`);
          continue;
        } else {
          console.error(`[TextSearch:${requestId}] API returned non-OK status: ${data.status}`);
          if (data.error_message) {
            console.error(`[TextSearch:${requestId}] API error message: ${data.error_message}`);
          }
          if (queryIndex === queries.length - 1) {
            return { locationName: null, formattedAddress: null };
          }
          continue;
        }
      }

      if (data.results && data.results.length > 0) {
        console.log(`[TextSearch:${requestId}] Found ${data.results.length} places, filtering for valid business names...`);

        for (let i = 0; i < Math.min(data.results.length, 5); i++) {
          const place = data.results[i];
          const placeName = place.name || '';
          const placeTypes = place.types || [];
          const formattedAddress = place.formatted_address || null;

          console.log(`[TextSearch:${requestId}] Checking result ${i + 1}:`);
          console.log(`[TextSearch:${requestId}]   - Name: "${placeName}"`);
          console.log(`[TextSearch:${requestId}]   - Types: [${placeTypes.join(', ')}]`);
          console.log(`[TextSearch:${requestId}]   - Formatted Address: "${formattedAddress}"`);

          if (isGenericPlaceType(placeTypes)) {
            console.log(`[TextSearch:${requestId}]   - Rejected: Generic place type (address/premise)`);
            continue;
          }

          if (isBusinessPlaceType(placeTypes) && isValidPlaceName(placeName, address)) {
            console.log(`[TextSearch:${requestId}] ✓ Found valid business place: "${placeName}"`);
            return {
              locationName: placeName,
              formattedAddress: formattedAddress
            };
          } else if (isBusinessPlaceType(placeTypes)) {
            console.log(`[TextSearch:${requestId}]   - Rejected: Business type but invalid name`);
          } else {
            console.log(`[TextSearch:${requestId}]   - Rejected: Not a business place type`);
          }
        }

        console.log(`[TextSearch:${requestId}] ⚠ No valid business names found in results`);
      }
    }

    console.log(`[TextSearch:${requestId}] All queries exhausted, no valid location name found`);
    return { locationName: null, formattedAddress: null };
  } catch (error) {
    console.error(`[TextSearch:${requestId}] Exception during Text Search API call:`, error);
    if (error instanceof Error) {
      console.error(`[TextSearch:${requestId}] Error message: ${error.message}`);
    }
    return { locationName: null, formattedAddress: null };
  }
};

export const geocodeAddress = async (
  address: string,
  apiKey: string,
  supabaseClient?: any
): Promise<GeocodeResult> => {
  const startTime = Date.now();
  const requestId = Math.random().toString(36).substring(7);

  console.log(`[Lookup:${requestId}] ========== START LOCATION LOOKUP ==========`);
  console.log(`[Lookup:${requestId}] Input address: "${address}"`);
  console.log(`[Lookup:${requestId}] API key present: ${!!apiKey}, masked: ${maskApiKey(apiKey)}`);
  console.log(`[Lookup:${requestId}] Supabase client available: ${!!supabaseClient}`);

  if (!address || address.trim() === '') {
    console.log(`[Lookup:${requestId}] Empty address, returning null result`);
    return { locationName: null, formattedAddress: null };
  }

  if (!apiKey || apiKey.trim() === '') {
    console.error(`[Lookup:${requestId}] ERROR: API key is missing or empty!`);
    return { locationName: null, formattedAddress: null };
  }

  const normalizedAddress = address.trim().toLowerCase();
  console.log(`[Lookup:${requestId}] Normalized address: "${normalizedAddress}"`);

  if (supabaseClient) {
    const cacheStartTime = Date.now();
    try {
      console.log(`[Lookup:${requestId}] Checking cache for: "${normalizedAddress}"`);
      const { data: cachedResult, error: cacheError } = await supabaseClient
        .from('location_cache')
        .select('location_name, formatted_address')
        .eq('address', normalizedAddress)
        .not('location_name', 'is', null)
        .maybeSingle();

      const cacheTime = Date.now() - cacheStartTime;

      if (cacheError) {
        console.error(`[Lookup:${requestId}] Cache lookup error (${cacheTime}ms):`, cacheError.message);
      } else if (cachedResult) {
        console.log(`[Lookup:${requestId}] ✓ CACHE HIT (${cacheTime}ms)`);
        console.log(`[Lookup:${requestId}] Cached location_name: "${cachedResult.location_name}"`);
        console.log(`[Lookup:${requestId}] Cached formatted_address: "${cachedResult.formatted_address}"`);
        const totalTime = Date.now() - startTime;
        console.log(`[Lookup:${requestId}] ========== END (CACHED, ${totalTime}ms) ==========`);
        return {
          locationName: cachedResult.location_name,
          formattedAddress: cachedResult.formatted_address
        };
      } else {
        console.log(`[Lookup:${requestId}] Cache miss (${cacheTime}ms), will call Places API`);
      }
    } catch (error) {
      console.error(`[Lookup:${requestId}] Cache lookup exception:`, error);
    }
  } else {
    console.log(`[Lookup:${requestId}] No Supabase client, skipping cache`);
  }

  try {
    console.log(`[Lookup:${requestId}] Calling Places API Text Search...`);
    const apiStartTime = Date.now();
    const result = await findPlaceByTextSearch(address, apiKey, requestId);
    const apiTime = Date.now() - apiStartTime;

    console.log(`[Lookup:${requestId}] Places API completed (${apiTime}ms)`);
    console.log(`[Lookup:${requestId}] Result - locationName: "${result.locationName}", formattedAddress: "${result.formattedAddress}"`);

    if (supabaseClient && result.locationName !== null) {
      const cacheWriteStart = Date.now();
      try {
        console.log(`[Lookup:${requestId}] Writing to cache (locationName is valid)...`);
        const { error: cacheWriteError } = await supabaseClient
          .from('location_cache')
          .upsert({
            address: normalizedAddress,
            location_name: result.locationName,
            formatted_address: result.formattedAddress
          }, {
            onConflict: 'address',
            ignoreDuplicates: false
          });

        const cacheWriteTime = Date.now() - cacheWriteStart;

        if (cacheWriteError) {
          console.error(`[Lookup:${requestId}] Failed to write to cache (${cacheWriteTime}ms):`, cacheWriteError.message);
        } else {
          console.log(`[Lookup:${requestId}] ✓ Successfully cached result (${cacheWriteTime}ms)`);
        }
      } catch (error) {
        console.error(`[Lookup:${requestId}] Cache write exception:`, error);
      }
    } else if (supabaseClient && result.locationName === null) {
      console.log(`[Lookup:${requestId}] ⚠ NOT caching - locationName is null`);
    }

    const totalTime = Date.now() - startTime;
    console.log(`[Lookup:${requestId}] ========== END (${totalTime}ms) ==========`);
    return result;
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`[Lookup:${requestId}] ========== ERROR (${totalTime}ms) ==========`);
    console.error(`[Lookup:${requestId}] Exception:`, error);
    if (error instanceof Error) {
      console.error(`[Lookup:${requestId}] Error message: ${error.message}`);
      console.error(`[Lookup:${requestId}] Error stack:`, error.stack);
    }
    return { locationName: null, formattedAddress: null };
  }
};
const TEAMSNAP_API_URL = 'https://api.teamsnap.com/v3';

export interface TeamSnapLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  fullAddress: string;
}

interface TeamSnapLocationAPIResponse {
  id?: string | number;
  name?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  [key: string]: any;
}

const parseTeamSnapLocationResponse = (responseData: any): TeamSnapLocation | null => {
  let locationData: TeamSnapLocationAPIResponse = {};

  if (responseData.collection && responseData.collection.items && responseData.collection.items.length > 0) {
    const item = responseData.collection.items[0];

    if (item.data && Array.isArray(item.data)) {
      item.data.forEach((field: any) => {
        if (field.name && field.value !== undefined) {
          locationData[field.name] = field.value;
        }
      });
    } else {
      locationData = item;
    }
  } else if (responseData.data && Array.isArray(responseData.data)) {
    responseData.data.forEach((field: any) => {
      if (field.name && field.value !== undefined) {
        locationData[field.name] = field.value;
      }
    });
  } else if (responseData.id || responseData.name) {
    locationData = responseData;
  } else {
    return null;
  }

  const id = locationData.id?.toString() || '';
  const name = locationData.name || '';
  const address = locationData.address || '';
  const city = locationData.city || '';
  const state = locationData.state || '';
  const postalCode = locationData.postal_code || '';
  const country = locationData.country || '';

  const addressParts: string[] = [];
  if (address) addressParts.push(address);
  if (city) addressParts.push(city);
  if (state && postalCode) {
    addressParts.push(`${state} ${postalCode}`);
  } else if (state) {
    addressParts.push(state);
  } else if (postalCode) {
    addressParts.push(postalCode);
  }
  if (country) addressParts.push(country);

  const fullAddress = addressParts.join(', ');

  return {
    id,
    name,
    address,
    city,
    state,
    postalCode,
    country,
    fullAddress
  };
};

export const fetchTeamSnapLocation = async (
  locationId: string | number,
  accessToken: string,
  requestId: string
): Promise<TeamSnapLocation | null> => {
  try {
    const url = `${TEAMSNAP_API_URL}/locations/${locationId}`;
    console.log(`[TeamSnap Location:${requestId}] Fetching location ${locationId} from: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`[TeamSnap Location:${requestId}] Location ${locationId} not found (404)`);
        return null;
      }

      console.error(`[TeamSnap Location:${requestId}] API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    console.log(`[TeamSnap Location:${requestId}] Raw API response:`, JSON.stringify(data, null, 2));

    const location = parseTeamSnapLocationResponse(data);

    if (location && location.fullAddress) {
      console.log(`[TeamSnap Location:${requestId}] ✓ Parsed location: "${location.name}" at "${location.fullAddress}"`);
    } else if (location && location.name) {
      console.log(`[TeamSnap Location:${requestId}] ⚠ Parsed location name but no address: "${location.name}"`);
    } else {
      console.log(`[TeamSnap Location:${requestId}] ✗ Failed to parse location data`);
    }

    return location;
  } catch (error) {
    console.error(`[TeamSnap Location:${requestId}] Exception:`, error);
    return null;
  }
};

export const fetchMultipleTeamSnapLocations = async (
  locationIds: (string | number)[],
  accessToken: string,
  requestId: string
): Promise<Map<string, TeamSnapLocation>> => {
  const locationMap = new Map<string, TeamSnapLocation>();

  if (locationIds.length === 0) {
    console.log(`[TeamSnap Locations:${requestId}] No location IDs to fetch`);
    return locationMap;
  }

  const uniqueLocationIds = [...new Set(locationIds.map(id => id.toString()))];
  console.log(`[TeamSnap Locations:${requestId}] Fetching ${uniqueLocationIds.length} unique locations`);

  const fetchPromises = uniqueLocationIds.map(async (locationId) => {
    const location = await fetchTeamSnapLocation(locationId, accessToken, requestId);
    if (location) {
      locationMap.set(locationId, location);
    }
  });

  await Promise.all(fetchPromises);

  console.log(`[TeamSnap Locations:${requestId}] Successfully fetched ${locationMap.size}/${uniqueLocationIds.length} locations`);

  return locationMap;
};

export const getOrFetchLocationFromCache = async (
  locationId: string | number,
  accessToken: string,
  supabaseClient: any,
  requestId: string
): Promise<{ fullAddress: string; locationName: string } | null> => {
  const location = await fetchTeamSnapLocation(locationId, accessToken, requestId);

  if (!location) {
    return null;
  }

  if (!location.fullAddress) {
    console.log(`[TeamSnap Location Cache:${requestId}] No address for location ${locationId}, returning name only`);
    return {
      fullAddress: '',
      locationName: location.name
    };
  }

  const normalizedAddress = location.fullAddress.trim().toLowerCase();

  try {
    const { data: cachedResult, error: cacheError } = await supabaseClient
      .from('location_cache')
      .select('location_name, formatted_address')
      .eq('address', normalizedAddress)
      .maybeSingle();

    if (!cacheError && cachedResult) {
      console.log(`[TeamSnap Location Cache:${requestId}] ✓ Cache hit for "${location.fullAddress}"`);
      return {
        fullAddress: location.fullAddress,
        locationName: cachedResult.location_name || location.name
      };
    }

    console.log(`[TeamSnap Location Cache:${requestId}] Cache miss, storing new entry`);

    await supabaseClient
      .from('location_cache')
      .upsert({
        address: normalizedAddress,
        location_name: location.name,
        formatted_address: location.fullAddress
      }, {
        onConflict: 'address',
        ignoreDuplicates: false
      });

    console.log(`[TeamSnap Location Cache:${requestId}] ✓ Cached location: "${location.name}" at "${location.fullAddress}"`);

    return {
      fullAddress: location.fullAddress,
      locationName: location.name
    };
  } catch (error) {
    console.error(`[TeamSnap Location Cache:${requestId}] Cache error:`, error);
    return {
      fullAddress: location.fullAddress,
      locationName: location.name
    };
  }
};

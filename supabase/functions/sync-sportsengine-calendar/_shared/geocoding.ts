export interface GeocodeResult {
  locationName: string | null;
  formattedAddress: string | null;
}

export const geocodeAddress = async (
  address: string,
  apiKey: string,
  supabaseClient?: any
): Promise<GeocodeResult> => {
  if (!address || address.trim() === '') {
    return { locationName: null, formattedAddress: null };
  }

  const normalizedAddress = address.trim().toLowerCase();

  if (supabaseClient) {
    try {
      const { data: cachedResult } = await supabaseClient
        .from('location_cache')
        .select('location_name, formatted_address')
        .eq('address', normalizedAddress)
        .maybeSingle();

      if (cachedResult) {
        console.log('[Geocoding] Cache hit for:', normalizedAddress);
        return {
          locationName: cachedResult.location_name,
          formattedAddress: cachedResult.formatted_address
        };
      }
    } catch (error) {
      console.warn('[Geocoding] Cache lookup failed:', error);
    }
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

      const geocodeResult = {
        locationName,
        formattedAddress: result.formatted_address
      };

      if (supabaseClient) {
        try {
          await supabaseClient
            .from('location_cache')
            .upsert({
              address: normalizedAddress,
              location_name: geocodeResult.locationName,
              formatted_address: geocodeResult.formattedAddress
            }, {
              onConflict: 'address',
              ignoreDuplicates: false
            });
          console.log('[Geocoding] Cached result for:', normalizedAddress);
        } catch (error) {
          console.warn('[Geocoding] Failed to cache result:', error);
        }
      }

      return geocodeResult;
    }

    console.log('[Geocoding] No results for:', address, 'Status:', data.status);
    return { locationName: null, formattedAddress: null };
  } catch (error) {
    console.error('[Geocoding] Error:', error);
    return { locationName: null, formattedAddress: null };
  }
};

interface GeocodeResult {
  locationName: string | null;
  formattedAddress: string | null;
}

interface GeocodeCache {
  [address: string]: GeocodeResult;
}

let geocodeCache: GeocodeCache = {};

export const clearGeocodeCache = () => {
  geocodeCache = {};
};

export const geocodeAddress = async (address: string): Promise<GeocodeResult> => {
  if (!address || address.trim() === '') {
    return { locationName: null, formattedAddress: null };
  }

  const normalizedAddress = address.trim().toLowerCase();

  if (geocodeCache[normalizedAddress]) {
    console.log('[Geocoding] Cache hit for:', normalizedAddress);
    return geocodeCache[normalizedAddress];
  }

  try {
    const geocoder = new google.maps.Geocoder();

    const result = await new Promise<google.maps.GeocoderResult | null>((resolve, reject) => {
      geocoder.geocode({ address }, (results, status) => {
        if (status === google.maps.GeocoderStatus.OK && results && results.length > 0) {
          resolve(results[0]);
        } else if (status === google.maps.GeocoderStatus.ZERO_RESULTS) {
          resolve(null);
        } else {
          reject(new Error(`Geocoding failed: ${status}`));
        }
      });
    });

    if (!result) {
      console.log('[Geocoding] No results for:', address);
      const emptyResult = { locationName: null, formattedAddress: null };
      geocodeCache[normalizedAddress] = emptyResult;
      return emptyResult;
    }

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

    const geocodeResult: GeocodeResult = {
      locationName,
      formattedAddress: result.formatted_address
    };

    geocodeCache[normalizedAddress] = geocodeResult;
    console.log('[Geocoding] Cached result for:', normalizedAddress, geocodeResult);

    return geocodeResult;

  } catch (error) {
    console.error('[Geocoding] Error geocoding address:', address, error);
    return { locationName: null, formattedAddress: null };
  }
};

export const getLocationNameFromPlace = (place: google.maps.places.PlaceResult): string | null => {
  if (place.name && place.name !== place.formatted_address) {
    return place.name;
  }

  if (place.address_components) {
    for (const component of place.address_components) {
      if (component.types.includes('establishment') ||
          component.types.includes('point_of_interest') ||
          component.types.includes('premise')) {
        return component.long_name;
      }
    }
  }

  return null;
};

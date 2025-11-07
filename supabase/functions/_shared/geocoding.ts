POST https://places.googleapis.com/v1/places:searchText
{
  "textQuery": "place at 1125 s spring st, port washington, wi 53074",
  "locationRestriction": {
    "circle": {
      "center": {
        "latitude": [LATITUDE_FROM_GEOCODE],
        "longitude": [LONGITUDE_FROM_GEOCODE]
      },
      "radius": 50.0 // Meters
    }
  }
  // Other fields...
}
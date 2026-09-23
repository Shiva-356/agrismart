package com.agrismart.weather.location;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Transport record representing a single geocoding candidate returned by the Open-Meteo Geocoding API.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record OpenMeteoGeocodingResult(
        Long id,
        String name,
        Double latitude,
        Double longitude,
        String country,
        String admin1
) {}

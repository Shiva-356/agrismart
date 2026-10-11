package com.agrismart.weather.location;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.util.List;

/**
 * Transport response returned by Open-Meteo Geocoding API:
 * GET /v1/search?name={query}&count=1&language=en&format=json
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record OpenMeteoGeocodingResponse(
        List<OpenMeteoGeocodingResult> results
) {}

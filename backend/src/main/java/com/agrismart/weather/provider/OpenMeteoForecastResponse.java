package com.agrismart.weather.provider;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Transport response returned by Open-Meteo forecast API:
 * GET /v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,rain,precipitation
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record OpenMeteoForecastResponse(
        Double latitude,
        Double longitude,
        OpenMeteoCurrentWeather current
) {}

package com.agrismart.weather.provider;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Transport record representing the `current` object in the Open-Meteo forecast API response.
 *
 * Adheres strictly to the Open-Meteo documentation:
 * temperature_2m: Air temperature at 2 meters above ground (°C)
 * relative_humidity_2m: Relative humidity at 2 meters above ground (%)
 * rain: Rain from large scale weather systems of the preceding interval (mm)
 * precipitation: Total precipitation (rain, showers, snow) of the preceding interval (mm)
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record OpenMeteoCurrentWeather(
        String time,
        @JsonProperty("temperature_2m") Double temperature2m,
        @JsonProperty("relative_humidity_2m") Double relativeHumidity2m,
        Double rain,
        Double precipitation
) {}

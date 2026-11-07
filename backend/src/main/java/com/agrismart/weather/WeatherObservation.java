package com.agrismart.weather;

import java.time.Instant;

/**
 * Internal weather boundary abstraction for supplying current ambient weather observations.
 *
 * Note: {@code rainfall} represents current/preceding-interval weather precipitation (mm)
 * from the weather station (e.g. Open-Meteo {@code current.rain} / {@code current.precipitation}),
 * NEVER cumulative growing-season crop rainfall.
 */
public record WeatherObservation(
        Double temperature,
        Double humidity,
        Double rainfall,
        Instant observedAt,
        String source
) {
    public boolean hasAmbientMeasurements() {
        return temperature != null && !Double.isNaN(temperature) && !Double.isInfinite(temperature)
                && humidity != null && !Double.isNaN(humidity) && !Double.isInfinite(humidity);
    }

    public boolean hasAllMeasurements() {
        return hasAmbientMeasurements()
                && rainfall != null && !Double.isNaN(rainfall) && !Double.isInfinite(rainfall);
    }
}

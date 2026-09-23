package com.agrismart.weather;

import java.time.Instant;

/**
 * Internal weather boundary abstraction for supplying real weather observations to the recommendation engine.
 *
 * All measurements must be provided by a real WeatherProvider in Phase 4C-2.
 * No default or placeholder values are assumed.
 */
public record WeatherObservation(
        Double temperature,
        Double humidity,
        Double rainfall,
        Instant observedAt,
        String source
) {
    public boolean hasAllMeasurements() {
        return temperature != null && !Double.isNaN(temperature) && !Double.isInfinite(temperature)
                && humidity != null && !Double.isNaN(humidity) && !Double.isInfinite(humidity)
                && rainfall != null && !Double.isNaN(rainfall) && !Double.isInfinite(rainfall);
    }
}

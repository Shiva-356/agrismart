package com.agrismart.dto.recommendation;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.time.Instant;

/**
 * Explicit request payload for generating an ML crop recommendation.
 *
 * Intentionally separates growing-season cumulative rainfall ({@code seasonalRainfallMm})
 * from current/hourly weather station precipitation ({@code rainfall} / {@code rainfallMm}).
 * Unknown fields such as hourly {@code rainfall} are ignored so they can never populate
 * {@code seasonalRainfallMm}.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record RecommendationRequest(
        Double temperature,
        Double humidity,
        Double seasonalRainfallMm,
        Instant observedAt,
        String source
) {
    public boolean hasAmbientTemperatureAndHumidity() {
        return temperature != null && !Double.isNaN(temperature) && !Double.isInfinite(temperature)
                && humidity != null && !Double.isNaN(humidity) && !Double.isInfinite(humidity);
    }
}

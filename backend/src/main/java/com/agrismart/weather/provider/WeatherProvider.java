package com.agrismart.weather.provider;

import com.agrismart.weather.WeatherObservation;
import com.agrismart.weather.location.ResolvedLocation;

/**
 * Clean abstraction for retrieving current weather observations from an external weather service.
 *
 * Implements dependency inversion: RecommendationService does not depend on vendor-specific HTTP calls.
 */
public interface WeatherProvider {

    /**
     * Retrieves the current real weather observation for the resolved geographic coordinates.
     *
     * @param location the resolved geographic coordinates
     * @return WeatherObservation containing valid temperature, humidity, rainfall, observation timestamp, and source
     * @throws com.agrismart.exception.WeatherServiceException if the provider is unreachable, returns an error,
     *         or produces incomplete or invalid data
     */
    WeatherObservation getCurrentWeather(ResolvedLocation location);

    /**
     * The name or identifier of this weather provider.
     */
    String getProviderName();
}

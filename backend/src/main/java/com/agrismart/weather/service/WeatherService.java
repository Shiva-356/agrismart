package com.agrismart.weather.service;

import com.agrismart.entity.Farm;
import com.agrismart.weather.WeatherObservation;

/**
 * Service orchestrating location resolution and real weather observation retrieval for a farm.
 *
 * Implements dependency inversion allowing weather providers and location resolvers to be easily substituted.
 */
public interface WeatherService {

    /**
     * Resolves the farm's physical coordinates and fetches real weather observations.
     *
     * @param farm the farm entity
     * @return genuine WeatherObservation with validated temperature, humidity, and rainfall
     * @throws com.agrismart.exception.RecommendationPrerequisiteException if location cannot be resolved
     * @throws com.agrismart.exception.WeatherServiceException if weather is unavailable or malformed
     */
    WeatherObservation getWeatherForFarm(Farm farm);
}

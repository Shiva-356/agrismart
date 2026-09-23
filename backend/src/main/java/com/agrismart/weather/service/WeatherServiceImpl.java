package com.agrismart.weather.service;

import com.agrismart.entity.Farm;
import com.agrismart.weather.WeatherObservation;
import com.agrismart.weather.location.LocationResolver;
import com.agrismart.weather.location.ResolvedLocation;
import com.agrismart.weather.provider.WeatherProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Default implementation of WeatherService.
 *
 * Coordinates LocationResolver and WeatherProvider without hardcoding vendor URLs or coordinates.
 */
@Service
public class WeatherServiceImpl implements WeatherService {

    private static final Logger log = LoggerFactory.getLogger(WeatherServiceImpl.class);

    private final LocationResolver locationResolver;
    private final WeatherProvider weatherProvider;

    public WeatherServiceImpl(LocationResolver locationResolver, WeatherProvider weatherProvider) {
        this.locationResolver = locationResolver;
        this.weatherProvider = weatherProvider;
    }

    @Override
    public WeatherObservation getWeatherForFarm(Farm farm) {
        if (farm == null) {
            throw new IllegalArgumentException("Farm cannot be null");
        }

        // 1. Resolve textual location to geographic coordinates
        ResolvedLocation resolvedLocation = locationResolver.resolve(farm);

        // 2. Fetch real weather observation for resolved location
        WeatherObservation weather = weatherProvider.getCurrentWeather(resolvedLocation);

        log.debug("Weather successfully acquired for farm {} at ({}, {}) from {}",
                farm.getId(), resolvedLocation.latitude(), resolvedLocation.longitude(), weather.source());

        return weather;
    }
}

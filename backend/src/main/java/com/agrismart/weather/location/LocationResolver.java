package com.agrismart.weather.location;

import com.agrismart.entity.Farm;

/**
 * Strategy interface for resolving physical geographic coordinates (latitude, longitude)
 * from a Farm's textual location and district metadata.
 *
 * Never falls back to hardcoded default coordinates or fake locations.
 */
public interface LocationResolver {

    /**
     * Resolves real geographic coordinates for the given farm.
     *
     * @param farm the farm entity containing textual location and district
     * @return the resolved location with latitude and longitude
     * @throws com.agrismart.exception.RecommendationPrerequisiteException with code "WEATHER_LOCATION_UNRESOLVED"
     *         if coordinates cannot be determined reliably
     */
    ResolvedLocation resolve(Farm farm);
}

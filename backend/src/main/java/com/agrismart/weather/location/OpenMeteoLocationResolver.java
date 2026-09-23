package com.agrismart.weather.location;

import com.agrismart.entity.Farm;
import com.agrismart.exception.RecommendationPrerequisiteException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Optional;

/**
 * Concrete LocationResolver leveraging the documented Open-Meteo Geocoding API.
 *
 * Resolves farm textual metadata (location and district) to verified geographic coordinates.
 * Strictly avoids hardcoded coordinates or fabricated default locations.
 */
@Component
public class OpenMeteoLocationResolver implements LocationResolver {

    private static final Logger log = LoggerFactory.getLogger(OpenMeteoLocationResolver.class);

    private final RestClient geocodingRestClient;
    private final String apiKey;

    public OpenMeteoLocationResolver(
            RestClient geocodingRestClient,
            @Value("${agrismart.weather.api-key:}") String apiKey
    ) {
        this.geocodingRestClient = geocodingRestClient;
        this.apiKey = apiKey != null ? apiKey.trim() : "";
    }

    @Override
    public ResolvedLocation resolve(Farm farm) {
        if (farm == null) {
            throw new IllegalArgumentException("Farm cannot be null");
        }

        String location = farm.getLocation() != null ? farm.getLocation().trim() : "";
        String district = farm.getDistrict() != null ? farm.getDistrict().trim() : "";

        if (location.isEmpty() && district.isEmpty()) {
            log.warn("Farm {} has empty location and district fields", farm.getId());
            throw new RecommendationPrerequisiteException(
                    "WEATHER_LOCATION_UNRESOLVED",
                    "Farm has no textual location or district specified"
            );
        }

        // Attempt 1: Combined location and district (e.g. "Warangal Rural, Warangal")
        if (!location.isEmpty() && !district.isEmpty()) {
            String combinedQuery = location + ", " + district;
            Optional<ResolvedLocation> resolved = executeGeocode(combinedQuery);
            if (resolved.isPresent()) {
                log.info("Resolved farm {} location using combined query '{}': ({}, {})",
                        farm.getId(), combinedQuery, resolved.get().latitude(), resolved.get().longitude());
                return resolved.get();
            }

            // Attempt 2: District-level administrative boundary (e.g. "Warangal")
            log.debug("Combined query '{}' returned no geocoding results, trying district '{}'", combinedQuery, district);
            Optional<ResolvedLocation> districtResolved = executeGeocode(district);
            if (districtResolved.isPresent()) {
                log.info("Resolved farm {} location using district query '{}': ({}, {})",
                        farm.getId(), district, districtResolved.get().latitude(), districtResolved.get().longitude());
                return districtResolved.get();
            }
        } else if (!district.isEmpty()) {
            Optional<ResolvedLocation> districtResolved = executeGeocode(district);
            if (districtResolved.isPresent()) {
                return districtResolved.get();
            }
        } else {
            Optional<ResolvedLocation> locationResolved = executeGeocode(location);
            if (locationResolved.isPresent()) {
                return locationResolved.get();
            }
        }

        log.warn("Failed to resolve coordinates for farm {} (location: '{}', district: '{}')",
                farm.getId(), location, district);
        throw new RecommendationPrerequisiteException(
                "WEATHER_LOCATION_UNRESOLVED",
                "Geographic coordinates could not be resolved for farm location '" + location + "' and district '" + district + "'"
        );
    }

    private Optional<ResolvedLocation> executeGeocode(String query) {
        try {
            OpenMeteoGeocodingResponse response = geocodingRestClient.get()
                    .uri(uriBuilder -> {
                        var builder = uriBuilder.path("/v1/search")
                                .queryParam("name", query)
                                .queryParam("count", 1)
                                .queryParam("language", "en")
                                .queryParam("format", "json");
                        if (!apiKey.isEmpty()) {
                            builder.queryParam("apikey", apiKey);
                        }
                        return builder.build();
                    })
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .body(OpenMeteoGeocodingResponse.class);

            if (response == null || response.results() == null || response.results().isEmpty()) {
                return Optional.empty();
            }

            OpenMeteoGeocodingResult topResult = response.results().get(0);
            if (topResult.latitude() == null || topResult.longitude() == null) {
                return Optional.empty();
            }

            String displayName = buildDisplayName(topResult);
            return Optional.of(new ResolvedLocation(
                    topResult.latitude(),
                    topResult.longitude(),
                    displayName,
                    query
            ));
        } catch (Exception e) {
            log.error("Geocoding query '{}' failed: {}", query, e.getMessage());
            return Optional.empty();
        }
    }

    private String buildDisplayName(OpenMeteoGeocodingResult result) {
        StringBuilder sb = new StringBuilder();
        if (result.name() != null) {
            sb.append(result.name());
        }
        if (result.admin1() != null && !result.admin1().isBlank()) {
            if (sb.length() > 0) sb.append(", ");
            sb.append(result.admin1());
        }
        if (result.country() != null && !result.country().isBlank()) {
            if (sb.length() > 0) sb.append(", ");
            sb.append(result.country());
        }
        return sb.length() > 0 ? sb.toString() : "Resolved Location";
    }
}

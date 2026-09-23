package com.agrismart.weather.provider;

import com.agrismart.exception.WeatherServiceException;
import com.agrismart.weather.WeatherObservation;
import com.agrismart.weather.location.ResolvedLocation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

/**
 * Concrete WeatherProvider connecting to the documented Open-Meteo weather API.
 *
 * Implements strict numerical and measurement validation:
 * - Air temperature (°C) must be present and finite.
 * - Relative humidity (%) must be present and finite.
 * - Rainfall (mm) must be present and finite.
 * - Missing rainfall is never silently replaced with 0.0.
 * - Provider errors and unavailable states are propagated explicitly.
 */
@Component
public class OpenMeteoWeatherProvider implements WeatherProvider {

    private static final Logger log = LoggerFactory.getLogger(OpenMeteoWeatherProvider.class);

    private final RestClient weatherRestClient;
    private final String apiKey;

    public OpenMeteoWeatherProvider(
            RestClient weatherRestClient,
            @Value("${agrismart.weather.api-key:}") String apiKey
    ) {
        this.weatherRestClient = weatherRestClient;
        this.apiKey = apiKey != null ? apiKey.trim() : "";
    }

    @Override
    public String getProviderName() {
        return "Open-Meteo";
    }

    @Override
    public WeatherObservation getCurrentWeather(ResolvedLocation location) {
        if (location == null) {
            throw new IllegalArgumentException("ResolvedLocation cannot be null");
        }

        try {
            OpenMeteoForecastResponse response = weatherRestClient.get()
                    .uri(uriBuilder -> {
                        var builder = uriBuilder.path("/v1/forecast")
                                .queryParam("latitude", location.latitude())
                                .queryParam("longitude", location.longitude())
                                .queryParam("current", "temperature_2m,relative_humidity_2m,rain,precipitation");
                        if (!apiKey.isEmpty()) {
                            builder.queryParam("apikey", apiKey);
                        }
                        return builder.build();
                    })
                    .accept(MediaType.APPLICATION_JSON)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, resp) -> {
                        String body = "";
                        try {
                            body = new String(resp.getBody().readAllBytes(), StandardCharsets.UTF_8);
                        } catch (Exception ignored) {
                        }
                        log.error("Weather provider returned error {}: {}", resp.getStatusCode(), body);

                        if (resp.getStatusCode().value() == 503) {
                            throw new WeatherServiceException(
                                    "WEATHER_DATA_UNAVAILABLE",
                                    "Weather service currently unavailable (503): " + body
                            );
                        }
                        throw new WeatherServiceException(
                                "WEATHER_SERVICE_INVALID_RESPONSE",
                                "Weather service error " + resp.getStatusCode() + ": " + body
                        );
                    })
                    .body(OpenMeteoForecastResponse.class);

            if (response == null || response.current() == null) {
                log.error("Weather provider response or current block is null for coordinates ({}, {})",
                        location.latitude(), location.longitude());
                throw new WeatherServiceException(
                        "WEATHER_SERVICE_INVALID_RESPONSE",
                        "Weather provider response contains no current weather measurements"
                );
            }

            OpenMeteoCurrentWeather current = response.current();

            // 1. Temperature validation
            Double temperature = current.temperature2m();
            if (temperature == null || Double.isNaN(temperature) || Double.isInfinite(temperature)) {
                log.warn("Weather provider returned invalid or missing temperature: {}", temperature);
                throw new WeatherServiceException(
                        "WEATHER_DATA_UNAVAILABLE",
                        "Weather provider response is missing valid temperature measurement"
                );
            }

            // 2. Relative Humidity validation
            Double humidity = current.relativeHumidity2m();
            if (humidity == null || Double.isNaN(humidity) || Double.isInfinite(humidity)) {
                log.warn("Weather provider returned invalid or missing humidity: {}", humidity);
                throw new WeatherServiceException(
                        "WEATHER_DATA_UNAVAILABLE",
                        "Weather provider response is missing valid humidity measurement"
                );
            }

            // 3. Rainfall validation (liquid rain or total precipitation)
            Double rainfall = current.rain() != null ? current.rain() : current.precipitation();
            if (rainfall == null || Double.isNaN(rainfall) || Double.isInfinite(rainfall)) {
                log.warn("Weather provider returned invalid or missing rainfall/precipitation (rain={}, precip={})",
                        current.rain(), current.precipitation());
                throw new WeatherServiceException(
                        "WEATHER_DATA_UNAVAILABLE",
                        "Weather provider response is missing valid rainfall measurement"
                );
            }

            Instant observedAt = parseObservationTime(current.time());
            String source = getProviderName() + (location.displayName() != null && !location.displayName().isBlank()
                    ? " (" + location.displayName() + ")"
                    : "");

            return new WeatherObservation(
                    temperature,
                    humidity,
                    rainfall,
                    observedAt,
                    source
            );
        } catch (WeatherServiceException e) {
            throw e;
        } catch (ResourceAccessException e) {
            log.error("Unable to connect to weather provider at coordinates ({}, {}): {}",
                    location.latitude(), location.longitude(), e.getMessage());
            throw new WeatherServiceException(
                    "WEATHER_DATA_UNAVAILABLE",
                    "Unable to connect to weather provider: " + e.getMessage(),
                    e
            );
        } catch (RestClientException e) {
            log.error("REST client error querying weather provider: {}", e.getMessage());
            throw new WeatherServiceException(
                    "WEATHER_SERVICE_INVALID_RESPONSE",
                    "Error communicating with weather provider: " + e.getMessage(),
                    e
            );
        } catch (Exception e) {
            log.error("Unexpected failure querying weather provider: {}", e.getMessage());
            throw new WeatherServiceException(
                    "WEATHER_DATA_UNAVAILABLE",
                    "Unexpected failure querying weather provider: " + e.getMessage(),
                    e
            );
        }
    }

    private Instant parseObservationTime(String timeStr) {
        if (timeStr == null || timeStr.isBlank()) {
            return Instant.now();
        }
        try {
            if (timeStr.endsWith("Z") || timeStr.contains("+") || (timeStr.length() > 19 && timeStr.charAt(19) == '-')) {
                return Instant.parse(timeStr);
            }
            return LocalDateTime.parse(timeStr, DateTimeFormatter.ISO_LOCAL_DATE_TIME).toInstant(ZoneOffset.UTC);
        } catch (Exception e) {
            log.debug("Could not parse weather observation time '{}', using current instant", timeStr);
            return Instant.now();
        }
    }
}

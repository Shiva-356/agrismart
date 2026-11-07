package com.agrismart.service;

import com.agrismart.dto.recommendation.RecommendationRequest;
import com.agrismart.dto.recommendation.RecommendationResponse;
import com.agrismart.entity.Farm;
import com.agrismart.entity.SoilReport;
import com.agrismart.exception.MlServiceException;
import com.agrismart.exception.RecommendationPrerequisiteException;
import com.agrismart.exception.ResourceNotFoundException;
import com.agrismart.ml.client.MlPredictionClient;
import com.agrismart.ml.dto.MlPredictionRequest;
import com.agrismart.ml.dto.MlPredictionResponse;
import com.agrismart.repository.FarmRepository;
import com.agrismart.repository.SoilReportRepository;
import com.agrismart.weather.WeatherObservation;
import com.agrismart.weather.service.WeatherService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * Service orchestrating verified soil report retrieval, ambient weather validation,
 * explicit growing-season rainfall validation, and ML-powered crop recommendation.
 *
 * Enforces strict production data integrity:
 * - The soil report MUST be verified by a laboratory/authority.
 * - All four soil chemical features (N, P, K, pH) MUST be genuinely present and within model bounds.
 * - Ambient temperature and relative humidity MUST be genuinely present and within model bounds.
 * - Growing-season cumulative rainfall ({@code seasonalRainfallMm}) MUST be explicitly provided and within [0, 1000] mm;
 *   current/hourly weather precipitation ({@code WeatherObservation.rainfall()}) is NEVER substituted.
 * - Genuine zero seasonal rainfall ({@code 0.0}) is preserved and distinguished from missing ({@code null}).
 * - Never fabricates crop recommendations or misreports input validation errors as ML service outages.
 */
@Service
@Transactional(readOnly = true)
public class RecommendationService {

    private static final Logger log = LoggerFactory.getLogger(RecommendationService.class);

    private final FarmRepository farmRepository;
    private final SoilReportRepository soilReportRepository;
    private final MlPredictionClient mlPredictionClient;
    private final WeatherService weatherService;

    public RecommendationService(
            FarmRepository farmRepository,
            SoilReportRepository soilReportRepository,
            MlPredictionClient mlPredictionClient,
            WeatherService weatherService
    ) {
        this.farmRepository = farmRepository;
        this.soilReportRepository = soilReportRepository;
        this.mlPredictionClient = mlPredictionClient;
        this.weatherService = weatherService;
    }

    /**
     * Overload without explicit seasonal rainfall.
     * Deliberately passes {@code null} for {@code seasonalRainfallMm} so that hourly weather station
     * precipitation is never silently substituted for growing-season rainfall.
     */
    public RecommendationResponse recommend(UUID farmId) {
        return recommend(farmId, (Double) null);
    }

    /**
     * Generates a crop recommendation using the farm's latest verified laboratory soil report,
     * live ambient temperature & humidity for the farm's resolved location, and an explicit
     * growing-season cumulative rainfall value.
     *
     * @param farmId             the farm identifier
     * @param seasonalRainfallMm growing-season cumulative rainfall in mm ({@code null} if unknown; {@code 0.0} is valid)
     * @return the crop recommendation response with ranked predictions and feature traceability
     */
    public RecommendationResponse recommend(UUID farmId, Double seasonalRainfallMm) {
        if (farmId == null) {
            throw new IllegalArgumentException("Farm ID cannot be null");
        }

        Farm farm = farmRepository.findById(farmId)
                .orElseThrow(() -> new ResourceNotFoundException("Farm not found with ID: " + farmId));

        if (weatherService == null) {
            throw new IllegalStateException("WeatherService is not configured");
        }
        WeatherObservation weather = weatherService.getWeatherForFarm(farm);

        return recommend(farm, weather, seasonalRainfallMm);
    }

    /**
     * Generates a crop recommendation using an explicit request DTO containing optional ambient
     * weather overrides and required {@code seasonalRainfallMm}.
     */
    public RecommendationResponse recommend(UUID farmId, RecommendationRequest request) {
        if (farmId == null) {
            throw new IllegalArgumentException("Farm ID cannot be null");
        }

        Farm farm = farmRepository.findById(farmId)
                .orElseThrow(() -> new ResourceNotFoundException("Farm not found with ID: " + farmId));

        WeatherObservation effectiveWeather;
        if (request != null && request.temperature() != null && request.humidity() != null) {
            effectiveWeather = new WeatherObservation(
                    request.temperature(),
                    request.humidity(),
                    null,
                    request.observedAt() != null ? request.observedAt() : Instant.now(),
                    request.source() != null && !request.source().isBlank() ? request.source() : "Explicit Request"
            );
        } else {
            if (weatherService == null) {
                throw new IllegalStateException("WeatherService is not configured");
            }
            WeatherObservation liveWeather = weatherService.getWeatherForFarm(farm);
            if (request == null) {
                effectiveWeather = liveWeather;
            } else {
                effectiveWeather = new WeatherObservation(
                        request.temperature() != null ? request.temperature() : (liveWeather != null ? liveWeather.temperature() : null),
                        request.humidity() != null ? request.humidity() : (liveWeather != null ? liveWeather.humidity() : null),
                        liveWeather != null ? liveWeather.rainfall() : null,
                        request.observedAt() != null ? request.observedAt() : (liveWeather != null ? liveWeather.observedAt() : Instant.now()),
                        request.source() != null && !request.source().isBlank()
                                ? request.source()
                                : (liveWeather != null ? liveWeather.source() : null)
                );
            }
        }

        Double seasonalRainfallMm = request != null ? request.seasonalRainfallMm() : null;
        return recommend(farm, effectiveWeather, seasonalRainfallMm);
    }

    /**
     * Generates a crop recommendation using the farm's latest verified soil report,
     * ambient temperature/humidity from {@code weather}, and explicit {@code seasonalRainfallMm}.
     * Hourly {@code weather.rainfall()} is never read or forwarded to the ML model.
     */
    public RecommendationResponse recommend(UUID farmId, WeatherObservation weather, Double seasonalRainfallMm) {
        if (farmId == null) {
            throw new IllegalArgumentException("Farm ID cannot be null");
        }

        Farm farm = farmRepository.findById(farmId)
                .orElseThrow(() -> new ResourceNotFoundException("Farm not found with ID: " + farmId));

        return recommend(farm, weather, seasonalRainfallMm);
    }

    private RecommendationResponse recommend(Farm farm, WeatherObservation weather, Double seasonalRainfallMm) {
        UUID farmId = farm.getId();

        // 1. Find latest VERIFIED SoilReport for that farm
        SoilReport soilReport = soilReportRepository
                .findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(farmId)
                .orElseThrow(() -> new RecommendationPrerequisiteException(
                        "NO_VERIFIED_SOIL_REPORT",
                        "No verified laboratory soil report found for farm ID: " + farmId
                ));

        // 2. Reject if soil features (N, P, K, pH) are missing or non-finite
        if (soilReport.getNitrogen() == null) {
            throw new RecommendationPrerequisiteException(
                    "SOIL_FEATURES_INCOMPLETE",
                    "Verified soil report " + soilReport.getId() + " is missing nitrogen (N) measurement"
            );
        }
        if (soilReport.getPhosphorus() == null) {
            throw new RecommendationPrerequisiteException(
                    "SOIL_FEATURES_INCOMPLETE",
                    "Verified soil report " + soilReport.getId() + " is missing phosphorus (P) measurement"
            );
        }
        if (soilReport.getPotassium() == null) {
            throw new RecommendationPrerequisiteException(
                    "SOIL_FEATURES_INCOMPLETE",
                    "Verified soil report " + soilReport.getId() + " is missing potassium (K) measurement"
            );
        }
        if (soilReport.getPh() == null) {
            throw new RecommendationPrerequisiteException(
                    "SOIL_FEATURES_INCOMPLETE",
                    "Verified soil report " + soilReport.getId() + " is missing pH measurement"
            );
        }

        // 3. Validate ambient weather observation has temperature and humidity
        // Note: weather.rainfall() is current/hourly interval precipitation and is NEVER read here.
        if (weather == null) {
            throw new RecommendationPrerequisiteException(
                    "WEATHER_FEATURES_INCOMPLETE",
                    "Weather observation is required for crop recommendation"
            );
        }
        if (weather.temperature() == null || Double.isNaN(weather.temperature()) || Double.isInfinite(weather.temperature())) {
            throw new RecommendationPrerequisiteException(
                    "WEATHER_FEATURES_INCOMPLETE",
                    "Weather observation is missing valid temperature measurement"
            );
        }
        if (weather.humidity() == null || Double.isNaN(weather.humidity()) || Double.isInfinite(weather.humidity())) {
            throw new RecommendationPrerequisiteException(
                    "WEATHER_FEATURES_INCOMPLETE",
                    "Weather observation is missing valid humidity measurement"
            );
        }

        // 4. Require explicit growing-season cumulative rainfall (distinguishing null from genuine 0.0)
        if (seasonalRainfallMm == null || Double.isNaN(seasonalRainfallMm) || Double.isInfinite(seasonalRainfallMm)) {
            throw new RecommendationPrerequisiteException(
                    "SEASONAL_RAINFALL_REQUIRED",
                    "Growing-season rainfall (seasonalRainfallMm) is required for ML crop recommendation; current or hourly weather precipitation cannot be substituted"
            );
        }

        // 5. Construct seven-feature ML request and validate model input bounds before calling ML service
        MlPredictionRequest mlRequest = new MlPredictionRequest(
                soilReport.getNitrogen().doubleValue(),
                soilReport.getPhosphorus().doubleValue(),
                soilReport.getPotassium().doubleValue(),
                weather.temperature(),
                weather.humidity(),
                soilReport.getPh().doubleValue(),
                seasonalRainfallMm
        );

        String boundsError = mlRequest.findFirstOutOfBoundsError();
        if (boundsError != null) {
            throw new RecommendationPrerequisiteException("ML_INPUT_OUT_OF_RANGE", boundsError);
        }

        log.debug("Invoking ML prediction client for farm {} with soil report {}", farmId, soilReport.getId());

        // 6. Invoke ML prediction client
        MlPredictionResponse mlResponse = mlPredictionClient.predict(mlRequest);

        if (mlResponse == null || mlResponse.crop() == null || mlResponse.crop().isBlank()) {
            throw new MlServiceException(
                    "ML_SERVICE_INVALID_RESPONSE",
                    "ML service returned invalid or missing crop recommendation"
            );
        }

        RecommendationResponse.RecommendationInputFeatures inputFeatures =
                new RecommendationResponse.RecommendationInputFeatures(
                        soilReport.getNitrogen().doubleValue(),
                        soilReport.getPhosphorus().doubleValue(),
                        soilReport.getPotassium().doubleValue(),
                        soilReport.getPh().doubleValue(),
                        weather.temperature(),
                        weather.humidity(),
                        seasonalRainfallMm,
                        soilReport.getTestDate(),
                        weather.observedAt(),
                        weather.source()
                );

        return new RecommendationResponse(
                farm.getId(),
                soilReport.getId(),
                mlResponse.crop(),
                mlResponse.rankedCrops(),
                mlResponse.model(),
                inputFeatures,
                Instant.now(),
                mlResponse.note()
        );
    }
}

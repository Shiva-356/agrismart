package com.agrismart.service;

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
 * Service orchestrating verified soil report retrieval, weather validation,
 * and ML-powered crop recommendation.
 *
 * Enforces strict production eligibility:
 * - The soil report MUST be verified by a laboratory/authority.
 * - All four soil chemical features (N, P, K, pH) MUST be genuinely present.
 * - All three weather features (temperature, humidity, rainfall) MUST be provided.
 * - Never fabricates fake crop recommendations if ML inference fails.
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
     * Generates a crop recommendation for the specified farm by resolving its location,
     * fetching genuine real-time weather observations, and combining them with the latest verified
     * laboratory soil report.
     *
     * @param farmId the farm identifier
     * @return the crop recommendation response with ranked predictions and feature traceability
     */
    public RecommendationResponse recommend(UUID farmId) {
        if (farmId == null) {
            throw new IllegalArgumentException("Farm ID cannot be null");
        }

        // 1. Verify farm exists
        Farm farm = farmRepository.findById(farmId)
                .orElseThrow(() -> new ResourceNotFoundException("Farm not found with ID: " + farmId));

        // 2. Fetch real weather for the farm via WeatherService (resolves location + queries provider)
        if (weatherService == null) {
            throw new IllegalStateException("WeatherService is not configured");
        }
        WeatherObservation weather = weatherService.getWeatherForFarm(farm);

        // 3. Delegate to core recommendation logic
        return recommend(farm, weather);
    }

    /**
     * Generates a crop recommendation for the specified farm using its latest verified soil report
     * combined with the provided weather observation.
     *
     * @param farmId the farm identifier
     * @param weather real weather observation (temperature, humidity, rainfall)
     * @return the crop recommendation response with ranked predictions and feature traceability
     */
    public RecommendationResponse recommend(UUID farmId, WeatherObservation weather) {
        if (farmId == null) {
            throw new IllegalArgumentException("Farm ID cannot be null");
        }

        // 1. Verify farm exists
        Farm farm = farmRepository.findById(farmId)
                .orElseThrow(() -> new ResourceNotFoundException("Farm not found with ID: " + farmId));

        return recommend(farm, weather);
    }

    private RecommendationResponse recommend(Farm farm, WeatherObservation weather) {
        UUID farmId = farm.getId();

        // 2. Find latest VERIFIED SoilReport for that farm
        SoilReport soilReport = soilReportRepository
                .findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(farmId)
                .orElseThrow(() -> new RecommendationPrerequisiteException(
                        "NO_VERIFIED_SOIL_REPORT",
                        "No verified laboratory soil report found for farm ID: " + farmId
                ));

        // 3. Reject if soil features (N, P, K, pH) are missing or incomplete
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

        // 4. Validate weather observation has all required features
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
        if (weather.rainfall() == null || Double.isNaN(weather.rainfall()) || Double.isInfinite(weather.rainfall())) {
            throw new RecommendationPrerequisiteException(
                    "WEATHER_FEATURES_INCOMPLETE",
                    "Weather observation is missing valid rainfall measurement"
            );
        }

        // 5. Construct seven-feature ML request
        MlPredictionRequest mlRequest = new MlPredictionRequest(
                soilReport.getNitrogen().doubleValue(),
                soilReport.getPhosphorus().doubleValue(),
                soilReport.getPotassium().doubleValue(),
                weather.temperature(),
                weather.humidity(),
                soilReport.getPh().doubleValue(),
                weather.rainfall()
        );

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
                        weather.rainfall(),
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

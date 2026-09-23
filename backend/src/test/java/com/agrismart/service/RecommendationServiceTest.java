package com.agrismart.service;

import com.agrismart.dto.recommendation.RankedCropResponse;
import com.agrismart.dto.recommendation.RecommendationResponse;
import com.agrismart.entity.Farm;
import com.agrismart.entity.SoilReport;
import com.agrismart.entity.User;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RecommendationServiceTest {

    @Mock
    private FarmRepository farmRepository;

    @Mock
    private SoilReportRepository soilReportRepository;

    @Mock
    private MlPredictionClient mlPredictionClient;

    @Mock
    private WeatherService weatherService;

    @InjectMocks
    private RecommendationService recommendationService;

    private UUID farmId;
    private Farm mockFarm;
    private SoilReport verifiedReport;
    private WeatherObservation validWeather;
    private MlPredictionResponse mockMlResponse;

    @BeforeEach
    void setUp() {
        farmId = UUID.randomUUID();

        User user = new User("Ramesh Patel", "ramesh@example.com", "+91 98765 43210");
        user.setId(UUID.randomUUID());

        mockFarm = new Farm(user, "Plot 1", "Warangal Rural", "Warangal", BigDecimal.valueOf(5.0), "DRIP");
        mockFarm.setId(farmId);

        verifiedReport = new SoilReport(mockFarm, "Telangana State Soil Testing Lab", LocalDate.of(2026, 3, 15));
        verifiedReport.setId(UUID.randomUUID());
        verifiedReport.setVerified(true);
        verifiedReport.setNitrogen(BigDecimal.valueOf(90.0));
        verifiedReport.setPhosphorus(BigDecimal.valueOf(42.0));
        verifiedReport.setPotassium(BigDecimal.valueOf(43.0));
        verifiedReport.setPh(BigDecimal.valueOf(6.5));

        validWeather = new WeatherObservation(
                26.5,
                78.0,
                185.0,
                Instant.now(),
                "IMD_WARANGAL_STATION"
        );

        mockMlResponse = new MlPredictionResponse(
                "rice",
                List.of(
                        new RankedCropResponse("rice", 0.88),
                        new RankedCropResponse("jute", 0.08),
                        new RankedCropResponse("maize", 0.02)
                ),
                "Random Forest",
                List.of("N", "P", "K", "temperature", "humidity", "ph", "rainfall"),
                22,
                "Probability estimate on benchmark dataset"
        );
    }

    @Test
    @DisplayName("Requirement 1: Verified report + complete weather invokes ML client and returns recommendation")
    void verifiedReportAndCompleteWeatherInvokesMlClientAndReturnsRecommendation() {
        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(soilReportRepository.findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(farmId))
                .thenReturn(Optional.of(verifiedReport));
        when(mlPredictionClient.predict(any(MlPredictionRequest.class))).thenReturn(mockMlResponse);

        RecommendationResponse response = recommendationService.recommend(farmId, validWeather);

        assertThat(response).isNotNull();
        assertThat(response.farmId()).isEqualTo(farmId);
        assertThat(response.soilReportId()).isEqualTo(verifiedReport.getId());
        assertThat(response.recommendedCrop()).isEqualTo("rice");
        assertThat(response.rankedCrops()).hasSize(3);
        assertThat(response.modelName()).isEqualTo("Random Forest");

        // Verify the 7 features mapped accurately
        assertThat(response.inputFeatures().nitrogen()).isEqualTo(90.0);
        assertThat(response.inputFeatures().phosphorus()).isEqualTo(42.0);
        assertThat(response.inputFeatures().potassium()).isEqualTo(43.0);
        assertThat(response.inputFeatures().ph()).isEqualTo(6.5);
        assertThat(response.inputFeatures().temperature()).isEqualTo(26.5);
        assertThat(response.inputFeatures().humidity()).isEqualTo(78.0);
        assertThat(response.inputFeatures().rainfall()).isEqualTo(185.0);

        ArgumentCaptor<MlPredictionRequest> captor = ArgumentCaptor.forClass(MlPredictionRequest.class);
        verify(mlPredictionClient).predict(captor.capture());
        MlPredictionRequest sentRequest = captor.getValue();
        assertThat(sentRequest.n()).isEqualTo(90.0);
        assertThat(sentRequest.p()).isEqualTo(42.0);
        assertThat(sentRequest.k()).isEqualTo(43.0);
        assertThat(sentRequest.temperature()).isEqualTo(26.5);
        assertThat(sentRequest.humidity()).isEqualTo(78.0);
        assertThat(sentRequest.ph()).isEqualTo(6.5);
        assertThat(sentRequest.rainfall()).isEqualTo(185.0);
    }

    @Test
    @DisplayName("Requirement 2: No verified report throws RecommendationPrerequisiteException (NO_VERIFIED_SOIL_REPORT)")
    void noVerifiedReportThrowsRecommendationPrerequisiteException() {
        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(soilReportRepository.findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(farmId))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> recommendationService.recommend(farmId, validWeather))
                .isInstanceOf(RecommendationPrerequisiteException.class)
                .satisfies(e -> {
                    RecommendationPrerequisiteException ex = (RecommendationPrerequisiteException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("NO_VERIFIED_SOIL_REPORT");
                    assertThat(ex.getMessage()).contains("No verified laboratory soil report found");
                });

        verify(mlPredictionClient, never()).predict(any());
    }

    @Test
    @DisplayName("Requirement 3: Latest report unverified but older verified report exists uses deterministic verified query")
    void latestReportUnverifiedButOlderVerifiedReportExistsUsesOlderVerifiedReport() {
        // Repository findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc specifically returns the verified one
        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(soilReportRepository.findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(farmId))
                .thenReturn(Optional.of(verifiedReport));
        when(mlPredictionClient.predict(any(MlPredictionRequest.class))).thenReturn(mockMlResponse);

        RecommendationResponse response = recommendationService.recommend(farmId, validWeather);

        assertThat(response).isNotNull();
        assertThat(response.soilReportId()).isEqualTo(verifiedReport.getId());
        verify(mlPredictionClient).predict(any());
    }

    @Test
    @DisplayName("Requirement 4: Nitrogen (N) missing throws SOIL_FEATURES_INCOMPLETE")
    void nitrogenMissingThrowsSoilFeaturesIncomplete() {
        verifiedReport.setNitrogen(null);

        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(soilReportRepository.findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(farmId))
                .thenReturn(Optional.of(verifiedReport));

        assertThatThrownBy(() -> recommendationService.recommend(farmId, validWeather))
                .isInstanceOf(RecommendationPrerequisiteException.class)
                .satisfies(e -> {
                    RecommendationPrerequisiteException ex = (RecommendationPrerequisiteException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("SOIL_FEATURES_INCOMPLETE");
                    assertThat(ex.getMessage()).contains("missing nitrogen (N)");
                });

        verify(mlPredictionClient, never()).predict(any());
    }

    @Test
    @DisplayName("Requirement 5: Phosphorus (P) missing throws SOIL_FEATURES_INCOMPLETE")
    void phosphorusMissingThrowsSoilFeaturesIncomplete() {
        verifiedReport.setPhosphorus(null);

        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(soilReportRepository.findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(farmId))
                .thenReturn(Optional.of(verifiedReport));

        assertThatThrownBy(() -> recommendationService.recommend(farmId, validWeather))
                .isInstanceOf(RecommendationPrerequisiteException.class)
                .satisfies(e -> {
                    RecommendationPrerequisiteException ex = (RecommendationPrerequisiteException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("SOIL_FEATURES_INCOMPLETE");
                    assertThat(ex.getMessage()).contains("missing phosphorus (P)");
                });

        verify(mlPredictionClient, never()).predict(any());
    }

    @Test
    @DisplayName("Requirement 6: Potassium (K) missing throws SOIL_FEATURES_INCOMPLETE")
    void potassiumMissingThrowsSoilFeaturesIncomplete() {
        verifiedReport.setPotassium(null);

        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(soilReportRepository.findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(farmId))
                .thenReturn(Optional.of(verifiedReport));

        assertThatThrownBy(() -> recommendationService.recommend(farmId, validWeather))
                .isInstanceOf(RecommendationPrerequisiteException.class)
                .satisfies(e -> {
                    RecommendationPrerequisiteException ex = (RecommendationPrerequisiteException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("SOIL_FEATURES_INCOMPLETE");
                    assertThat(ex.getMessage()).contains("missing potassium (K)");
                });

        verify(mlPredictionClient, never()).predict(any());
    }

    @Test
    @DisplayName("Requirement 7: pH missing throws SOIL_FEATURES_INCOMPLETE")
    void phMissingThrowsSoilFeaturesIncomplete() {
        verifiedReport.setPh(null);

        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(soilReportRepository.findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(farmId))
                .thenReturn(Optional.of(verifiedReport));

        assertThatThrownBy(() -> recommendationService.recommend(farmId, validWeather))
                .isInstanceOf(RecommendationPrerequisiteException.class)
                .satisfies(e -> {
                    RecommendationPrerequisiteException ex = (RecommendationPrerequisiteException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("SOIL_FEATURES_INCOMPLETE");
                    assertThat(ex.getMessage()).contains("missing pH");
                });

        verify(mlPredictionClient, never()).predict(any());
    }

    @Test
    @DisplayName("Requirement 8: Temperature missing or NaN throws WEATHER_FEATURES_INCOMPLETE")
    void temperatureMissingThrowsWeatherFeaturesIncomplete() {
        WeatherObservation invalidWeather = new WeatherObservation(null, 78.0, 185.0, Instant.now(), "SRC");

        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(soilReportRepository.findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(farmId))
                .thenReturn(Optional.of(verifiedReport));

        assertThatThrownBy(() -> recommendationService.recommend(farmId, invalidWeather))
                .isInstanceOf(RecommendationPrerequisiteException.class)
                .satisfies(e -> {
                    RecommendationPrerequisiteException ex = (RecommendationPrerequisiteException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("WEATHER_FEATURES_INCOMPLETE");
                    assertThat(ex.getMessage()).contains("missing valid temperature");
                });

        verify(mlPredictionClient, never()).predict(any());
    }

    @Test
    @DisplayName("Requirement 9: Humidity missing or NaN throws WEATHER_FEATURES_INCOMPLETE")
    void humidityMissingThrowsWeatherFeaturesIncomplete() {
        WeatherObservation invalidWeather = new WeatherObservation(25.0, Double.NaN, 185.0, Instant.now(), "SRC");

        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(soilReportRepository.findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(farmId))
                .thenReturn(Optional.of(verifiedReport));

        assertThatThrownBy(() -> recommendationService.recommend(farmId, invalidWeather))
                .isInstanceOf(RecommendationPrerequisiteException.class)
                .satisfies(e -> {
                    RecommendationPrerequisiteException ex = (RecommendationPrerequisiteException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("WEATHER_FEATURES_INCOMPLETE");
                    assertThat(ex.getMessage()).contains("missing valid humidity");
                });

        verify(mlPredictionClient, never()).predict(any());
    }

    @Test
    @DisplayName("Requirement 10: Rainfall missing throws WEATHER_FEATURES_INCOMPLETE")
    void rainfallMissingThrowsWeatherFeaturesIncomplete() {
        WeatherObservation invalidWeather = new WeatherObservation(25.0, 70.0, null, Instant.now(), "SRC");

        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(soilReportRepository.findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(farmId))
                .thenReturn(Optional.of(verifiedReport));

        assertThatThrownBy(() -> recommendationService.recommend(farmId, invalidWeather))
                .isInstanceOf(RecommendationPrerequisiteException.class)
                .satisfies(e -> {
                    RecommendationPrerequisiteException ex = (RecommendationPrerequisiteException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("WEATHER_FEATURES_INCOMPLETE");
                    assertThat(ex.getMessage()).contains("missing valid rainfall");
                });

        verify(mlPredictionClient, never()).predict(any());
    }

    @Test
    @DisplayName("Null weather observation throws WEATHER_FEATURES_INCOMPLETE")
    void nullWeatherThrowsWeatherFeaturesIncomplete() {
        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(soilReportRepository.findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(farmId))
                .thenReturn(Optional.of(verifiedReport));

        assertThatThrownBy(() -> recommendationService.recommend(farmId, null))
                .isInstanceOf(RecommendationPrerequisiteException.class)
                .satisfies(e -> {
                    RecommendationPrerequisiteException ex = (RecommendationPrerequisiteException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("WEATHER_FEATURES_INCOMPLETE");
                });

        verify(mlPredictionClient, never()).predict(any());
    }

    @Test
    @DisplayName("Non-existent farm throws ResourceNotFoundException")
    void nonExistentFarmThrowsResourceNotFoundException() {
        UUID nonExistent = UUID.randomUUID();
        when(farmRepository.findById(nonExistent)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> recommendationService.recommend(nonExistent, validWeather))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Farm not found with ID: " + nonExistent);

        verify(soilReportRepository, never()).findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(any());
        verify(mlPredictionClient, never()).predict(any());
    }

    @Test
    @DisplayName("ML response with null or blank crop throws ML_SERVICE_INVALID_RESPONSE")
    void mlResponseWithBlankCropThrowsMlServiceInvalidResponse() {
        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(soilReportRepository.findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(farmId))
                .thenReturn(Optional.of(verifiedReport));
        when(mlPredictionClient.predict(any())).thenReturn(
                new MlPredictionResponse("", List.of(), "Random Forest", List.of(), 22, "")
        );

        assertThatThrownBy(() -> recommendationService.recommend(farmId, validWeather))
                .isInstanceOf(MlServiceException.class)
                .satisfies(e -> {
                    MlServiceException ex = (MlServiceException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("ML_SERVICE_INVALID_RESPONSE");
                });
    }

    @Test
    @DisplayName("Phase 4C-2 Req 1: recommend(farmId) resolves location, obtains real weather, verifies soil, and calls ML")
    void recommendWithFarmIdOrchestratesRealWeatherAndCallsMl() {
        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(weatherService.getWeatherForFarm(mockFarm)).thenReturn(validWeather);
        when(soilReportRepository.findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(farmId))
                .thenReturn(Optional.of(verifiedReport));
        when(mlPredictionClient.predict(any(MlPredictionRequest.class))).thenReturn(mockMlResponse);

        RecommendationResponse response = recommendationService.recommend(farmId);

        assertThat(response).isNotNull();
        assertThat(response.farmId()).isEqualTo(farmId);
        assertThat(response.recommendedCrop()).isEqualTo("rice");

        // Verify exactly the 7 features reach ML client
        ArgumentCaptor<MlPredictionRequest> captor = ArgumentCaptor.forClass(MlPredictionRequest.class);
        verify(mlPredictionClient).predict(captor.capture());
        MlPredictionRequest sentRequest = captor.getValue();
        assertThat(sentRequest.n()).isEqualTo(90.0);
        assertThat(sentRequest.p()).isEqualTo(42.0);
        assertThat(sentRequest.k()).isEqualTo(43.0);
        assertThat(sentRequest.temperature()).isEqualTo(26.5);
        assertThat(sentRequest.humidity()).isEqualTo(78.0);
        assertThat(sentRequest.ph()).isEqualTo(6.5);
        assertThat(sentRequest.rainfall()).isEqualTo(185.0);

        // Verify weather source and observation timestamp are preserved
        assertThat(response.inputFeatures().weatherSource()).isEqualTo("IMD_WARANGAL_STATION");
        assertThat(response.inputFeatures().weatherObservedAt()).isEqualTo(validWeather.observedAt());
        assertThat(response.inputFeatures().temperature()).isEqualTo(26.5);
        assertThat(response.inputFeatures().humidity()).isEqualTo(78.0);
        assertThat(response.inputFeatures().rainfall()).isEqualTo(185.0);
    }

    @Test
    @DisplayName("Phase 4C-2 Req 8: Location unresolved throws WEATHER_LOCATION_UNRESOLVED and never calls ML")
    void recommendWithFarmIdWhenLocationUnresolvedThrowsWeatherLocationUnresolved() {
        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(weatherService.getWeatherForFarm(mockFarm)).thenThrow(
                new RecommendationPrerequisiteException("WEATHER_LOCATION_UNRESOLVED", "Geographic coordinates could not be resolved")
        );

        assertThatThrownBy(() -> recommendationService.recommend(farmId))
                .isInstanceOf(RecommendationPrerequisiteException.class)
                .satisfies(e -> {
                    RecommendationPrerequisiteException ex = (RecommendationPrerequisiteException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("WEATHER_LOCATION_UNRESOLVED");
                });

        verify(mlPredictionClient, never()).predict(any());
        verify(soilReportRepository, never()).findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(any());
    }

    @Test
    @DisplayName("Phase 4C-2 Req 9: Weather provider unavailable throws WEATHER_DATA_UNAVAILABLE and never calls ML")
    void recommendWithFarmIdWhenWeatherProviderUnavailableThrowsWeatherDataUnavailable() {
        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(weatherService.getWeatherForFarm(mockFarm)).thenThrow(
                new com.agrismart.exception.WeatherServiceException("WEATHER_DATA_UNAVAILABLE", "Weather service currently unavailable (503)")
        );

        assertThatThrownBy(() -> recommendationService.recommend(farmId))
                .isInstanceOf(com.agrismart.exception.WeatherServiceException.class)
                .satisfies(e -> {
                    com.agrismart.exception.WeatherServiceException ex = (com.agrismart.exception.WeatherServiceException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("WEATHER_DATA_UNAVAILABLE");
                });

        verify(mlPredictionClient, never()).predict(any());
        verify(soilReportRepository, never()).findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(any());
    }

    @Test
    @DisplayName("Phase 4C-2 Req 10: Weather missing temperature rejects recommendation and never calls ML")
    void recommendWithFarmIdWhenWeatherMissingTemperatureRejectsWithoutMlCall() {
        WeatherObservation missingTempWeather = new WeatherObservation(null, 78.0, 185.0, Instant.now(), "SRC");
        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(weatherService.getWeatherForFarm(mockFarm)).thenReturn(missingTempWeather);
        when(soilReportRepository.findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(farmId))
                .thenReturn(Optional.of(verifiedReport));

        assertThatThrownBy(() -> recommendationService.recommend(farmId))
                .isInstanceOf(RecommendationPrerequisiteException.class)
                .satisfies(e -> {
                    RecommendationPrerequisiteException ex = (RecommendationPrerequisiteException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("WEATHER_FEATURES_INCOMPLETE");
                    assertThat(ex.getMessage()).contains("missing valid temperature");
                });

        verify(mlPredictionClient, never()).predict(any());
    }

    @Test
    @DisplayName("Phase 4C-2 Req 11: Weather missing humidity rejects recommendation and never calls ML")
    void recommendWithFarmIdWhenWeatherMissingHumidityRejectsWithoutMlCall() {
        WeatherObservation missingHumWeather = new WeatherObservation(26.5, null, 185.0, Instant.now(), "SRC");
        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(weatherService.getWeatherForFarm(mockFarm)).thenReturn(missingHumWeather);
        when(soilReportRepository.findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(farmId))
                .thenReturn(Optional.of(verifiedReport));

        assertThatThrownBy(() -> recommendationService.recommend(farmId))
                .isInstanceOf(RecommendationPrerequisiteException.class)
                .satisfies(e -> {
                    RecommendationPrerequisiteException ex = (RecommendationPrerequisiteException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("WEATHER_FEATURES_INCOMPLETE");
                    assertThat(ex.getMessage()).contains("missing valid humidity");
                });

        verify(mlPredictionClient, never()).predict(any());
    }

    @Test
    @DisplayName("Phase 4C-2 Req 12: Weather missing rainfall rejects recommendation without silent 0 fallback and never calls ML")
    void recommendWithFarmIdWhenWeatherMissingRainfallRejectsWithoutMlCall() {
        WeatherObservation missingRainWeather = new WeatherObservation(26.5, 78.0, null, Instant.now(), "SRC");
        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(weatherService.getWeatherForFarm(mockFarm)).thenReturn(missingRainWeather);
        when(soilReportRepository.findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(farmId))
                .thenReturn(Optional.of(verifiedReport));

        assertThatThrownBy(() -> recommendationService.recommend(farmId))
                .isInstanceOf(RecommendationPrerequisiteException.class)
                .satisfies(e -> {
                    RecommendationPrerequisiteException ex = (RecommendationPrerequisiteException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("WEATHER_FEATURES_INCOMPLETE");
                    assertThat(ex.getMessage()).contains("missing valid rainfall");
                });

        verify(mlPredictionClient, never()).predict(any());
    }

    @Test
    @DisplayName("Phase 4C-2 Req 13: Weather containing NaN or Infinite values is rejected")
    void recommendWithFarmIdWhenWeatherContainsNaNRejectsWithoutMlCall() {
        WeatherObservation nanWeather = new WeatherObservation(Double.NaN, 78.0, 185.0, Instant.now(), "SRC");
        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(weatherService.getWeatherForFarm(mockFarm)).thenReturn(nanWeather);
        when(soilReportRepository.findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(farmId))
                .thenReturn(Optional.of(verifiedReport));

        assertThatThrownBy(() -> recommendationService.recommend(farmId))
                .isInstanceOf(RecommendationPrerequisiteException.class)
                .satisfies(e -> {
                    RecommendationPrerequisiteException ex = (RecommendationPrerequisiteException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("WEATHER_FEATURES_INCOMPLETE");
                });

        verify(mlPredictionClient, never()).predict(any());
    }

    @Test
    @DisplayName("Phase 4C-2 Req 2: Farm does not exist throws ResourceNotFoundException")
    void recommendWithFarmIdWhenFarmNotFoundThrowsResourceNotFoundException() {
        UUID nonExistentId = UUID.randomUUID();
        when(farmRepository.findById(nonExistentId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> recommendationService.recommend(nonExistentId))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Farm not found with ID: " + nonExistentId);

        verify(weatherService, never()).getWeatherForFarm(any());
        verify(mlPredictionClient, never()).predict(any());
    }

    @Test
    @DisplayName("Phase 4C-2 Req 3: No verified soil report throws NO_VERIFIED_SOIL_REPORT")
    void recommendWithFarmIdWhenNoVerifiedSoilReportThrowsNoVerifiedSoilReport() {
        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(weatherService.getWeatherForFarm(mockFarm)).thenReturn(validWeather);
        when(soilReportRepository.findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(farmId))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> recommendationService.recommend(farmId))
                .isInstanceOf(RecommendationPrerequisiteException.class)
                .satisfies(e -> {
                    RecommendationPrerequisiteException ex = (RecommendationPrerequisiteException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("NO_VERIFIED_SOIL_REPORT");
                });

        verify(mlPredictionClient, never()).predict(any());
    }
}

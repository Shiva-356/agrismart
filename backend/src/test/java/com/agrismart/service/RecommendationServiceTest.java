package com.agrismart.service;

import com.agrismart.dto.recommendation.RankedCropResponse;
import com.agrismart.dto.recommendation.RecommendationRequest;
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
    private Double validSeasonalRainfallMm;
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

        // Note: 12.4 mm is current/hourly weather station precipitation — NEVER seasonal rainfall!
        validWeather = new WeatherObservation(
                26.5,
                78.0,
                12.4,
                Instant.now(),
                "IMD_WARANGAL_STATION"
        );
        validSeasonalRainfallMm = 185.0;

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
                "Uncalibrated Random Forest model score on benchmark dataset"
        );
    }

    @Test
    @DisplayName("Verified report + ambient weather + explicit seasonalRainfallMm invokes ML client with seasonal rainfall (never hourly precipitation)")
    void verifiedReportAndExplicitSeasonalRainfallInvokesMlClient() {
        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(soilReportRepository.findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(farmId))
                .thenReturn(Optional.of(verifiedReport));
        when(mlPredictionClient.predict(any(MlPredictionRequest.class))).thenReturn(mockMlResponse);

        RecommendationResponse response = recommendationService.recommend(farmId, validWeather, validSeasonalRainfallMm);

        assertThat(response).isNotNull();
        assertThat(response.farmId()).isEqualTo(farmId);
        assertThat(response.soilReportId()).isEqualTo(verifiedReport.getId());
        assertThat(response.recommendedCrop()).isEqualTo("rice");
        assertThat(response.rankedCrops()).hasSize(3);
        assertThat(response.modelName()).isEqualTo("Random Forest");

        assertThat(response.inputFeatures().nitrogen()).isEqualTo(90.0);
        assertThat(response.inputFeatures().phosphorus()).isEqualTo(42.0);
        assertThat(response.inputFeatures().potassium()).isEqualTo(43.0);
        assertThat(response.inputFeatures().ph()).isEqualTo(6.5);
        assertThat(response.inputFeatures().temperature()).isEqualTo(26.5);
        assertThat(response.inputFeatures().humidity()).isEqualTo(78.0);
        assertThat(response.inputFeatures().rainfall()).isEqualTo(185.0);
        assertThat(response.inputFeatures().seasonalRainfallMm()).isEqualTo(185.0);

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
        assertThat(sentRequest.rainfall()).isNotEqualTo(validWeather.rainfall());
    }

    @Test
    @DisplayName("P0: Hourly weather precipitation (12.4 mm) NEVER populates seasonalRainfallMm when recommend(farmId) is called without seasonal rainfall")
    void hourlyWeatherPrecipitationNeverPopulatesSeasonalRainfallInDefaultRecommend() {
        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(weatherService.getWeatherForFarm(mockFarm)).thenReturn(validWeather);
        when(soilReportRepository.findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(farmId))
                .thenReturn(Optional.of(verifiedReport));

        assertThatThrownBy(() -> recommendationService.recommend(farmId))
                .isInstanceOf(RecommendationPrerequisiteException.class)
                .satisfies(e -> {
                    RecommendationPrerequisiteException ex = (RecommendationPrerequisiteException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("SEASONAL_RAINFALL_REQUIRED");
                    assertThat(ex.getMessage()).contains("seasonalRainfallMm");
                });

        verify(mlPredictionClient, never()).predict(any());
    }

    @Test
    @DisplayName("P0: Hourly weather precipitation NEVER populates seasonalRainfallMm when seasonalRainfallMm is null")
    void hourlyWeatherPrecipitationNeverPopulatesWhenSeasonalRainfallNull() {
        WeatherObservation heavyHourlyShower = new WeatherObservation(27.0, 84.0, 42.5, Instant.now(), "Open-Meteo");
        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(soilReportRepository.findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(farmId))
                .thenReturn(Optional.of(verifiedReport));

        assertThatThrownBy(() -> recommendationService.recommend(farmId, heavyHourlyShower, null))
                .isInstanceOf(RecommendationPrerequisiteException.class)
                .satisfies(e -> {
                    RecommendationPrerequisiteException ex = (RecommendationPrerequisiteException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("SEASONAL_RAINFALL_REQUIRED");
                });

        verify(mlPredictionClient, never()).predict(any());
    }

    @Test
    @DisplayName("P0: Genuine zero seasonal rainfall (0.0 mm) is distinguished from missing null and forwarded to ML")
    void genuineZeroSeasonalRainfallIsAcceptedAndNotTreatedAsMissing() {
        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(soilReportRepository.findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(farmId))
                .thenReturn(Optional.of(verifiedReport));
        when(mlPredictionClient.predict(any(MlPredictionRequest.class))).thenReturn(mockMlResponse);

        RecommendationResponse response = recommendationService.recommend(farmId, validWeather, 0.0);

        assertThat(response.inputFeatures().rainfall()).isEqualTo(0.0);
        assertThat(response.inputFeatures().seasonalRainfallMm()).isEqualTo(0.0);

        ArgumentCaptor<MlPredictionRequest> captor = ArgumentCaptor.forClass(MlPredictionRequest.class);
        verify(mlPredictionClient).predict(captor.capture());
        assertThat(captor.getValue().rainfall()).isEqualTo(0.0);
    }

    @Test
    @DisplayName("P0: Out-of-range seasonal rainfall (-5 mm or 1200 mm) throws ML_INPUT_OUT_OF_RANGE instead of calling ML service")
    void outOfRangeSeasonalRainfallThrowsValidationErrorWithoutMlCall() {
        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(soilReportRepository.findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(farmId))
                .thenReturn(Optional.of(verifiedReport));

        assertThatThrownBy(() -> recommendationService.recommend(farmId, validWeather, -5.0))
                .isInstanceOf(RecommendationPrerequisiteException.class)
                .satisfies(e -> assertThat(((RecommendationPrerequisiteException) e).getErrorCode())
                        .isEqualTo("ML_INPUT_OUT_OF_RANGE"));

        assertThatThrownBy(() -> recommendationService.recommend(farmId, validWeather, 1200.0))
                .isInstanceOf(RecommendationPrerequisiteException.class)
                .satisfies(e -> assertThat(((RecommendationPrerequisiteException) e).getErrorCode())
                        .isEqualTo("ML_INPUT_OUT_OF_RANGE"));

        verify(mlPredictionClient, never()).predict(any());
    }

    @Test
    @DisplayName("P0: Out-of-range soil nitrogen (> 300) throws ML_INPUT_OUT_OF_RANGE instead of calling ML service")
    void outOfRangeSoilFeatureThrowsValidationErrorWithoutMlCall() {
        verifiedReport.setNitrogen(BigDecimal.valueOf(350.0));
        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(soilReportRepository.findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(farmId))
                .thenReturn(Optional.of(verifiedReport));

        assertThatThrownBy(() -> recommendationService.recommend(farmId, validWeather, validSeasonalRainfallMm))
                .isInstanceOf(RecommendationPrerequisiteException.class)
                .satisfies(e -> {
                    RecommendationPrerequisiteException ex = (RecommendationPrerequisiteException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("ML_INPUT_OUT_OF_RANGE");
                    assertThat(ex.getMessage()).contains("Nitrogen");
                });

        verify(mlPredictionClient, never()).predict(any());
    }

    @Test
    @DisplayName("No verified report throws RecommendationPrerequisiteException (NO_VERIFIED_SOIL_REPORT)")
    void noVerifiedReportThrowsRecommendationPrerequisiteException() {
        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(soilReportRepository.findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(farmId))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> recommendationService.recommend(farmId, validWeather, validSeasonalRainfallMm))
                .isInstanceOf(RecommendationPrerequisiteException.class)
                .satisfies(e -> {
                    RecommendationPrerequisiteException ex = (RecommendationPrerequisiteException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("NO_VERIFIED_SOIL_REPORT");
                    assertThat(ex.getMessage()).contains("No verified laboratory soil report found");
                });

        verify(mlPredictionClient, never()).predict(any());
    }

    @Test
    @DisplayName("Nitrogen (N) missing throws SOIL_FEATURES_INCOMPLETE")
    void nitrogenMissingThrowsSoilFeaturesIncomplete() {
        verifiedReport.setNitrogen(null);

        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(soilReportRepository.findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(farmId))
                .thenReturn(Optional.of(verifiedReport));

        assertThatThrownBy(() -> recommendationService.recommend(farmId, validWeather, validSeasonalRainfallMm))
                .isInstanceOf(RecommendationPrerequisiteException.class)
                .satisfies(e -> {
                    RecommendationPrerequisiteException ex = (RecommendationPrerequisiteException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("SOIL_FEATURES_INCOMPLETE");
                    assertThat(ex.getMessage()).contains("missing nitrogen (N)");
                });

        verify(mlPredictionClient, never()).predict(any());
    }

    @Test
    @DisplayName("Phosphorus (P) missing throws SOIL_FEATURES_INCOMPLETE")
    void phosphorusMissingThrowsSoilFeaturesIncomplete() {
        verifiedReport.setPhosphorus(null);

        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(soilReportRepository.findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(farmId))
                .thenReturn(Optional.of(verifiedReport));

        assertThatThrownBy(() -> recommendationService.recommend(farmId, validWeather, validSeasonalRainfallMm))
                .isInstanceOf(RecommendationPrerequisiteException.class)
                .satisfies(e -> {
                    RecommendationPrerequisiteException ex = (RecommendationPrerequisiteException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("SOIL_FEATURES_INCOMPLETE");
                    assertThat(ex.getMessage()).contains("missing phosphorus (P)");
                });

        verify(mlPredictionClient, never()).predict(any());
    }

    @Test
    @DisplayName("Potassium (K) missing throws SOIL_FEATURES_INCOMPLETE")
    void potassiumMissingThrowsSoilFeaturesIncomplete() {
        verifiedReport.setPotassium(null);

        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(soilReportRepository.findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(farmId))
                .thenReturn(Optional.of(verifiedReport));

        assertThatThrownBy(() -> recommendationService.recommend(farmId, validWeather, validSeasonalRainfallMm))
                .isInstanceOf(RecommendationPrerequisiteException.class)
                .satisfies(e -> {
                    RecommendationPrerequisiteException ex = (RecommendationPrerequisiteException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("SOIL_FEATURES_INCOMPLETE");
                    assertThat(ex.getMessage()).contains("missing potassium (K)");
                });

        verify(mlPredictionClient, never()).predict(any());
    }

    @Test
    @DisplayName("pH missing throws SOIL_FEATURES_INCOMPLETE")
    void phMissingThrowsSoilFeaturesIncomplete() {
        verifiedReport.setPh(null);

        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(soilReportRepository.findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(farmId))
                .thenReturn(Optional.of(verifiedReport));

        assertThatThrownBy(() -> recommendationService.recommend(farmId, validWeather, validSeasonalRainfallMm))
                .isInstanceOf(RecommendationPrerequisiteException.class)
                .satisfies(e -> {
                    RecommendationPrerequisiteException ex = (RecommendationPrerequisiteException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("SOIL_FEATURES_INCOMPLETE");
                    assertThat(ex.getMessage()).contains("missing pH");
                });

        verify(mlPredictionClient, never()).predict(any());
    }

    @Test
    @DisplayName("Temperature missing or NaN throws WEATHER_FEATURES_INCOMPLETE")
    void temperatureMissingThrowsWeatherFeaturesIncomplete() {
        WeatherObservation invalidWeather = new WeatherObservation(null, 78.0, 12.4, Instant.now(), "SRC");

        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(soilReportRepository.findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(farmId))
                .thenReturn(Optional.of(verifiedReport));

        assertThatThrownBy(() -> recommendationService.recommend(farmId, invalidWeather, validSeasonalRainfallMm))
                .isInstanceOf(RecommendationPrerequisiteException.class)
                .satisfies(e -> {
                    RecommendationPrerequisiteException ex = (RecommendationPrerequisiteException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("WEATHER_FEATURES_INCOMPLETE");
                    assertThat(ex.getMessage()).contains("missing valid temperature");
                });

        verify(mlPredictionClient, never()).predict(any());
    }

    @Test
    @DisplayName("Humidity missing or NaN throws WEATHER_FEATURES_INCOMPLETE")
    void humidityMissingThrowsWeatherFeaturesIncomplete() {
        WeatherObservation invalidWeather = new WeatherObservation(25.0, Double.NaN, 12.4, Instant.now(), "SRC");

        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(soilReportRepository.findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(farmId))
                .thenReturn(Optional.of(verifiedReport));

        assertThatThrownBy(() -> recommendationService.recommend(farmId, invalidWeather, validSeasonalRainfallMm))
                .isInstanceOf(RecommendationPrerequisiteException.class)
                .satisfies(e -> {
                    RecommendationPrerequisiteException ex = (RecommendationPrerequisiteException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("WEATHER_FEATURES_INCOMPLETE");
                    assertThat(ex.getMessage()).contains("missing valid humidity");
                });

        verify(mlPredictionClient, never()).predict(any());
    }

    @Test
    @DisplayName("recommend(farmId, seasonalRainfallMm) orchestrates live ambient weather + explicit seasonal rainfall")
    void recommendWithFarmIdAndSeasonalRainfallOrchestratesRealWeatherAndCallsMl() {
        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(weatherService.getWeatherForFarm(mockFarm)).thenReturn(validWeather);
        when(soilReportRepository.findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(farmId))
                .thenReturn(Optional.of(verifiedReport));
        when(mlPredictionClient.predict(any(MlPredictionRequest.class))).thenReturn(mockMlResponse);

        RecommendationResponse response = recommendationService.recommend(farmId, 202.5);

        assertThat(response).isNotNull();
        assertThat(response.recommendedCrop()).isEqualTo("rice");

        ArgumentCaptor<MlPredictionRequest> captor = ArgumentCaptor.forClass(MlPredictionRequest.class);
        verify(mlPredictionClient).predict(captor.capture());
        MlPredictionRequest sentRequest = captor.getValue();
        assertThat(sentRequest.temperature()).isEqualTo(26.5);
        assertThat(sentRequest.humidity()).isEqualTo(78.0);
        assertThat(sentRequest.rainfall()).isEqualTo(202.5);
        assertThat(sentRequest.rainfall()).isNotEqualTo(validWeather.rainfall());
    }

    @Test
    @DisplayName("recommend(farmId, RecommendationRequest) uses explicit request fields and ignores weatherService when temp & humidity provided")
    void recommendWithExplicitRecommendationRequestUsesSeasonalRainfallMm() {
        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(soilReportRepository.findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(farmId))
                .thenReturn(Optional.of(verifiedReport));
        when(mlPredictionClient.predict(any(MlPredictionRequest.class))).thenReturn(mockMlResponse);

        RecommendationRequest req = new RecommendationRequest(24.0, 80.0, 195.0, Instant.now(), "Field Gauge");
        RecommendationResponse response = recommendationService.recommend(farmId, req);

        verify(weatherService, never()).getWeatherForFarm(any());
        assertThat(response.inputFeatures().seasonalRainfallMm()).isEqualTo(195.0);
    }

    @Test
    @DisplayName("Non-existent farm throws ResourceNotFoundException")
    void nonExistentFarmThrowsResourceNotFoundException() {
        UUID nonExistent = UUID.randomUUID();
        when(farmRepository.findById(nonExistent)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> recommendationService.recommend(nonExistent, validSeasonalRainfallMm))
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

        assertThatThrownBy(() -> recommendationService.recommend(farmId, validWeather, validSeasonalRainfallMm))
                .isInstanceOf(MlServiceException.class)
                .satisfies(e -> {
                    MlServiceException ex = (MlServiceException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("ML_SERVICE_INVALID_RESPONSE");
                });
    }
}

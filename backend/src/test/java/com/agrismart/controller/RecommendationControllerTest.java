package com.agrismart.controller;

import com.agrismart.dto.recommendation.RankedCropResponse;
import com.agrismart.dto.recommendation.RecommendationRequest;
import com.agrismart.dto.recommendation.RecommendationResponse;
import com.agrismart.exception.GlobalExceptionHandler;
import com.agrismart.exception.RecommendationPrerequisiteException;
import com.agrismart.exception.ResourceNotFoundException;
import com.agrismart.exception.WeatherServiceException;
import com.agrismart.service.RecommendationService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class RecommendationControllerTest {

    private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    @Mock
    private RecommendationService recommendationService;

    @InjectMocks
    private RecommendationController recommendationController;

    private UUID farmId;
    private RecommendationResponse mockResponse;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(recommendationController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();

        farmId = UUID.randomUUID();
        UUID soilReportId = UUID.randomUUID();

        RecommendationResponse.RecommendationInputFeatures features =
                new RecommendationResponse.RecommendationInputFeatures(
                        90.0, 42.0, 43.0, 6.5, 26.5, 78.0, 185.0,
                        LocalDate.now().minusDays(10),
                        Instant.now(),
                        "Open-Meteo (Warangal, Telangana)"
                );

        mockResponse = new RecommendationResponse(
                farmId,
                soilReportId,
                "rice",
                List.of(new RankedCropResponse("rice", 0.95)),
                "Random Forest",
                features,
                Instant.now(),
                "Uncalibrated Random Forest model score on benchmark dataset"
        );
    }

    @Test
    @DisplayName("GET /api/farms/{farmId}/recommendation?seasonalRainfallMm=185 returns 200 OK")
    void getRecommendationWithSeasonalRainfallSuccess() throws Exception {
        when(recommendationService.recommend(farmId, 185.0)).thenReturn(mockResponse);

        mockMvc.perform(get("/api/farms/{farmId}/recommendation", farmId)
                        .param("seasonalRainfallMm", "185.0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.farmId", is(farmId.toString())))
                .andExpect(jsonPath("$.recommendedCrop", is("rice")))
                .andExpect(jsonPath("$.inputFeatures.temperature", is(26.5)))
                .andExpect(jsonPath("$.inputFeatures.humidity", is(78.0)))
                .andExpect(jsonPath("$.inputFeatures.rainfall", is(185.0)))
                .andExpect(jsonPath("$.inputFeatures.seasonalRainfallMm", is(185.0)));
    }

    @Test
    @DisplayName("GET /api/farms/{farmId}/recommendation without seasonalRainfallMm returns 422 SEASONAL_RAINFALL_REQUIRED")
    void getRecommendationWithoutSeasonalRainfallReturns422() throws Exception {
        when(recommendationService.recommend(eq(farmId), isNull()))
                .thenThrow(new RecommendationPrerequisiteException(
                        "SEASONAL_RAINFALL_REQUIRED",
                        "Growing-season rainfall (seasonalRainfallMm) is required"
                ));

        mockMvc.perform(get("/api/farms/{farmId}/recommendation", farmId))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errorCode", is("SEASONAL_RAINFALL_REQUIRED")));
    }

    @Test
    @DisplayName("GET /api/farms/{farmId}/recommendation returns 404 when farm does not exist")
    void getRecommendationFarmNotFound() throws Exception {
        when(recommendationService.recommend(eq(farmId), isNull()))
                .thenThrow(new ResourceNotFoundException("Farm not found with ID: " + farmId));

        mockMvc.perform(get("/api/farms/{farmId}/recommendation", farmId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.errorCode", is("RESOURCE_NOT_FOUND")));
    }

    @Test
    @DisplayName("GET /api/farms/{farmId}/recommendation returns 503 when weather provider is down")
    void getRecommendationWeatherUnavailable() throws Exception {
        when(recommendationService.recommend(eq(farmId), eq(185.0)))
                .thenThrow(new WeatherServiceException("WEATHER_DATA_UNAVAILABLE", "Weather service currently unavailable"));

        mockMvc.perform(get("/api/farms/{farmId}/recommendation", farmId)
                        .param("seasonalRainfallMm", "185.0"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.errorCode", is("WEATHER_DATA_UNAVAILABLE")));
    }

    @Test
    @DisplayName("POST /api/farms/{farmId}/recommendation with explicit seasonalRainfallMm returns 200 OK")
    void postRecommendationWithExplicitSeasonalRainfall() throws Exception {
        RecommendationRequest req = new RecommendationRequest(28.0, 75.0, 150.0, Instant.now(), "Field Station Sensor");
        when(recommendationService.recommend(eq(farmId), any(RecommendationRequest.class))).thenReturn(mockResponse);

        mockMvc.perform(post("/api/farms/{farmId}/recommendation", farmId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recommendedCrop", is("rice")));
    }

    @Test
    @DisplayName("P0: POST /api/farms/{farmId}/recommendation ignores hourly 'rainfall' field in JSON body so seasonalRainfallMm remains null")
    void postRecommendationWithHourlyRainfallFieldLeavesSeasonalRainfallNull() throws Exception {
        String hourlyWeatherJson = """
                {
                  "temperature": 28.0,
                  "humidity": 75.0,
                  "rainfall": 12.4,
                  "rainfallMm": 12.4
                }
                """;
        when(recommendationService.recommend(eq(farmId), any(RecommendationRequest.class)))
                .thenThrow(new RecommendationPrerequisiteException(
                        "SEASONAL_RAINFALL_REQUIRED",
                        "Growing-season rainfall (seasonalRainfallMm) is required"
                ));

        mockMvc.perform(post("/api/farms/{farmId}/recommendation", farmId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(hourlyWeatherJson))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errorCode", is("SEASONAL_RAINFALL_REQUIRED")));

        ArgumentCaptor<RecommendationRequest> captor = ArgumentCaptor.forClass(RecommendationRequest.class);
        verify(recommendationService).recommend(eq(farmId), captor.capture());
        assertThat(captor.getValue().seasonalRainfallMm()).isNull();
    }
}

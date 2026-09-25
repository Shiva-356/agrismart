package com.agrismart.controller;

import com.agrismart.dto.recommendation.RankedCropResponse;
import com.agrismart.dto.recommendation.RecommendationResponse;
import com.agrismart.exception.GlobalExceptionHandler;
import com.agrismart.exception.RecommendationPrerequisiteException;
import com.agrismart.exception.ResourceNotFoundException;
import com.agrismart.exception.WeatherServiceException;
import com.agrismart.service.RecommendationService;
import com.agrismart.weather.WeatherObservation;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
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

import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
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
                "Verified laboratory soil and real weather observations"
        );
    }

    @Test
    @DisplayName("GET /api/farms/{farmId}/recommendation returns 200 OK with genuine recommendation")
    void getRecommendationSuccess() throws Exception {
        when(recommendationService.recommend(farmId)).thenReturn(mockResponse);

        mockMvc.perform(get("/api/farms/{farmId}/recommendation", farmId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.farmId", is(farmId.toString())))
                .andExpect(jsonPath("$.recommendedCrop", is("rice")))
                .andExpect(jsonPath("$.inputFeatures.weatherSource", is("Open-Meteo (Warangal, Telangana)")))
                .andExpect(jsonPath("$.inputFeatures.temperature", is(26.5)))
                .andExpect(jsonPath("$.inputFeatures.humidity", is(78.0)))
                .andExpect(jsonPath("$.inputFeatures.rainfall", is(185.0)));
    }

    @Test
    @DisplayName("GET /api/farms/{farmId}/recommendation returns 404 when farm does not exist")
    void getRecommendationFarmNotFound() throws Exception {
        when(recommendationService.recommend(farmId))
                .thenThrow(new ResourceNotFoundException("Farm not found with ID: " + farmId));

        mockMvc.perform(get("/api/farms/{farmId}/recommendation", farmId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error", is("RESOURCE_NOT_FOUND")));
    }

    @Test
    @DisplayName("GET /api/farms/{farmId}/recommendation returns 422 when location is unresolvable")
    void getRecommendationLocationUnresolved() throws Exception {
        when(recommendationService.recommend(farmId))
                .thenThrow(new RecommendationPrerequisiteException("WEATHER_LOCATION_UNRESOLVED", "Location could not be resolved"));

        mockMvc.perform(get("/api/farms/{farmId}/recommendation", farmId))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error", is("WEATHER_LOCATION_UNRESOLVED")));
    }

    @Test
    @DisplayName("GET /api/farms/{farmId}/recommendation returns 503 when weather provider is down")
    void getRecommendationWeatherUnavailable() throws Exception {
        when(recommendationService.recommend(farmId))
                .thenThrow(new WeatherServiceException("WEATHER_DATA_UNAVAILABLE", "Weather service currently unavailable"));

        mockMvc.perform(get("/api/farms/{farmId}/recommendation", farmId))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error", is("WEATHER_DATA_UNAVAILABLE")));
    }

    @Test
    @DisplayName("GET /api/farms/{farmId}/recommendation returns 422 when verified soil report is missing")
    void getRecommendationNoVerifiedSoil() throws Exception {
        when(recommendationService.recommend(farmId))
                .thenThrow(new RecommendationPrerequisiteException("NO_VERIFIED_SOIL_REPORT", "No verified laboratory soil report"));

        mockMvc.perform(get("/api/farms/{farmId}/recommendation", farmId))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error", is("NO_VERIFIED_SOIL_REPORT")));
    }

    @Test
    @DisplayName("POST /api/farms/{farmId}/recommendation with explicit weather payload returns 200 OK")
    void postRecommendationWithExplicitWeather() throws Exception {
        WeatherObservation customWeather = new WeatherObservation(28.0, 75.0, 150.0, Instant.now(), "Field Station Sensor");
        when(recommendationService.recommend(eq(farmId), any(WeatherObservation.class))).thenReturn(mockResponse);

        mockMvc.perform(post("/api/farms/{farmId}/recommendation", farmId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(customWeather)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.recommendedCrop", is("rice")));
    }
}

package com.agrismart.controller;

import com.agrismart.dto.recommendation.RecommendationResponse;
import com.agrismart.service.RecommendationService;
import com.agrismart.weather.WeatherObservation;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * REST controller for generating ML-powered crop recommendations for farms.
 *
 * Integrates verified laboratory soil reports and real-time weather observations.
 */
@RestController
@RequestMapping("/api/farms")
public class RecommendationController {

    private final RecommendationService recommendationService;

    public RecommendationController(RecommendationService recommendationService) {
        this.recommendationService = recommendationService;
    }

    /**
     * Generates a crop recommendation for the specified farm using its latest verified
     * laboratory soil report and real-time weather observations.
     *
     * GET /api/farms/{farmId}/recommendation
     */
    @GetMapping("/{farmId}/recommendation")
    public ResponseEntity<RecommendationResponse> getRecommendation(@PathVariable UUID farmId) {
        RecommendationResponse response = recommendationService.recommend(farmId);
        return ResponseEntity.ok(response);
    }

    /**
     * Generates a crop recommendation for the specified farm with an optional explicit weather observation
     * (useful for simulations or field tests). If no weather payload is provided, real-time weather
     * is automatically obtained for the farm's location.
     *
     * POST /api/farms/{farmId}/recommendation
     */
    @PostMapping("/{farmId}/recommendation")
    public ResponseEntity<RecommendationResponse> generateRecommendation(
            @PathVariable UUID farmId,
            @RequestBody(required = false) WeatherObservation weather
    ) {
        RecommendationResponse response = (weather != null && weather.hasAllMeasurements())
                ? recommendationService.recommend(farmId, weather)
                : recommendationService.recommend(farmId);
        return ResponseEntity.ok(response);
    }
}

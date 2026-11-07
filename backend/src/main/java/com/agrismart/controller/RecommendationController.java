package com.agrismart.controller;

import com.agrismart.dto.recommendation.RecommendationRequest;
import com.agrismart.dto.recommendation.RecommendationResponse;
import com.agrismart.service.RecommendationService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * REST controller for generating ML-powered crop recommendations for farms.
 *
 * Requires verified laboratory soil chemistry, ambient temperature & humidity,
 * and an explicit growing-season cumulative rainfall ({@code seasonalRainfallMm}).
 * Hourly weather station precipitation is never used as seasonal rainfall.
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
     * laboratory soil report, real-time ambient temperature & humidity, and explicit
     * growing-season cumulative rainfall ({@code seasonalRainfallMm}).
     *
     * GET /api/farms/{farmId}/recommendation?seasonalRainfallMm={mm}
     */
    @GetMapping("/{farmId}/recommendation")
    public ResponseEntity<RecommendationResponse> getRecommendation(
            @PathVariable UUID farmId,
            @RequestParam(required = false) Double seasonalRainfallMm
    ) {
        RecommendationResponse response = recommendationService.recommend(farmId, seasonalRainfallMm);
        return ResponseEntity.ok(response);
    }

    /**
     * Generates a crop recommendation for the specified farm using an explicit
     * {@link RecommendationRequest} payload carrying {@code seasonalRainfallMm} and optional
     * ambient temperature/humidity overrides.
     *
     * POST /api/farms/{farmId}/recommendation
     */
    @PostMapping("/{farmId}/recommendation")
    public ResponseEntity<RecommendationResponse> generateRecommendation(
            @PathVariable UUID farmId,
            @RequestBody(required = false) RecommendationRequest request
    ) {
        RecommendationResponse response = recommendationService.recommend(farmId, request);
        return ResponseEntity.ok(response);
    }
}

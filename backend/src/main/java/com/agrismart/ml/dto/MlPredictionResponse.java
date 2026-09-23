package com.agrismart.ml.dto;

import com.agrismart.dto.recommendation.RankedCropResponse;

import java.util.List;

/**
 * Domain response containing the ML inference output.
 */
public record MlPredictionResponse(
        String crop,
        List<RankedCropResponse> rankedCrops,
        String model,
        List<String> featuresUsed,
        Integer classCount,
        String note
) {}

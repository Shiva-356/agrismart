package com.agrismart.dto.recommendation;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * High-level crop recommendation result returned by the backend recommendation engine.
 *
 * Contains full traceability of the input features used (soil test date, weather observation timestamp, source)
 * as well as the ML model metadata.
 */
public record RecommendationResponse(
        UUID farmId,
        UUID soilReportId,
        String recommendedCrop,
        List<RankedCropResponse> rankedCrops,
        String modelName,
        RecommendationInputFeatures inputFeatures,
        Instant generatedAt,
        String note
) {
    public record RecommendationInputFeatures(
            Double nitrogen,
            Double phosphorus,
            Double potassium,
            Double ph,
            Double temperature,
            Double humidity,
            Double rainfall,
            LocalDate soilReportDate,
            Instant weatherObservedAt,
            String weatherSource
    ) {}
}

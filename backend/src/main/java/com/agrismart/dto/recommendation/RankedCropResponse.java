package com.agrismart.dto.recommendation;

/**
 * Represents a ranked crop candidate predicted by the ML model with its probability.
 */
public record RankedCropResponse(
        String crop,
        Double probability
) {}

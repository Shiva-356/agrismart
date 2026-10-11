package com.agrismart.ml.client;

/**
 * Transport record representing an item in the 'ranked' array returned by FastAPI.
 */
public record FastApiRankedCrop(
        String crop,
        Double probability
) {}

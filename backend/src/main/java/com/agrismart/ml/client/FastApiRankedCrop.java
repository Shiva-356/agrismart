package com.agrismart.ml.client;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

/**
 * Transport record representing an item in the 'ranked' array returned by FastAPI.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record FastApiRankedCrop(
        String crop,
        Double probability
) {}

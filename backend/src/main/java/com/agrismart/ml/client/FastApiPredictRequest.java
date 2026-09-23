package com.agrismart.ml.client;

import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Transport payload sent to FastAPI POST /predict.
 *
 * Adheres strictly to the schema defined in ml/api/main.py:
 * { "N": float, "P": float, "K": float, "temperature": float, "humidity": float, "ph": float, "rainfall": float }
 */
public record FastApiPredictRequest(
        @JsonProperty("N") Double n,
        @JsonProperty("P") Double p,
        @JsonProperty("K") Double k,
        @JsonProperty("temperature") Double temperature,
        @JsonProperty("humidity") Double humidity,
        @JsonProperty("ph") Double ph,
        @JsonProperty("rainfall") Double rainfall
) {}

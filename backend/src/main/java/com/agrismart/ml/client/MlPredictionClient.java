package com.agrismart.ml.client;

import com.agrismart.ml.dto.MlPredictionRequest;
import com.agrismart.ml.dto.MlPredictionResponse;

/**
 * Client interface for invoking crop recommendation ML inference.
 */
public interface MlPredictionClient {

    /**
     * Executes ML crop prediction given the seven required features.
     *
     * @param request the feature payload containing N, P, K, temperature, humidity, pH, rainfall
     * @return the ML prediction result
     * @throws com.agrismart.exception.MlServiceException if the service is unreachable or returns an error
     */
    MlPredictionResponse predict(MlPredictionRequest request);
}

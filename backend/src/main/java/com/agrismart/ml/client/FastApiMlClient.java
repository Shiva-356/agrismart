package com.agrismart.ml.client;

import com.agrismart.dto.recommendation.RankedCropResponse;
import com.agrismart.exception.MlServiceException;
import com.agrismart.ml.dto.MlPredictionRequest;
import com.agrismart.ml.dto.MlPredictionResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * Spring RestClient implementation calling the FastAPI inference service.
 *
 * Never fabricates predictions or falls back to synthetic data.
 * Propagates explicit ML_SERVICE_UNAVAILABLE and ML_SERVICE_INVALID_RESPONSE errors.
 */
@Component
public class FastApiMlClient implements MlPredictionClient {

    private static final Logger log = LoggerFactory.getLogger(FastApiMlClient.class);

    private final RestClient mlRestClient;

    public FastApiMlClient(RestClient mlRestClient) {
        this.mlRestClient = mlRestClient;
    }

    @Override
    public MlPredictionResponse predict(MlPredictionRequest request) {
        if (request == null || !request.isComplete()) {
            throw new IllegalArgumentException("ML prediction request cannot be null or have incomplete features");
        }

        FastApiPredictRequest apiRequest = new FastApiPredictRequest(
                request.n(),
                request.p(),
                request.k(),
                request.temperature(),
                request.humidity(),
                request.ph(),
                request.rainfall()
        );

        try {
            FastApiPredictResponse response = mlRestClient.post()
                    .uri("/predict")
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(apiRequest)
                    .retrieve()
                    .onStatus(HttpStatusCode::isError, (req, resp) -> {
                        String body = "";
                        try {
                            body = new String(resp.getBody().readAllBytes(), StandardCharsets.UTF_8);
                        } catch (Exception ignored) {
                        }
                        log.error("FastAPI ML service error {}: {}", resp.getStatusCode(), body);

                        if (resp.getStatusCode().value() == 503) {
                            throw new MlServiceException("ML_SERVICE_UNAVAILABLE", "ML model service unavailable: " + body);
                        }
                        throw new MlServiceException("ML_SERVICE_INVALID_RESPONSE", "ML service returned error " + resp.getStatusCode() + ": " + body);
                    })
                    .body(FastApiPredictResponse.class);

            if (response == null || response.crop() == null || response.crop().isBlank()) {
                throw new MlServiceException("ML_SERVICE_INVALID_RESPONSE", "FastAPI ML service returned empty or invalid crop prediction");
            }

            List<RankedCropResponse> ranked = response.ranked() != null
                    ? response.ranked().stream()
                            .filter(r -> r != null && r.crop() != null && !r.crop().isBlank() && r.probability() != null)
                            .map(r -> new RankedCropResponse(r.crop(), r.probability()))
                            .toList()
                    : List.of();

            return new MlPredictionResponse(
                    response.crop(),
                    ranked,
                    response.model(),
                    response.featuresUsed(),
                    response.classCount(),
                    response.note()
            );
        } catch (MlServiceException e) {
            throw e;
        } catch (ResourceAccessException e) {
            log.error("Unable to connect to FastAPI ML service", e);
            throw new MlServiceException("ML_SERVICE_UNAVAILABLE", "Unable to connect to ML service: " + e.getMessage(), e);
        } catch (RestClientException e) {
            log.error("REST client error while invoking FastAPI ML service", e);
            throw new MlServiceException("ML_SERVICE_INVALID_RESPONSE", "Error communicating with ML service: " + e.getMessage(), e);
        } catch (Exception e) {
            log.error("Unexpected error invoking FastAPI ML service", e);
            throw new MlServiceException("ML_SERVICE_UNAVAILABLE", "Unexpected failure invoking ML service: " + e.getMessage(), e);
        }
    }
}

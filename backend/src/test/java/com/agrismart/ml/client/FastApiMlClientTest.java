package com.agrismart.ml.client;

import com.agrismart.exception.MlServiceException;
import com.agrismart.ml.dto.MlPredictionRequest;
import com.agrismart.ml.dto.MlPredictionResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class FastApiMlClientTest {

    private MockRestServiceServer mockServer;
    private FastApiMlClient mlClient;

    private final MlPredictionRequest validRequest = new MlPredictionRequest(
            90.0,
            42.0,
            43.0,
            26.5,
            78.0,
            6.5,
            185.0
    );

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://localhost:8000");
        mockServer = MockRestServiceServer.bindTo(builder).build();
        RestClient restClient = builder.build();
        mlClient = new FastApiMlClient(restClient);
    }

    @Test
    @DisplayName("Requirement 11: FastAPI success response mapped correctly with ranked crops and metadata")
    void predictWithValidRequestMapsSuccessResponseCorrectly() {
        String fastApiResponseJson = """
                {
                  "crop": "rice",
                  "ranked": [
                    {"crop": "rice", "probability": 0.88},
                    {"crop": "jute", "probability": 0.08},
                    {"crop": "maize", "probability": 0.02}
                  ],
                  "model": "Random Forest",
                  "featuresUsed": ["N", "P", "K", "temperature", "humidity", "ph", "rainfall"],
                  "classCount": 22,
                  "note": "Probability is the model's estimate on the benchmark dataset, not a field guarantee."
                }
                """;

        mockServer.expect(requestTo("http://localhost:8000/predict"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("Content-Type", MediaType.APPLICATION_JSON_VALUE))
                .andExpect(jsonPath("$.N").value(90.0))
                .andExpect(jsonPath("$.P").value(42.0))
                .andExpect(jsonPath("$.K").value(43.0))
                .andExpect(jsonPath("$.temperature").value(26.5))
                .andExpect(jsonPath("$.humidity").value(78.0))
                .andExpect(jsonPath("$.ph").value(6.5))
                .andExpect(jsonPath("$.rainfall").value(185.0))
                .andRespond(withSuccess(fastApiResponseJson, MediaType.APPLICATION_JSON));

        MlPredictionResponse response = mlClient.predict(validRequest);

        mockServer.verify();

        assertThat(response).isNotNull();
        assertThat(response.crop()).isEqualTo("rice");
        assertThat(response.model()).isEqualTo("Random Forest");
        assertThat(response.classCount()).isEqualTo(22);
        assertThat(response.rankedCrops()).hasSize(3);
        assertThat(response.rankedCrops().get(0).crop()).isEqualTo("rice");
        assertThat(response.rankedCrops().get(0).probability()).isEqualTo(0.88);
        assertThat(response.featuresUsed()).containsExactly("N", "P", "K", "temperature", "humidity", "ph", "rainfall");
        assertThat(response.note()).contains("benchmark dataset");
    }

    @Test
    @DisplayName("Requirement 12a: FastAPI 503 error throws explicit ML_SERVICE_UNAVAILABLE, no fake crop")
    void predictWhenServiceUnavailableReturns503ThrowsMlServiceExceptionUnavailable() {
        mockServer.expect(requestTo("http://localhost:8000/predict"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE)
                        .body("{\"detail\":\"model.joblib missing - run python ml/train.py\"}"));

        assertThatThrownBy(() -> mlClient.predict(validRequest))
                .isInstanceOf(MlServiceException.class)
                .satisfies(e -> {
                    MlServiceException ex = (MlServiceException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("ML_SERVICE_UNAVAILABLE");
                    assertThat(ex.getMessage()).contains("model.joblib missing");
                });

        mockServer.verify();
    }

    @Test
    @DisplayName("Requirement 12b: FastAPI 500 error throws ML_SERVICE_INVALID_RESPONSE")
    void predictWhenInternalServerErrorThrowsMlServiceInvalidResponse() {
        mockServer.expect(requestTo("http://localhost:8000/predict"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body("{\"detail\":\"Internal server error in model inference\"}"));

        assertThatThrownBy(() -> mlClient.predict(validRequest))
                .isInstanceOf(MlServiceException.class)
                .satisfies(e -> {
                    MlServiceException ex = (MlServiceException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("ML_SERVICE_INVALID_RESPONSE");
                });

        mockServer.verify();
    }

    @Test
    @DisplayName("Requirement 13: FastAPI response with missing or blank crop throws ML_SERVICE_INVALID_RESPONSE")
    void predictWhenResponseMissingCropThrowsMlServiceInvalidResponse() {
        String invalidResponseJson = """
                {
                  "crop": "",
                  "ranked": [],
                  "model": "Random Forest",
                  "featuresUsed": [],
                  "classCount": 0
                }
                """;

        mockServer.expect(requestTo("http://localhost:8000/predict"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(invalidResponseJson, MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> mlClient.predict(validRequest))
                .isInstanceOf(MlServiceException.class)
                .satisfies(e -> {
                    MlServiceException ex = (MlServiceException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("ML_SERVICE_INVALID_RESPONSE");
                    assertThat(ex.getMessage()).contains("empty or invalid crop prediction");
                });

        mockServer.verify();
    }

    @Test
    @DisplayName("Incomplete request rejected before calling FastAPI")
    void predictWithIncompleteRequestThrowsIllegalArgumentException() {
        MlPredictionRequest incompleteRequest = new MlPredictionRequest(
                null, 42.0, 43.0, 26.5, 78.0, 6.5, 185.0
        );

        assertThatThrownBy(() -> mlClient.predict(incompleteRequest))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("incomplete features");
    }
}

package com.agrismart.ml.client;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/**
 * Configuration for the FastAPI ML RestClient.
 *
 * Configures the base URL from the AGRISMART_ML_API_URL environment variable
 * and sets connection and read timeouts.
 */
@Configuration
public class MlClientConfig {

    @Bean
    public RestClient mlRestClient(
            @Value("${agrismart.ml.api-url:http://localhost:8000}") String mlApiUrl,
            @Value("${agrismart.ml.connect-timeout-seconds:3}") int connectTimeoutSeconds,
            @Value("${agrismart.ml.read-timeout-seconds:5}") int readTimeoutSeconds
    ) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(connectTimeoutSeconds * 1000);
        requestFactory.setReadTimeout(readTimeoutSeconds * 1000);

        return RestClient.builder()
                .baseUrl(mlApiUrl)
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }
}

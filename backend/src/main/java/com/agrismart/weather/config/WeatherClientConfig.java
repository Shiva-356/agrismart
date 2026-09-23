package com.agrismart.weather.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/**
 * Spring configuration providing RestClient beans for Open-Meteo weather and geocoding services.
 *
 * Configures connection and read timeouts and default JSON accept headers.
 */
@Configuration
public class WeatherClientConfig {

    @Bean
    public RestClient weatherRestClient(
            @Value("${agrismart.weather.base-url:https://api.open-meteo.com}") String baseUrl,
            @Value("${agrismart.weather.connect-timeout-seconds:3}") int connectTimeoutSeconds,
            @Value("${agrismart.weather.read-timeout-seconds:5}") int readTimeoutSeconds
    ) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(connectTimeoutSeconds * 1000);
        requestFactory.setReadTimeout(readTimeoutSeconds * 1000);

        return RestClient.builder()
                .baseUrl(baseUrl)
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    @Bean
    public RestClient geocodingRestClient(
            @Value("${agrismart.weather.geocoding-base-url:https://geocoding-api.open-meteo.com}") String geocodingBaseUrl,
            @Value("${agrismart.weather.connect-timeout-seconds:3}") int connectTimeoutSeconds,
            @Value("${agrismart.weather.read-timeout-seconds:5}") int readTimeoutSeconds
    ) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(connectTimeoutSeconds * 1000);
        requestFactory.setReadTimeout(readTimeoutSeconds * 1000);

        return RestClient.builder()
                .baseUrl(geocodingBaseUrl)
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }
}

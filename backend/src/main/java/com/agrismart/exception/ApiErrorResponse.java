package com.agrismart.exception;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.Map;

/**
 * Standardized JSON error response payload for all AgriSmart API errors.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiErrorResponse(
        @JsonProperty("timestamp") String timestamp,
        @JsonProperty("status") int status,
        @JsonProperty("error") String error,
        @JsonProperty("message") String message,
        @JsonProperty("path") String path,
        @JsonProperty("fieldErrors") Map<String, String> fieldErrors,
        @JsonProperty("validationErrors") Map<String, String> validationErrors
) {
    public ApiErrorResponse(String timestamp, int status, String error, String message, String path, Map<String, String> fieldErrors) {
        this(timestamp, status, error, message, path, fieldErrors, fieldErrors);
    }

    public static ApiErrorResponse of(int status, String error, String message, String path) {
        return new ApiErrorResponse(Instant.now().toString(), status, error, message, path, null, null);
    }

    public static ApiErrorResponse ofValidation(int status, String error, String message, String path, Map<String, String> fieldErrors) {
        return new ApiErrorResponse(Instant.now().toString(), status, error, message, path, fieldErrors, fieldErrors);
    }
}

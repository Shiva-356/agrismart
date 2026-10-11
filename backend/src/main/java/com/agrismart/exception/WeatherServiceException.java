package com.agrismart.exception;

/**
 * Exception thrown when weather integration fails, including provider communication failures,
 * malformed provider payloads, or missing required weather measurements.
 */
public class WeatherServiceException extends RuntimeException {

    private final String errorCode;

    public WeatherServiceException(String errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    public WeatherServiceException(String errorCode, String message, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode;
    }

    public String getErrorCode() {
        return errorCode;
    }
}

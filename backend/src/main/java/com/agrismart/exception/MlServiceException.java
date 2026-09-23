package com.agrismart.exception;

/**
 * Thrown when communicating with the FastAPI ML model service fails or returns an invalid response.
 */
public class MlServiceException extends RuntimeException {

    private final String errorCode;

    public MlServiceException(String errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    public MlServiceException(String errorCode, String message, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode;
    }

    public String getErrorCode() {
        return errorCode;
    }
}

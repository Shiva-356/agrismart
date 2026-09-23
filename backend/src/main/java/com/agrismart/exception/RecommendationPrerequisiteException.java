package com.agrismart.exception;

/**
 * Thrown when prerequisites for generating a crop recommendation are not satisfied
 * (e.g. no verified soil report, incomplete soil measurements, or incomplete weather observation).
 */
public class RecommendationPrerequisiteException extends RuntimeException {

    private final String errorCode;

    public RecommendationPrerequisiteException(String errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    public String getErrorCode() {
        return errorCode;
    }
}

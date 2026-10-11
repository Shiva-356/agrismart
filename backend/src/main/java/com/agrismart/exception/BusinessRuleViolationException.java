package com.agrismart.exception;

/**
 * Thrown when a request is syntactically valid but violates a domain invariant
 * (e.g. attempting to book with a provider not accepting samples).
 * Results in HTTP 422 Unprocessable Entity.
 */
public class BusinessRuleViolationException extends RuntimeException {
    public BusinessRuleViolationException(String message) {
        super(message);
    }
}

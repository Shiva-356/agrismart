package com.agrismart.exception;

/**
 * Thrown when an illegal lifecycle state transition is attempted on an appointment.
 * Results in HTTP 409 Conflict.
 */
public class InvalidStatusTransitionException extends RuntimeException {
    public InvalidStatusTransitionException(String message) {
        super(message);
    }
}

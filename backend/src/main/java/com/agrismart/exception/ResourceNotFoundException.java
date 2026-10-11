package com.agrismart.exception;

/**
 * Thrown when a requested resource (e.g. Farm, Provider, Appointment) does not exist.
 * Results in HTTP 404 Not Found.
 */
public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String message) {
        super(message);
    }
}

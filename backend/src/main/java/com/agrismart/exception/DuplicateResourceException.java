package com.agrismart.exception;

/**
 * Thrown when an entity creation or update conflicts with an existing resource
 * (e.g. attempting to create a user with an already registered email).
 * Results in HTTP 409 Conflict.
 */
public class DuplicateResourceException extends RuntimeException {
    public DuplicateResourceException(String message) {
        super(message);
    }
}

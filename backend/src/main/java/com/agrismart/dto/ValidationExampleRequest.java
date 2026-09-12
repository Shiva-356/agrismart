package com.agrismart.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/**
 * Example DTO establishing Jakarta Validation conventions for the AgriSmart backend.
 * Subsequent phase DTOs (Farm, Appointment, SoilReport, etc.) follow these conventions.
 */
public record ValidationExampleRequest(
        @NotBlank(message = "Name cannot be blank")
        @Size(min = 2, max = 100, message = "Name must be between 2 and 100 characters")
        String name,

        @NotBlank(message = "Email cannot be blank")
        @Email(message = "Email must be a valid email address")
        String email,

        @NotNull(message = "Land area is required")
        @Positive(message = "Land area must be greater than zero")
        Double landAreaAcres,

        @NotNull(message = "Budget is required")
        @PositiveOrZero(message = "Budget must be zero or positive")
        Double budget
) {
}

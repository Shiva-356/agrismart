package com.agrismart.dto.provider;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateProviderRequest(
        @NotBlank(message = "Provider name is required")
        @Size(max = 255, message = "Name must not exceed 255 characters")
        String name,

        @NotBlank(message = "Provider type is required")
        @Size(max = 100, message = "Type must not exceed 100 characters")
        String type,

        @NotBlank(message = "Address is required")
        String address,

        @Pattern(regexp = "^$|^[+0-9\\-\\s()]{7,25}$", message = "Phone number must be a valid format")
        String phone,

        @NotNull(message = "Verified status is required")
        Boolean verified,

        @NotNull(message = "Accepting samples status is required")
        Boolean acceptingSamples,

        @DecimalMin(value = "-90.0", message = "Latitude must be >= -90.0")
        @DecimalMax(value = "90.0", message = "Latitude must be <= 90.0")
        Double latitude,

        @DecimalMin(value = "-180.0", message = "Longitude must be >= -180.0")
        @DecimalMax(value = "180.0", message = "Longitude must be <= 180.0")
        Double longitude,

        @Size(max = 255, message = "Opening hours must not exceed 255 characters")
        String openingHours,

        @Min(value = 1, message = "Report turnaround days must be at least 1")
        @Max(value = 60, message = "Report turnaround days must not exceed 60")
        Integer reportTimeDays
) {
}

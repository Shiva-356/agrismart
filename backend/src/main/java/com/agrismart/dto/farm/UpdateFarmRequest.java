package com.agrismart.dto.farm;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.UUID;

public record UpdateFarmRequest(
        UUID userId,

        @NotBlank(message = "Farm name is required")
        @Size(max = 255, message = "Farm name must not exceed 255 characters")
        String name,

        @NotBlank(message = "Location is required")
        @Size(max = 255, message = "Location must not exceed 255 characters")
        String location,

        @NotBlank(message = "District is required")
        @Size(max = 255, message = "District must not exceed 255 characters")
        String district,

        @NotNull(message = "Land area in acres is required")
        @DecimalMin(value = "0.01", message = "Land area must be greater than 0")
        BigDecimal landAreaAcres,

        @Size(max = 255, message = "Current crop must not exceed 255 characters")
        String currentCrop,

        @NotBlank(message = "Irrigation method is required")
        @Size(max = 255, message = "Irrigation method must not exceed 255 characters")
        String irrigation
) {
    public UpdateFarmRequest(
            String name,
            String location,
            String district,
            BigDecimal landAreaAcres,
            String currentCrop,
            String irrigation
    ) {
        this(null, name, location, district, landAreaAcres, currentCrop, irrigation);
    }
}

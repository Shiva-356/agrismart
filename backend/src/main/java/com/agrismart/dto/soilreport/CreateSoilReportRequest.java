package com.agrismart.dto.soilreport;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Request payload for creating an authentic laboratory soil report.
 *
 * Notice: This request does NOT contain a 'verified' field. All newly created
 * reports start with verified = false.
 *
 * Chemical and physical measurements are optional (nullable). Missing measurements
 * must never be defaulted to zero or fabricated. If provided, values are bounded
 * against physically impossible values (e.g. negative numbers, pH outside 0.0 - 14.0).
 */
public record CreateSoilReportRequest(
        @NotNull(message = "Farm ID is required")
        UUID farmId,

        UUID appointmentId,

        @NotBlank(message = "Laboratory name is required")
        @Size(max = 255, message = "Laboratory name must not exceed 255 characters")
        String laboratoryName,

        @Size(max = 100, message = "Sample ID must not exceed 100 characters")
        String sampleId,

        @NotNull(message = "Test date is required")
        @PastOrPresent(message = "Test date cannot be in the future")
        LocalDate testDate,

        @DecimalMin(value = "0.0", inclusive = true, message = "Nitrogen cannot be negative")
        BigDecimal nitrogen,

        @DecimalMin(value = "0.0", inclusive = true, message = "Phosphorus cannot be negative")
        BigDecimal phosphorus,

        @DecimalMin(value = "0.0", inclusive = true, message = "Potassium cannot be negative")
        BigDecimal potassium,

        @DecimalMin(value = "0.0", inclusive = true, message = "pH cannot be below 0.0")
        @DecimalMax(value = "14.0", inclusive = true, message = "pH cannot exceed 14.0")
        BigDecimal ph,

        @DecimalMin(value = "0.0", inclusive = true, message = "Electrical conductivity cannot be negative")
        BigDecimal electricalConductivity,

        @DecimalMin(value = "0.0", inclusive = true, message = "Organic carbon cannot be negative")
        BigDecimal organicCarbon,

        @Size(max = 2000, message = "Notes must not exceed 2000 characters")
        String notes
) {
}

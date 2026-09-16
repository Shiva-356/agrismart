package com.agrismart.dto.soilreport;

import jakarta.validation.constraints.Size;

/**
 * Optional request payload when verifying a soil report.
 * Verification indicates that an authorized laboratory or administrative workflow
 * has explicitly reviewed and confirmed the report.
 */
public record VerifySoilReportRequest(
        @Size(max = 1000, message = "Remarks cannot exceed 1000 characters")
        String remarks
) {
}

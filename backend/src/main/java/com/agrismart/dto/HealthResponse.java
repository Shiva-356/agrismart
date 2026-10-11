package com.agrismart.dto;

/**
 * Health response DTO for the general service health check.
 */
public record HealthResponse(
        String status,
        String service
) {
    public static HealthResponse ok() {
        return new HealthResponse("ok", "agrismart-backend");
    }
}

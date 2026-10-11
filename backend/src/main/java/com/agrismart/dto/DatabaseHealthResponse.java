package com.agrismart.dto;

/**
 * Health response DTO reporting truthful database connectivity.
 */
public record DatabaseHealthResponse(
        String status,
        String database,
        String url,
        String message
) {
    public static DatabaseHealthResponse connected(String url, String databaseProductName) {
        return new DatabaseHealthResponse("UP", databaseProductName, url, "Database connection established successfully");
    }

    public static DatabaseHealthResponse disconnected(String url, String failureReason) {
        return new DatabaseHealthResponse("DOWN", "PostgreSQL", url, "Database is unreachable: " + failureReason);
    }
}

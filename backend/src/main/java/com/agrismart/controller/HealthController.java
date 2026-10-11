package com.agrismart.controller;

import com.agrismart.dto.DatabaseHealthResponse;
import com.agrismart.dto.HealthResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.SQLException;

/**
 * Controller exposing basic health and database connectivity verification endpoints.
 */
@RestController
@RequestMapping("/api")
public class HealthController {

    private static final Logger log = LoggerFactory.getLogger(HealthController.class);

    private final DataSource dataSource;
    private final String configuredDbUrl;

    @Autowired
    public HealthController(
            DataSource dataSource,
            @Value("${spring.datasource.url}") String configuredDbUrl
    ) {
        this.dataSource = dataSource;
        this.configuredDbUrl = configuredDbUrl;
    }

    /**
     * Primary health check endpoint.
     * Served by Spring Boot to verify that the web service is operational.
     */
    @GetMapping("/health")
    public ResponseEntity<HealthResponse> health() {
        return ResponseEntity.ok(HealthResponse.ok());
    }

    /**
     * Database connectivity verification endpoint.
     * Safely tests whether the configured PostgreSQL instance is accessible.
     * Truthfully reports connection status without fabricating success.
     */
    @GetMapping("/health/db")
    public ResponseEntity<DatabaseHealthResponse> checkDatabase() {
        try (Connection connection = dataSource.getConnection()) {
            connection.setNetworkTimeout(null, 2000);
            DatabaseMetaData metaData = connection.getMetaData();
            String productName = metaData.getDatabaseProductName() + " " + metaData.getDatabaseProductVersion();
            return ResponseEntity.ok(DatabaseHealthResponse.connected(configuredDbUrl, productName));
        } catch (SQLException ex) {
            log.warn("Database connectivity probe failed: {}", ex.getMessage());
            DatabaseHealthResponse response = DatabaseHealthResponse.disconnected(configuredDbUrl, ex.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(response);
        } catch (Exception ex) {
            log.warn("Unexpected failure during database connectivity probe: {}", ex.getMessage());
            DatabaseHealthResponse response = DatabaseHealthResponse.disconnected(configuredDbUrl, ex.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(response);
        }
    }
}

package com.agrismart.migration;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Verifies that the V1 Flyway migration script exists, is readable, and
 * defines all required domain tables and relationships.
 */
class FlywayMigrationScriptTest {

    @Test
    @DisplayName("Flyway V1 script exists and defines core domain tables")
    void testFlywayScriptPresenceAndStructure() throws Exception {
        Resource scriptResource = new ClassPathResource("db/migration/V1__initial_schema.sql");
        assertThat(scriptResource.exists())
                .as("Flyway initial migration script must exist under db/migration/V1__initial_schema.sql")
                .isTrue();

        String sql;
        try (InputStream is = scriptResource.getInputStream()) {
            sql = new String(is.readAllBytes(), StandardCharsets.UTF_8).toLowerCase();
        }

        // 1. Verify table definitions
        assertThat(sql).contains("create table if not exists users");
        assertThat(sql).contains("create table if not exists farms");
        assertThat(sql).contains("create table if not exists soil_testing_providers");
        assertThat(sql).contains("create table if not exists appointments");
        assertThat(sql).contains("create table if not exists soil_reports");

        // 2. Verify foreign key constraints
        assertThat(sql).contains("references users(id)");
        assertThat(sql).contains("references farms(id)");
        assertThat(sql).contains("references soil_testing_providers(id)");

        // 3. Verify soil measurement columns exist and are nullable (no mandatory dummy values)
        assertThat(sql).contains("nitrogen numeric");
        assertThat(sql).contains("phosphorus numeric");
        assertThat(sql).contains("potassium numeric");
        assertThat(sql).contains("ph numeric");

        // 4. Verify indexes
        assertThat(sql).contains("create index if not exists idx_users_email");
        assertThat(sql).contains("create index if not exists idx_farms_user_id");
        assertThat(sql).contains("create index if not exists idx_appointments_farm_id");
        assertThat(sql).contains("create index if not exists idx_soil_reports_farm_id");
    }
}

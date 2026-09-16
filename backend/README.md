# AgriSmart — Spring Boot Backend

Backend service foundation for the AgriSmart AI-Powered Smart Farming Recommendation and Soil Intelligence Platform.

---

## 1. Purpose

The Spring Boot backend acts as the core business logic, persistence, and orchestration engine for AgriSmart:

- Serves REST APIs for the React/TanStack frontend.
- Connects to PostgreSQL for persistent domain data (farms, soil test appointments, soil health reports, recommendations).
- Orchestrates recommendation pipelines by calling the FastAPI ML inference service via `CropMLClientService` (scheduled for Phase 4B-3).

---

## 2. Technical Stack

- **Language:** Java 17 (LTS)
- **Framework:** Spring Boot 3.3.5
- **Build Tool:** Apache Maven 3.9+
- **Database Engine:** PostgreSQL 15+ (Runtime Driver: `org.postgresql:postgresql`)
- **ORM / Persistence:** Spring Data JPA / Hibernate 6.5
- **Validation:** Jakarta Validation (`spring-boot-starter-validation`)
- **Testing:** Spring Boot Test (`spring-boot-starter-test`, JUnit 5, MockMvc)

---

## 3. Package Structure

```
com.agrismart
├── AgriSmartApplication.java       # Main Spring Boot application entrypoint
├── config/
│   └── CorsConfig.java             # Explicit CORS policy configuration
├── controller/
│   ├── HealthController.java       # Service & database health endpoints
│   ├── ProviderController.java     # REST API for soil testing providers
│   ├── AppointmentController.java  # REST API for booking & appointment lifecycle
│   └── SoilReportController.java   # REST API for authentic soil report ingestion & queries
├── dto/
│   ├── HealthResponse.java         # DTO for service health
│   ├── DatabaseHealthResponse.java # DTO for database connectivity health
│   ├── ValidationExampleRequest.java # Example DTO demonstrating validation conventions
│   ├── provider/
│   │   ├── CreateProviderRequest.java
│   │   ├── UpdateProviderRequest.java
│   │   ├── ProviderResponse.java
│   │   └── ProviderSummaryResponse.java
│   ├── appointment/
│   │   ├── CreateAppointmentRequest.java
│   │   ├── UpdateAppointmentStatusRequest.java
│   │   ├── CancelAppointmentRequest.java
│   │   ├── AppointmentResponse.java
│   │   └── FarmSummaryResponse.java
│   └── soilreport/
│       ├── CreateSoilReportRequest.java
│       ├── VerifySoilReportRequest.java
│       ├── SoilMeasurementAvailability.java
│       ├── SoilReportResponse.java
│       └── SoilReportSummaryResponse.java
├── entity/
│   ├── User.java                   # Core account entity
│   ├── Farm.java                   # Farmer land parcel entity
│   ├── SoilTestingProvider.java    # Lab & testing provider entity
│   ├── Appointment.java            # Appointment booking & status entity
│   ├── AppointmentStatus.java      # Controlled appointment lifecycle enum
│   ├── AppointmentMethod.java      # Sample collection method enum
│   └── SoilReport.java             # Authentic lab soil test report entity
├── exception/
│   ├── ApiErrorResponse.java       # Uniform error payload schema
│   ├── GlobalExceptionHandler.java # @RestControllerAdvice for consistent JSON errors
│   ├── ResourceNotFoundException.java # HTTP 404 handler
│   ├── InvalidStatusTransitionException.java # HTTP 409 handler
│   └── BusinessRuleViolationException.java # HTTP 422 handler
├── repository/
│   ├── UserRepository.java         # Spring Data JPA User repository
│   ├── FarmRepository.java         # Spring Data JPA Farm repository
│   ├── SoilTestingProviderRepository.java # Provider repository with JpaSpecificationExecutor
│   ├── AppointmentRepository.java  # Appointment repository with JpaSpecificationExecutor
│   └── SoilReportRepository.java   # Soil report repository with ordered queries
└── service/
    ├── ProviderService.java        # Provider domain business logic & filtering
    ├── AppointmentService.java     # Appointment lifecycle state machine & bookings
    └── SoilReportService.java      # Soil report write-once persistence & verification
```

Resources:
```
src/main/resources/
├── application.yml
└── db/migration/
    └── V1__initial_schema.sql      # Flyway initial schema definition
```

---

## 4. Environment Variables & Configuration

The application reads configuration from `src/main/resources/application.yml` with support for environment overrides:

| Variable         | Default Value                                 | Description                                                           |
| :--------------- | :-------------------------------------------- | :-------------------------------------------------------------------- |
| `SERVER_PORT`    | `8080`                                        | Port on which the Spring Boot Tomcat server listens                   |
| `DB_URL`         | `jdbc:postgresql://localhost:5432/agrismart`  | PostgreSQL JDBC connection URL                                        |
| `DB_USERNAME`    | `postgres`                                    | Database username                                                     |
| `DB_PASSWORD`    | `postgres`                                    | Database password                                                     |
| `JPA_DDL_AUTO`   | `validate`                                    | DDL schema mode (`validate` when Flyway manages migrations)           |
| `FLYWAY_ENABLED` | `true`                                        | Enable or disable Flyway database migration runs                      |
| `FRONTEND_URL`   | `http://localhost:3000,http://localhost:5173` | Allowed CORS origins for the frontend application                     |

---

## 5. PostgreSQL Database Setup

For full operational functionality, ensure PostgreSQL is running and the database exists:

```sql
CREATE DATABASE agrismart;
```

If PostgreSQL is not running locally, the application can still start cleanly and serve `/api/health`. The `/api/health/db` endpoint will truthfully report database status (`UP` or `DOWN`) without crashing startup.

---

## 6. Maven Commands

From the `backend/` directory:

### Run Tests

```bash
mvn clean test
```

### Compile and Package JAR

```bash
mvn clean package
```

### Run Spring Boot Application

```bash
mvn spring-boot:run
```

Or run the packaged JAR directly:

```bash
java -jar target/agrismart-backend-0.0.1-SNAPSHOT.jar
```

---

## 7. Health & Verification Endpoints

### 1. General Service Health

```http
GET /api/health
```

**Response (200 OK):**

```json
{
  "status": "ok",
  "service": "agrismart-backend"
}
```

### 2. Database Connectivity Health

```http
GET /api/health/db
```

- **When PostgreSQL is connected (200 OK):**
  ```json
  {
    "status": "UP",
    "database": "PostgreSQL 16.0",
    "url": "jdbc:postgresql://localhost:5432/agrismart",
    "message": "Database connection established successfully"
  }
  ```
- **When PostgreSQL is unreachable (503 Service Unavailable):**
  ```json
  {
    "status": "DOWN",
    "database": "PostgreSQL",
    "url": "jdbc:postgresql://localhost:5432/agrismart",
    "message": "Database is unreachable: Connection refused..."
  }
  ```

---

## 8. Error Response Convention

All errors returned by the backend adhere to the standardized schema:

```json
{
  "timestamp": "2026-09-12T12:38:48.322Z",
  "status": 400,
  "error": "VALIDATION_ERROR",
  "message": "Request validation failed for one or more fields",
  "path": "/api/...",
  "fieldErrors": {
    "name": "Name cannot be blank",
    "email": "Email must be a valid email address"
  }
}
```

---

## 9. Current Status & Limitations (Phase 4B-2C Complete)

- **Completed in Phase 4B-2A, 4B-2B, & 4B-2C:**
  - JPA entities and repositories for `User`, `Farm`, `SoilTestingProvider`, `Appointment`, and `SoilReport`.
  - Flyway migration `V1__initial_schema.sql` defining PostgreSQL tables, foreign keys, and indexes.
  - Strict domain rule: soil chemical values (N, P, K, pH, EC, OC) remain null unless genuinely reported; zero values are never substituted.
  - Zero fabricated seed records.
  - REST controllers, services, and Java 17 record DTOs for `SoilTestingProvider`, `Appointment`, and `SoilReport`.
  - Write-once immutability for soil reports (no arbitrary measurement updates, no DELETE endpoints).
  - Controlled lifecycle state machine for appointments with terminal status protection and 409 conflict responses.
  - Atomic synchronization: creating a soil report for an appointment in `TESTING` status automatically advances it to `REPORT_READY`.
  - Explicit verification workflow via `PATCH /api/soil-reports/{id}/verify` (new reports default strictly to `verified = false`).
  - Diagnostic `SoilMeasurementAvailability` payload distinguishing present vs missing measurements and isolating `isMlFeatureReady`.
- **Pending Future Phases:**
  - **Authentication / Security:** Spring Security and JWT are not yet configured (planned for subsequent phase).
  - **ML Integration:** `CropMLClientService` calling FastAPI `POST /predict` is planned for Phase 4B-3.

---

## 10. Future Integration Plan (Phase 4B-3)

1. **Phase 4B-3 (ML Recommendation Pipeline):**
   - Implement `CropMLClientService` using Spring's `RestClient` to invoke FastAPI `POST /predict`.
   - Implement the recommendation pipeline combining verified soil reports (N, P, K, pH) with real-time weather features to query crop predictions.

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
│   ├── UserController.java         # REST API for user registration and queries
│   ├── FarmController.java         # REST API for farm plots and ownership filtering
│   ├── ProviderController.java     # REST API for soil testing providers
│   ├── AppointmentController.java  # REST API for booking & appointment lifecycle
│   └── SoilReportController.java   # REST API for authentic soil report ingestion & queries
├── dto/
│   ├── HealthResponse.java         # DTO for service health
│   ├── DatabaseHealthResponse.java # DTO for database connectivity health
│   ├── ValidationExampleRequest.java # Example DTO demonstrating validation conventions
│   ├── user/
│   │   ├── CreateUserRequest.java
│   │   └── UserResponse.java
│   ├── farm/
│   │   ├── CreateFarmRequest.java
│   │   ├── UpdateFarmRequest.java
│   │   └── FarmResponse.java
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
│   ├── BusinessRuleViolationException.java # HTTP 422 handler
│   ├── RecommendationPrerequisiteException.java # HTTP 422 handler for soil/weather prerequisite violations
│   └── MlServiceException.java     # HTTP 502/503 handler for ML service communication failures
├── ml/
│   ├── client/
│   │   ├── MlPredictionClient.java # Interface for ML crop prediction
│   │   ├── FastApiMlClient.java    # Spring RestClient implementation calling FastAPI POST /predict
│   │   ├── MlClientConfig.java     # Bean configuration with configurable timeouts and base URL
│   │   ├── FastApiPredictRequest.java  # Exact FastAPI schema mapping {N, P, K, temperature, humidity, ph, rainfall}
│   │   ├── FastApiPredictResponse.java # FastAPI response schema mapping {crop, ranked, model, featuresUsed, classCount, note}
│   │   └── FastApiRankedCrop.java  # Ranked crop candidate {crop, probability}
│   └── dto/
│       ├── MlPredictionRequest.java    # Internal domain 7-feature request
│       └── MlPredictionResponse.java   # Internal domain prediction response
├── weather/
│   └── WeatherObservation.java     # Weather boundary abstraction for Phase 4C-2 real weather input
├── repository/
│   ├── UserRepository.java         # Spring Data JPA User repository
│   ├── FarmRepository.java         # Spring Data JPA Farm repository
│   ├── SoilTestingProviderRepository.java # Provider repository with JpaSpecificationExecutor
│   ├── AppointmentRepository.java  # Appointment repository with JpaSpecificationExecutor
│   └── SoilReportRepository.java   # Soil report repository with ordered queries and verified top query
└── service/
    ├── UserService.java            # User creation, lookup, and email uniqueness checks
    ├── FarmService.java            # Farm registration, land validation, and ownership filtering
    ├── ProviderService.java        # Provider domain business logic & filtering
    ├── AppointmentService.java     # Appointment lifecycle state machine & bookings
    ├── SoilReportService.java      # Soil report write-once persistence & verification
    └── RecommendationService.java  # Verified soil report + weather ML orchestration engine
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
| `AGRISMART_ML_API_URL` | `http://localhost:8000`              | FastAPI ML inference service base URL                                 |
| `AGRISMART_ML_CONNECT_TIMEOUT_SECONDS` | `3`                   | Connection timeout in seconds when calling FastAPI ML service          |
| `AGRISMART_ML_READ_TIMEOUT_SECONDS` | `5`                      | Read timeout in seconds when calling FastAPI ML service                 |

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

## 9. Current Status & Limitations (Phase 4C-2 Complete)

- **Completed in Phase 4B-2A through Phase 4C-2:**
  - JPA entities and repositories for `User`, `Farm`, `SoilTestingProvider`, `Appointment`, and `SoilReport`.
  - Flyway migration `V1__initial_schema.sql` defining PostgreSQL tables, foreign keys, and indexes.
  - Strict domain rule: soil chemical values (N, P, K, pH, EC, OC) remain null unless genuinely reported; zero values are never substituted.
  - Zero fabricated seed records.
  - REST controllers, services, and Java 17 record DTOs for `User`, `Farm`, `SoilTestingProvider`, `Appointment`, `SoilReport`, and `Recommendation`.
  - **User API:** `POST /api/users` (with uniqueness check on email, 409 Conflict), `GET /api/users/{id}`, and `GET /api/users?email={email}`.
  - **Farm API:**
    - `POST /api/farms`: registers a farm parcel for a verified user (`userId` required, positive `landAreaAcres`, required `irrigation`).
    - `GET /api/farms`: lists all registered farms.
    - `GET /api/farms?userId={userId}`: filters farms by existing user ID (returns 404 if user does not exist).
    - `GET /api/farms/{id}`: retrieves a single farm by ID (returns 404 if absent).
    - `PUT /api/farms/{id}`: updates editable farm attributes while preventing changing the farm's owner.
  - Write-once immutability for soil reports (no arbitrary measurement updates, no DELETE endpoints).
  - Controlled lifecycle state machine for appointments with terminal status protection and 409 conflict responses.
  - Atomic synchronization: creating a soil report for an appointment in `TESTING` status automatically advances it to `REPORT_READY`.
  - Explicit verification workflow via `PATCH /api/soil-reports/{id}/verify` (new reports default strictly to `verified = false`).
  - Diagnostic `SoilMeasurementAvailability` payload distinguishing present vs missing measurements and isolating `isMlFeatureReady`.
  - **Phase 4C-1 (Real Soil Report → FastAPI ML Integration):**
    - `RecommendationService`: orchestrates retrieving the latest verified soil report for a farm, validates prerequisite presence of N/P/K/pH, accepts `WeatherObservation`, constructs the exact 7-feature vector, invokes `MlPredictionClient`, and maps the inference output to `RecommendationResponse`.
    - `FastApiMlClient`: Spring `RestClient` client connecting to FastAPI `POST /predict`. Strictly uses exact FastAPI JSON schema (`N`, `P`, `K`, `temperature`, `humidity`, `ph`, `rainfall`).
    - `WeatherObservation`: internal weather boundary abstraction (temperature, humidity, rainfall, observedAt, source). No placeholder or default weather values.
    - Deterministic repository query: `findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(UUID farmId)` guaranteeing that only verified laboratory reports are selected.
  - **Phase 4C-2 (Real Weather Integration):**
    - **Weather Provider Abstraction (`WeatherProvider`):** interface decoupled from specific vendor HTTP calls, returning genuine `WeatherObservation` (temperature, humidity, rainfall, observedAt, source).
    - **Concrete Provider (`OpenMeteoWeatherProvider`):** integrates with Open-Meteo's documented `/v1/forecast` endpoint. Strictly validates all measurements (`temperature_2m`, `relative_humidity_2m`, liquid `rain` / `precipitation`). Rejects NaN/Infinite/missing values. Never silently falls back to 0.0 mm rainfall.
    - **Location Resolver Abstraction (`LocationResolver`):** resolves farm textual location and district to validated `ResolvedLocation` (latitude, longitude, displayName).
    - **Concrete Resolver (`OpenMeteoLocationResolver`):** resolves location via Open-Meteo Geocoding API (`/v1/search`). Tries combined `${location}, ${district}` first, then `${district}`. If unresolvable, explicitly returns `WEATHER_LOCATION_UNRESOLVED` (never uses fabricated fallback coordinates).
    - **Weather Service (`WeatherService`):** orchestrates location resolution and weather retrieval via dependency inversion.
    - **High-level Recommendation Flow (`recommend(UUID farmId)`):** resolves location → fetches real-time weather → retrieves latest verified soil report → verifies all 7 features → calls FastAPI ML → returns `RecommendationResponse`.
    - **Recommendation API:**
      - `GET /api/farms/{farmId}/recommendation`: generates real-time recommendation using verified laboratory soil and live weather observations.
      - `POST /api/farms/{farmId}/recommendation`: generates recommendation with optional explicit weather observation (for simulation/testing).
    - **Explicit Prerequisite & Error Codes:**
      - `WEATHER_LOCATION_UNRESOLVED` (422): Farm location could not be reliably resolved to coordinates.
      - `WEATHER_DATA_UNAVAILABLE` (503): Weather service is unreachable or response lacks required measurements.
      - `WEATHER_FEATURES_INCOMPLETE` (422): Temperature, humidity, or rainfall measurement is missing or non-finite.
      - `NO_VERIFIED_SOIL_REPORT` (422): Farm does not have a laboratory-verified soil report.
      - `SOIL_FEATURES_INCOMPLETE` (422): Verified soil report is missing one of N, P, K, or pH.
      - `ML_SERVICE_UNAVAILABLE` (503): FastAPI ML microservice is unreachable or timed out.
      - `ML_SERVICE_INVALID_RESPONSE` (502): FastAPI ML microservice returned an invalid response.
- **Pending Future Phases:**
  - **Phase 4D:** Frontend weather and recommendation integration.
  - **Authentication / RBAC:** Real authentication, JWT tokens, and user identity session extraction from security context.

---

## 10. Weather Configuration & Environment Variables

| Variable | Description | Default |
|---|---|---|
| `WEATHER_PROVIDER` | Weather provider implementation identifier | `open-meteo` |
| `WEATHER_API_BASE_URL` | Base URL for weather observation API | `https://api.open-meteo.com` |
| `WEATHER_GEOCODING_BASE_URL` | Base URL for location geocoding API | `https://geocoding-api.open-meteo.com` |
| `WEATHER_API_KEY` | Optional API key for commercial weather services | *(empty)* |
| `WEATHER_CONNECT_TIMEOUT_SECONDS` | HTTP connection timeout for weather requests | `3` |
| `WEATHER_READ_TIMEOUT_SECONDS` | HTTP read timeout for weather requests | `5` |


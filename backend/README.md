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
│   └── HealthController.java       # Service & database health endpoints
├── dto/
│   ├── HealthResponse.java         # DTO for service health
│   ├── DatabaseHealthResponse.java # DTO for database connectivity health
│   └── ValidationExampleRequest.java # Example DTO demonstrating validation conventions
└── exception/
    ├── ApiErrorResponse.java       # Uniform error payload schema
    └── GlobalExceptionHandler.java # @RestControllerAdvice for consistent JSON errors
```

---

## 4. Environment Variables & Configuration

The application reads configuration from `src/main/resources/application.yml` with support for environment overrides:

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `SERVER_PORT` | `8080` | Port on which the Spring Boot Tomcat server listens |
| `DB_URL` | `jdbc:postgresql://localhost:5432/agrismart` | PostgreSQL JDBC connection URL |
| `DB_USERNAME` | `postgres` | Database username |
| `DB_PASSWORD` | `postgres` | Database password |
| `JPA_DDL_AUTO` | `update` | DDL schema mode (`update` for dev only; production should use Flyway) |
| `FRONTEND_URL` | `http://localhost:3000,http://localhost:5173` | Allowed CORS origins for the frontend application |

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

## 9. Current Limitations (Phase 4B-1 Scope)

- **Authentication / Security:** Spring Security and JWT are not yet configured (planned for subsequent phase).
- **Domain Entities:** JPA entities (`User`, `Farm`, `Provider`, `Appointment`, `SoilReport`, `Recommendation`) are not yet introduced to ensure isolation during foundation setup.
- **ML Integration:** `CropMLClientService` is not yet implemented in this phase.

---

## 10. Future Integration Plan (Phase 4B-2 & 4B-3)

1. **Phase 4B-2 (Domain Entities & Persistence):**
   - Implement JPA entities and repositories for users, farms, soil testing providers, appointments, and soil reports.
   - Introduce Flyway database migrations for production-ready schema evolution.
2. **Phase 4B-3 (ML Client & Business Logic):**
   - Implement `CropMLClientService` using Spring's `RestClient` / `WebClient` to invoke FastAPI `POST /predict`.
   - Implement the recommendation pipeline connecting soil reports to crop predictions.

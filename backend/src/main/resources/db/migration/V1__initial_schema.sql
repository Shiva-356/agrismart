-- AgriSmart Database Migration V1: Initial Core Domain Schema
-- Implements persistence foundation for User, Farm, SoilTestingProvider, Appointment, SoilReport

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    phone_number VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. Farms
CREATE TABLE IF NOT EXISTS farms (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    district VARCHAR(255) NOT NULL,
    land_area_acres NUMERIC(10, 2) NOT NULL,
    current_crop VARCHAR(100),
    irrigation VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_farms_user_id ON farms(user_id);
CREATE INDEX IF NOT EXISTS idx_farms_district ON farms(district);

-- 3. Soil Testing Providers
CREATE TABLE IF NOT EXISTS soil_testing_providers (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    phone VARCHAR(50),
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    accepting_samples BOOLEAN NOT NULL DEFAULT TRUE,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    opening_hours VARCHAR(255),
    report_time_days INTEGER,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_providers_verified ON soil_testing_providers(verified);

-- 4. Appointments
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY,
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES soil_testing_providers(id) ON DELETE RESTRICT,
    status VARCHAR(50) NOT NULL,
    method VARCHAR(50) NOT NULL,
    scheduled_date DATE NOT NULL,
    scheduled_time_slot VARCHAR(100) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_appointments_farm_id ON appointments(farm_id);
CREATE INDEX IF NOT EXISTS idx_appointments_provider_id ON appointments(provider_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_appointments_scheduled_date ON appointments(scheduled_date);

-- 5. Soil Reports
CREATE TABLE IF NOT EXISTS soil_reports (
    id UUID PRIMARY KEY,
    farm_id UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    laboratory_name VARCHAR(255) NOT NULL,
    sample_id VARCHAR(100),
    test_date DATE NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT FALSE,
    nitrogen NUMERIC(10, 2),
    phosphorus NUMERIC(10, 2),
    potassium NUMERIC(10, 2),
    ph NUMERIC(4, 2),
    electrical_conductivity NUMERIC(8, 2),
    organic_carbon NUMERIC(6, 2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_soil_reports_farm_id ON soil_reports(farm_id);
CREATE INDEX IF NOT EXISTS idx_soil_reports_test_date ON soil_reports(test_date);

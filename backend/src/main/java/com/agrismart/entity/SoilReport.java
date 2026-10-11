package com.agrismart.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

/**
 * Represents an authentic laboratory soil-testing report belonging to a farm.
 *
 * Measurements (nitrogen, phosphorus, potassium, pH, electrical conductivity, organic carbon)
 * default to null and must only be populated when genuine laboratory analysis results exist.
 * Missing measurements are never defaulted to zero or fabricated.
 */
@Entity
@Table(
    name = "soil_reports",
    indexes = {
        @Index(name = "idx_soil_reports_farm_id", columnList = "farm_id"),
        @Index(name = "idx_soil_reports_test_date", columnList = "test_date")
    }
)
public class SoilReport {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "farm_id", nullable = false)
    private Farm farm;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "appointment_id")
    private Appointment appointment;

    @Column(name = "laboratory_name", nullable = false)
    private String laboratoryName;

    @Column(name = "sample_id")
    private String sampleId;

    @Column(name = "test_date", nullable = false)
    private LocalDate testDate;

    @Column(name = "verified", nullable = false)
    private boolean verified;

    @Column(name = "nitrogen", precision = 10, scale = 2)
    private BigDecimal nitrogen;

    @Column(name = "phosphorus", precision = 10, scale = 2)
    private BigDecimal phosphorus;

    @Column(name = "potassium", precision = 10, scale = 2)
    private BigDecimal potassium;

    @Column(name = "ph", precision = 4, scale = 2)
    private BigDecimal ph;

    @Column(name = "electrical_conductivity", precision = 8, scale = 2)
    private BigDecimal electricalConductivity;

    @Column(name = "organic_carbon", precision = 6, scale = 2)
    private BigDecimal organicCarbon;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public SoilReport() {
    }

    public SoilReport(Farm farm, String laboratoryName, LocalDate testDate) {
        this.farm = farm;
        this.laboratoryName = laboratoryName;
        this.testDate = testDate;
        this.verified = false;
    }

    @PrePersist
    protected void onCreate() {
        Instant now = Instant.now();
        if (this.createdAt == null) {
            this.createdAt = now;
        }
        if (this.updatedAt == null) {
            this.updatedAt = now;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Farm getFarm() {
        return farm;
    }

    public void setFarm(Farm farm) {
        this.farm = farm;
    }

    public Appointment getAppointment() {
        return appointment;
    }

    public void setAppointment(Appointment appointment) {
        this.appointment = appointment;
    }

    public String getLaboratoryName() {
        return laboratoryName;
    }

    public void setLaboratoryName(String laboratoryName) {
        this.laboratoryName = laboratoryName;
    }

    public String getSampleId() {
        return sampleId;
    }

    public void setSampleId(String sampleId) {
        this.sampleId = sampleId;
    }

    public LocalDate getTestDate() {
        return testDate;
    }

    public void setTestDate(LocalDate testDate) {
        this.testDate = testDate;
    }

    public boolean isVerified() {
        return verified;
    }

    public void setVerified(boolean verified) {
        this.verified = verified;
    }

    public BigDecimal getNitrogen() {
        return nitrogen;
    }

    public void setNitrogen(BigDecimal nitrogen) {
        this.nitrogen = nitrogen;
    }

    public BigDecimal getPhosphorus() {
        return phosphorus;
    }

    public void setPhosphorus(BigDecimal phosphorus) {
        this.phosphorus = phosphorus;
    }

    public BigDecimal getPotassium() {
        return potassium;
    }

    public void setPotassium(BigDecimal potassium) {
        this.potassium = potassium;
    }

    public BigDecimal getPh() {
        return ph;
    }

    public void setPh(BigDecimal ph) {
        this.ph = ph;
    }

    public BigDecimal getElectricalConductivity() {
        return electricalConductivity;
    }

    public void setElectricalConductivity(BigDecimal electricalConductivity) {
        this.electricalConductivity = electricalConductivity;
    }

    public BigDecimal getOrganicCarbon() {
        return organicCarbon;
    }

    public void setOrganicCarbon(BigDecimal organicCarbon) {
        this.organicCarbon = organicCarbon;
    }

    public String getNotes() {
        return notes;
    }

    public void setNotes(String notes) {
        this.notes = notes;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        SoilReport that = (SoilReport) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}

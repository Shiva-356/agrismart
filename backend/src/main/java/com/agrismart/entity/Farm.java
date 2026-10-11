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
import java.util.Objects;
import java.util.UUID;

/**
 * Represents an agricultural land parcel or farm plot belonging to an AgriSmart user.
 * Stores core geographic and agronomic metadata required by the platform.
 */
@Entity
@Table(
    name = "farms",
    indexes = {
        @Index(name = "idx_farms_user_id", columnList = "user_id"),
        @Index(name = "idx_farms_district", columnList = "district")
    }
)
public class Farm {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    @Column(name = "id", updatable = false, nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "location", nullable = false)
    private String location;

    @Column(name = "district", nullable = false)
    private String district;

    @Column(name = "land_area_acres", nullable = false, precision = 10, scale = 2)
    private BigDecimal landAreaAcres;

    @Column(name = "current_crop")
    private String currentCrop;

    @Column(name = "irrigation", nullable = false)
    private String irrigation;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public Farm() {
    }

    public Farm(User user, String name, String location, String district, BigDecimal landAreaAcres, String irrigation) {
        this.user = user;
        this.name = name;
        this.location = location;
        this.district = district;
        this.landAreaAcres = landAreaAcres;
        this.irrigation = irrigation;
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

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getDistrict() {
        return district;
    }

    public void setDistrict(String district) {
        this.district = district;
    }

    public BigDecimal getLandAreaAcres() {
        return landAreaAcres;
    }

    public void setLandAreaAcres(BigDecimal landAreaAcres) {
        this.landAreaAcres = landAreaAcres;
    }

    public String getCurrentCrop() {
        return currentCrop;
    }

    public void setCurrentCrop(String currentCrop) {
        this.currentCrop = currentCrop;
    }

    public String getIrrigation() {
        return irrigation;
    }

    public void setIrrigation(String irrigation) {
        this.irrigation = irrigation;
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
        Farm farm = (Farm) o;
        return Objects.equals(id, farm.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}

package com.agrismart.dto.soilreport;

import com.agrismart.entity.SoilReport;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Response DTO representing an authentic laboratory soil report.
 *
 * Missing measurements remain null in the JSON representation.
 */
public record SoilReportResponse(
        UUID id,
        UUID farmId,
        String farmName,
        UUID appointmentId,
        String laboratoryName,
        String sampleId,
        LocalDate testDate,
        boolean verified,
        BigDecimal nitrogen,
        BigDecimal phosphorus,
        BigDecimal potassium,
        BigDecimal ph,
        BigDecimal electricalConductivity,
        BigDecimal organicCarbon,
        String notes,
        SoilMeasurementAvailability availability,
        Instant createdAt,
        Instant updatedAt
) {
    public static SoilReportResponse fromEntity(SoilReport entity) {
        if (entity == null) {
            return null;
        }

        boolean hasN = entity.getNitrogen() != null;
        boolean hasP = entity.getPhosphorus() != null;
        boolean hasK = entity.getPotassium() != null;
        boolean hasPh = entity.getPh() != null;
        boolean hasEc = entity.getElectricalConductivity() != null;
        boolean hasOc = entity.getOrganicCarbon() != null;
        boolean mlReady = hasN && hasP && hasK && hasPh;

        SoilMeasurementAvailability availability = new SoilMeasurementAvailability(
                hasN,
                hasP,
                hasK,
                hasPh,
                hasEc,
                hasOc,
                mlReady
        );

        UUID farmId = entity.getFarm() != null ? entity.getFarm().getId() : null;
        String farmName = entity.getFarm() != null ? entity.getFarm().getName() : null;
        UUID appointmentId = entity.getAppointment() != null ? entity.getAppointment().getId() : null;

        return new SoilReportResponse(
                entity.getId(),
                farmId,
                farmName,
                appointmentId,
                entity.getLaboratoryName(),
                entity.getSampleId(),
                entity.getTestDate(),
                entity.isVerified(),
                entity.getNitrogen(),
                entity.getPhosphorus(),
                entity.getPotassium(),
                entity.getPh(),
                entity.getElectricalConductivity(),
                entity.getOrganicCarbon(),
                entity.getNotes(),
                availability,
                entity.getCreatedAt(),
                entity.getUpdatedAt()
        );
    }
}

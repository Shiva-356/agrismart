package com.agrismart.dto.soilreport;

import com.agrismart.entity.SoilReport;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Compact summary response for soil report list views.
 */
public record SoilReportSummaryResponse(
        UUID id,
        UUID farmId,
        String laboratoryName,
        String sampleId,
        LocalDate testDate,
        boolean verified,
        BigDecimal ph,
        boolean isMlFeatureReady,
        Instant createdAt
) {
    public static SoilReportSummaryResponse fromEntity(SoilReport entity) {
        if (entity == null) {
            return null;
        }

        boolean mlReady = entity.getNitrogen() != null
                && entity.getPhosphorus() != null
                && entity.getPotassium() != null
                && entity.getPh() != null;

        UUID farmId = entity.getFarm() != null ? entity.getFarm().getId() : null;

        return new SoilReportSummaryResponse(
                entity.getId(),
                farmId,
                entity.getLaboratoryName(),
                entity.getSampleId(),
                entity.getTestDate(),
                entity.isVerified(),
                entity.getPh(),
                mlReady,
                entity.getCreatedAt()
        );
    }
}

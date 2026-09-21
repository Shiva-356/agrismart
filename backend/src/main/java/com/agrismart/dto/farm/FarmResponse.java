package com.agrismart.dto.farm;

import com.agrismart.entity.Farm;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record FarmResponse(
        UUID id,
        UUID userId,
        String name,
        String location,
        String district,
        BigDecimal landAreaAcres,
        String currentCrop,
        String irrigation,
        Instant createdAt,
        Instant updatedAt
) {
    public static FarmResponse fromEntity(Farm farm) {
        if (farm == null) {
            return null;
        }
        return new FarmResponse(
                farm.getId(),
                farm.getUser() != null ? farm.getUser().getId() : null,
                farm.getName(),
                farm.getLocation(),
                farm.getDistrict(),
                farm.getLandAreaAcres(),
                farm.getCurrentCrop(),
                farm.getIrrigation(),
                farm.getCreatedAt(),
                farm.getUpdatedAt()
        );
    }
}

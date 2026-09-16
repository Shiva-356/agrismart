package com.agrismart.dto.appointment;

import com.agrismart.entity.Farm;

import java.math.BigDecimal;
import java.util.UUID;

public record FarmSummaryResponse(
        UUID id,
        String name,
        String location,
        String district,
        BigDecimal landAreaAcres
) {
    public static FarmSummaryResponse fromEntity(Farm farm) {
        if (farm == null) {
            return null;
        }
        return new FarmSummaryResponse(
                farm.getId(),
                farm.getName(),
                farm.getLocation(),
                farm.getDistrict(),
                farm.getLandAreaAcres()
        );
    }
}

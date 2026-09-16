package com.agrismart.dto.provider;

import com.agrismart.entity.SoilTestingProvider;

import java.time.Instant;
import java.util.UUID;

public record ProviderResponse(
        UUID id,
        String name,
        String type,
        String address,
        String phone,
        boolean verified,
        boolean acceptingSamples,
        Double latitude,
        Double longitude,
        String openingHours,
        Integer reportTimeDays,
        Instant createdAt,
        Instant updatedAt
) {
    public static ProviderResponse fromEntity(SoilTestingProvider provider) {
        if (provider == null) {
            return null;
        }
        return new ProviderResponse(
                provider.getId(),
                provider.getName(),
                provider.getType(),
                provider.getAddress(),
                provider.getPhone(),
                provider.isVerified(),
                provider.isAcceptingSamples(),
                provider.getLatitude(),
                provider.getLongitude(),
                provider.getOpeningHours(),
                provider.getReportTimeDays(),
                provider.getCreatedAt(),
                provider.getUpdatedAt()
        );
    }
}

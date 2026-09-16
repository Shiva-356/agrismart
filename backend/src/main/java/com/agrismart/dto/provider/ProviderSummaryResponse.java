package com.agrismart.dto.provider;

import com.agrismart.entity.SoilTestingProvider;

import java.util.UUID;

public record ProviderSummaryResponse(
        UUID id,
        String name,
        String type,
        String address,
        String phone,
        boolean verified,
        boolean acceptingSamples
) {
    public static ProviderSummaryResponse fromEntity(SoilTestingProvider provider) {
        if (provider == null) {
            return null;
        }
        return new ProviderSummaryResponse(
                provider.getId(),
                provider.getName(),
                provider.getType(),
                provider.getAddress(),
                provider.getPhone(),
                provider.isVerified(),
                provider.isAcceptingSamples()
        );
    }
}

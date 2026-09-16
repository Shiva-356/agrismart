package com.agrismart.service;

import com.agrismart.dto.provider.CreateProviderRequest;
import com.agrismart.dto.provider.ProviderResponse;
import com.agrismart.dto.provider.UpdateProviderRequest;
import com.agrismart.entity.SoilTestingProvider;
import com.agrismart.exception.ResourceNotFoundException;
import com.agrismart.repository.SoilTestingProviderRepository;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Service managing soil testing laboratory/provider records.
 */
@Service
@Transactional(readOnly = true)
public class ProviderService {

    private final SoilTestingProviderRepository providerRepository;

    public ProviderService(SoilTestingProviderRepository providerRepository) {
        this.providerRepository = providerRepository;
    }

    /**
     * Retrieves providers matching optional filter criteria.
     * Note: The current V1 database schema does not have a dedicated district column on
     * soil_testing_providers. As a non-destructive solution that avoids schema alteration,
     * district filtering matches the provider's address field case-insensitively.
     */
    public List<ProviderResponse> listProviders(
            Boolean verified,
            Boolean acceptingSamples,
            String district,
            String type
    ) {
        Specification<SoilTestingProvider> spec = (root, query, cb) -> {
            var predicates = cb.conjunction();

            if (verified != null) {
                predicates = cb.and(predicates, cb.equal(root.get("verified"), verified));
            }
            if (acceptingSamples != null) {
                predicates = cb.and(predicates, cb.equal(root.get("acceptingSamples"), acceptingSamples));
            }
            if (type != null && !type.isBlank()) {
                predicates = cb.and(predicates, cb.equal(cb.lower(root.get("type")), type.toLowerCase().trim()));
            }
            if (district != null && !district.isBlank()) {
                predicates = cb.and(predicates, cb.like(cb.lower(root.get("address")), "%" + district.toLowerCase().trim() + "%"));
            }

            return predicates;
        };

        return providerRepository.findAll(spec).stream()
                .map(ProviderResponse::fromEntity)
                .toList();
    }

    /**
     * Retrieves a single provider by ID.
     */
    public ProviderResponse getProviderById(UUID id) {
        SoilTestingProvider provider = providerRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Soil testing provider not found with ID: " + id));
        return ProviderResponse.fromEntity(provider);
    }

    /**
     * Registers a new soil testing provider.
     */
    @Transactional
    public ProviderResponse createProvider(CreateProviderRequest request) {
        SoilTestingProvider provider = new SoilTestingProvider();
        provider.setName(request.name().trim());
        provider.setType(request.type().trim());
        provider.setAddress(request.address().trim());
        provider.setPhone(request.phone() != null ? request.phone().trim() : null);
        provider.setLatitude(request.latitude());
        provider.setLongitude(request.longitude());
        provider.setOpeningHours(request.openingHours() != null ? request.openingHours().trim() : null);
        provider.setReportTimeDays(request.reportTimeDays());
        // Default newly registered providers to unverified and accepting samples
        provider.setVerified(false);
        provider.setAcceptingSamples(true);

        SoilTestingProvider saved = providerRepository.save(provider);
        return ProviderResponse.fromEntity(saved);
    }

    /**
     * Updates an existing soil testing provider.
     */
    @Transactional
    public ProviderResponse updateProvider(UUID id, UpdateProviderRequest request) {
        SoilTestingProvider provider = providerRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Soil testing provider not found with ID: " + id));

        provider.setName(request.name().trim());
        provider.setType(request.type().trim());
        provider.setAddress(request.address().trim());
        provider.setPhone(request.phone() != null ? request.phone().trim() : null);
        provider.setVerified(Boolean.TRUE.equals(request.verified()));
        provider.setAcceptingSamples(Boolean.TRUE.equals(request.acceptingSamples()));
        provider.setLatitude(request.latitude());
        provider.setLongitude(request.longitude());
        provider.setOpeningHours(request.openingHours() != null ? request.openingHours().trim() : null);
        provider.setReportTimeDays(request.reportTimeDays());

        SoilTestingProvider updated = providerRepository.save(provider);
        return ProviderResponse.fromEntity(updated);
    }
}

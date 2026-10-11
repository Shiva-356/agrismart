package com.agrismart.service;

import com.agrismart.dto.provider.CreateProviderRequest;
import com.agrismart.dto.provider.ProviderResponse;
import com.agrismart.dto.provider.UpdateProviderRequest;
import com.agrismart.entity.SoilTestingProvider;
import com.agrismart.exception.ResourceNotFoundException;
import com.agrismart.repository.SoilTestingProviderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.jpa.domain.Specification;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProviderServiceTest {

    @Mock
    private SoilTestingProviderRepository providerRepository;

    @InjectMocks
    private ProviderService providerService;

    private UUID providerId;
    private SoilTestingProvider mockProvider;

    @BeforeEach
    void setUp() {
        providerId = UUID.randomUUID();
        mockProvider = new SoilTestingProvider();
        mockProvider.setId(providerId);
        mockProvider.setName("Regional Soil Testing Center");
        mockProvider.setType("Government Soil Testing Lab");
        mockProvider.setAddress("Agricultural Research Station, Warangal, Telangana");
        mockProvider.setPhone("+91 870 2500 123");
        mockProvider.setVerified(true);
        mockProvider.setAcceptingSamples(true);
        mockProvider.setLatitude(17.9784);
        mockProvider.setLongitude(79.6000);
        mockProvider.setOpeningHours("09:30 AM - 05:30 PM");
        mockProvider.setReportTimeDays(5);
        mockProvider.setCreatedAt(Instant.now());
        mockProvider.setUpdatedAt(Instant.now());
    }

    @Test
    void createProviderSetsDefaultsAndSaves() {
        CreateProviderRequest request = new CreateProviderRequest(
                "New Research Lab",
                "University Extension",
                "Campus Road, Hyderabad",
                "+91 40 1234 5678",
                17.4,
                78.4,
                "09:00 AM - 05:00 PM",
                7
        );

        when(providerRepository.save(any(SoilTestingProvider.class))).thenAnswer(invocation -> {
            SoilTestingProvider p = invocation.getArgument(0);
            p.setId(UUID.randomUUID());
            p.setCreatedAt(Instant.now());
            p.setUpdatedAt(Instant.now());
            return p;
        });

        ProviderResponse response = providerService.createProvider(request);

        assertThat(response).isNotNull();
        assertThat(response.name()).isEqualTo("New Research Lab");
        assertThat(response.verified()).isFalse(); // Initial state is unverified
        assertThat(response.acceptingSamples()).isTrue();
        assertThat(response.reportTimeDays()).isEqualTo(7);
        verify(providerRepository).save(any(SoilTestingProvider.class));
    }

    @Test
    void getProviderByIdReturnsMappedDto() {
        when(providerRepository.findById(providerId)).thenReturn(Optional.of(mockProvider));

        ProviderResponse response = providerService.getProviderById(providerId);

        assertThat(response.id()).isEqualTo(providerId);
        assertThat(response.name()).isEqualTo("Regional Soil Testing Center");
        assertThat(response.verified()).isTrue();
    }

    @Test
    void getProviderByIdThrowsWhenNotFound() {
        UUID missingId = UUID.randomUUID();
        when(providerRepository.findById(missingId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> providerService.getProviderById(missingId))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining(missingId.toString());
    }

    @Test
    void listProvidersWithSpecificationQueriesRepository() {
        when(providerRepository.findAll(any(Specification.class))).thenReturn(List.of(mockProvider));

        List<ProviderResponse> list = providerService.listProviders(true, true, "Warangal", "Government Soil Testing Lab");

        assertThat(list).hasSize(1);
        assertThat(list.get(0).name()).isEqualTo("Regional Soil Testing Center");
        verify(providerRepository).findAll(any(Specification.class));
    }

    @Test
    void updateProviderUpdatesFieldsAndSaves() {
        UpdateProviderRequest updateRequest = new UpdateProviderRequest(
                "Updated Regional Center",
                "Government Soil Testing Lab",
                "Updated Address, Warangal",
                "+91 870 9999 888",
                true,
                false,
                18.0,
                79.5,
                "10:00 AM - 04:00 PM",
                3
        );

        when(providerRepository.findById(providerId)).thenReturn(Optional.of(mockProvider));
        when(providerRepository.save(any(SoilTestingProvider.class))).thenAnswer(inv -> inv.getArgument(0));

        ProviderResponse updated = providerService.updateProvider(providerId, updateRequest);

        assertThat(updated.name()).isEqualTo("Updated Regional Center");
        assertThat(updated.acceptingSamples()).isFalse();
        assertThat(updated.reportTimeDays()).isEqualTo(3);
    }
}

package com.agrismart.service;

import com.agrismart.dto.farm.CreateFarmRequest;
import com.agrismart.dto.farm.FarmResponse;
import com.agrismart.dto.farm.UpdateFarmRequest;
import com.agrismart.entity.Farm;
import com.agrismart.entity.User;
import com.agrismart.exception.BusinessRuleViolationException;
import com.agrismart.exception.ResourceNotFoundException;
import com.agrismart.repository.FarmRepository;
import com.agrismart.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FarmServiceTest {

    @Mock
    private FarmRepository farmRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private FarmService farmService;

    private UUID userId;
    private UUID farmId;
    private User mockUser;
    private Farm mockFarm;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        farmId = UUID.randomUUID();

        mockUser = new User("Ramesh Patel", "ramesh@example.com", "+91 98765 43210");
        mockUser.setId(userId);
        mockUser.setCreatedAt(Instant.now());
        mockUser.setUpdatedAt(Instant.now());

        mockFarm = new Farm(
                mockUser,
                "Green Acres Plot 1",
                "Near Lake, Station Road",
                "Warangal",
                BigDecimal.valueOf(4.50),
                "DRIP"
        );
        mockFarm.setId(farmId);
        mockFarm.setCurrentCrop("Cotton");
        mockFarm.setCreatedAt(Instant.now());
        mockFarm.setUpdatedAt(Instant.now());
    }

    @Test
    void createValidFarmSavesAndReturnsFarmResponse() {
        CreateFarmRequest request = new CreateFarmRequest(
                userId,
                "Green Acres Plot 1",
                "Near Lake, Station Road",
                "Warangal",
                BigDecimal.valueOf(4.50),
                "Cotton",
                "DRIP"
        );

        when(userRepository.findById(userId)).thenReturn(Optional.of(mockUser));
        when(farmRepository.save(any(Farm.class))).thenAnswer(invocation -> {
            Farm f = invocation.getArgument(0);
            f.setId(farmId);
            f.setCreatedAt(Instant.now());
            f.setUpdatedAt(Instant.now());
            return f;
        });

        FarmResponse response = farmService.createFarm(request);

        assertThat(response).isNotNull();
        assertThat(response.id()).isEqualTo(farmId);
        assertThat(response.userId()).isEqualTo(userId);
        assertThat(response.name()).isEqualTo("Green Acres Plot 1");
        assertThat(response.district()).isEqualTo("Warangal");
        assertThat(response.landAreaAcres()).isEqualByComparingTo(BigDecimal.valueOf(4.50));
        assertThat(response.currentCrop()).isEqualTo("Cotton");
        assertThat(response.irrigation()).isEqualTo("DRIP");
        verify(farmRepository).save(any(Farm.class));
    }

    @Test
    void createFarmWithNonexistentUserRejectedWith404() {
        UUID nonExistentUserId = UUID.randomUUID();
        CreateFarmRequest request = new CreateFarmRequest(
                nonExistentUserId,
                "Plot 2",
                "North Field",
                "Khammam",
                BigDecimal.valueOf(3.0),
                "Maize",
                "SPRINKLER"
        );

        when(userRepository.findById(nonExistentUserId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> farmService.createFarm(request))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("User not found with ID: " + nonExistentUserId);

        verify(farmRepository, never()).save(any(Farm.class));
    }

    @Test
    void createFarmWithZeroOrNegativeLandAreaRejected() {
        CreateFarmRequest requestZero = new CreateFarmRequest(
                userId,
                "Plot 2",
                "North Field",
                "Khammam",
                BigDecimal.ZERO,
                "Maize",
                "SPRINKLER"
        );

        when(userRepository.findById(userId)).thenReturn(Optional.of(mockUser));

        assertThatThrownBy(() -> farmService.createFarm(requestZero))
                .isInstanceOf(BusinessRuleViolationException.class)
                .hasMessageContaining("Land area in acres must be greater than 0");

        CreateFarmRequest requestNegative = new CreateFarmRequest(
                userId,
                "Plot 2",
                "North Field",
                "Khammam",
                BigDecimal.valueOf(-1.5),
                "Maize",
                "SPRINKLER"
        );

        assertThatThrownBy(() -> farmService.createFarm(requestNegative))
                .isInstanceOf(BusinessRuleViolationException.class)
                .hasMessageContaining("Land area in acres must be greater than 0");

        verify(farmRepository, never()).save(any(Farm.class));
    }

    @Test
    void getExistingFarmReturnsFarmResponse() {
        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));

        FarmResponse response = farmService.getFarmById(farmId);

        assertThat(response).isNotNull();
        assertThat(response.id()).isEqualTo(farmId);
        assertThat(response.userId()).isEqualTo(userId);
        assertThat(response.name()).isEqualTo("Green Acres Plot 1");
    }

    @Test
    void missingFarmReturns404ResourceNotFoundException() {
        UUID nonExistentId = UUID.randomUUID();
        when(farmRepository.findById(nonExistentId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> farmService.getFarmById(nonExistentId))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Farm not found with ID: " + nonExistentId);
    }

    @Test
    void getAllFarmsReturnsListOfFarms() {
        when(farmRepository.findAll()).thenReturn(List.of(mockFarm));

        List<FarmResponse> farms = farmService.getAllFarms();

        assertThat(farms).hasSize(1);
        assertThat(farms.get(0).id()).isEqualTo(farmId);
        assertThat(farms.get(0).userId()).isEqualTo(userId);
        assertThat(farms.get(0).name()).isEqualTo("Green Acres Plot 1");
    }

    @Test
    void getFarmsByUserIdReturnsUserFarmsWhenUserExists() {
        when(userRepository.existsById(userId)).thenReturn(true);
        when(farmRepository.findByUserId(userId)).thenReturn(List.of(mockFarm));

        List<FarmResponse> farms = farmService.getFarmsByUserId(userId);

        assertThat(farms).hasSize(1);
        assertThat(farms.get(0).id()).isEqualTo(farmId);
        assertThat(farms.get(0).userId()).isEqualTo(userId);
    }

    @Test
    void getFarmsByUserIdThrows404WhenUserDoesNotExist() {
        UUID nonExistentUserId = UUID.randomUUID();
        when(userRepository.existsById(nonExistentUserId)).thenReturn(false);

        assertThatThrownBy(() -> farmService.getFarmsByUserId(nonExistentUserId))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("User not found with ID: " + nonExistentUserId);
    }

    @Test
    void updateFarmModifiesEditableFields() {
        UpdateFarmRequest request = new UpdateFarmRequest(
                "Updated Green Acres",
                "South Valley",
                "Warangal Rural",
                BigDecimal.valueOf(5.25),
                "Chilli",
                "DRIP"
        );

        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(farmRepository.save(any(Farm.class))).thenAnswer(invocation -> invocation.getArgument(0));

        FarmResponse response = farmService.updateFarm(farmId, request);

        assertThat(response).isNotNull();
        assertThat(response.name()).isEqualTo("Updated Green Acres");
        assertThat(response.location()).isEqualTo("South Valley");
        assertThat(response.district()).isEqualTo("Warangal Rural");
        assertThat(response.landAreaAcres()).isEqualByComparingTo(BigDecimal.valueOf(5.25));
        assertThat(response.currentCrop()).isEqualTo("Chilli");
        assertThat(response.irrigation()).isEqualTo("DRIP");
        assertThat(response.userId()).isEqualTo(userId); // Owner unchanged
        verify(farmRepository).save(mockFarm);
    }

    @Test
    void updateCannotChangeOwner() {
        UUID differentUserId = UUID.randomUUID();
        UpdateFarmRequest request = new UpdateFarmRequest(
                differentUserId,
                "Hacked Farm",
                "South Valley",
                "Warangal Rural",
                BigDecimal.valueOf(5.25),
                "Chilli",
                "DRIP"
        );

        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));

        assertThatThrownBy(() -> farmService.updateFarm(farmId, request))
                .isInstanceOf(BusinessRuleViolationException.class)
                .hasMessageContaining("Cannot change farm owner");

        verify(farmRepository, never()).save(any(Farm.class));
    }

    @Test
    void updateFarmWithZeroOrNegativeLandAreaRejected() {
        UpdateFarmRequest request = new UpdateFarmRequest(
                "Updated Name",
                "Location",
                "District",
                BigDecimal.ZERO,
                "Crop",
                "CANAL"
        );

        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));

        assertThatThrownBy(() -> farmService.updateFarm(farmId, request))
                .isInstanceOf(BusinessRuleViolationException.class)
                .hasMessageContaining("Land area in acres must be greater than 0");

        verify(farmRepository, never()).save(any(Farm.class));
    }
}

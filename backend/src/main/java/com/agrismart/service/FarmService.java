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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Service managing agricultural land parcels and farm plots.
 */
@Service
@Transactional(readOnly = true)
public class FarmService {

    private final FarmRepository farmRepository;
    private final UserRepository userRepository;

    public FarmService(FarmRepository farmRepository, UserRepository userRepository) {
        this.farmRepository = farmRepository;
        this.userRepository = userRepository;
    }

    /**
     * Creates and registers a new farm plot for an existing user.
     */
    @Transactional
    public FarmResponse createFarm(CreateFarmRequest request) {
        User user = userRepository.findById(request.userId())
                .orElseThrow(() -> new ResourceNotFoundException("User not found with ID: " + request.userId()));

        if (request.landAreaAcres() == null || request.landAreaAcres().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessRuleViolationException("Land area in acres must be greater than 0");
        }

        String name = request.name().trim();
        String location = request.location().trim();
        String district = request.district().trim();
        String irrigation = request.irrigation().trim();
        String currentCrop = request.currentCrop() != null ? request.currentCrop().trim() : null;
        if (currentCrop != null && currentCrop.isBlank()) {
            currentCrop = null;
        }

        Farm farm = new Farm(user, name, location, district, request.landAreaAcres(), irrigation);
        farm.setCurrentCrop(currentCrop);

        Farm saved = farmRepository.save(farm);
        return FarmResponse.fromEntity(saved);
    }

    /**
     * Retrieves a farm by its unique identifier.
     */
    public FarmResponse getFarmById(UUID id) {
        Farm farm = farmRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Farm not found with ID: " + id));
        return FarmResponse.fromEntity(farm);
    }

    /**
     * Retrieves all registered farms across all users.
     */
    public List<FarmResponse> getAllFarms() {
        return farmRepository.findAll().stream()
                .map(FarmResponse::fromEntity)
                .toList();
    }

    /**
     * Retrieves all farms belonging to a specific user.
     */
    public List<FarmResponse> getFarmsByUserId(UUID userId) {
        if (!userRepository.existsById(userId)) {
            throw new ResourceNotFoundException("User not found with ID: " + userId);
        }
        return farmRepository.findByUserId(userId).stream()
                .map(FarmResponse::fromEntity)
                .toList();
    }

    /**
     * Updates editable properties of an existing farm.
     * Prevents modifying the farm's owner (user).
     */
    @Transactional
    public FarmResponse updateFarm(UUID id, UpdateFarmRequest request) {
        Farm farm = farmRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Farm not found with ID: " + id));

        if (request.userId() != null && !request.userId().equals(farm.getUser().getId())) {
            throw new BusinessRuleViolationException("Cannot change farm owner");
        }

        if (request.landAreaAcres() == null || request.landAreaAcres().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessRuleViolationException("Land area in acres must be greater than 0");
        }

        farm.setName(request.name().trim());
        farm.setLocation(request.location().trim());
        farm.setDistrict(request.district().trim());
        farm.setLandAreaAcres(request.landAreaAcres());
        farm.setIrrigation(request.irrigation().trim());

        String currentCrop = request.currentCrop() != null ? request.currentCrop().trim() : null;
        if (currentCrop != null && currentCrop.isBlank()) {
            currentCrop = null;
        }
        farm.setCurrentCrop(currentCrop);

        Farm updated = farmRepository.save(farm);
        return FarmResponse.fromEntity(updated);
    }
}

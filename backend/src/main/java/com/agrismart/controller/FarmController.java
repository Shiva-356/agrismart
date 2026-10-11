package com.agrismart.controller;

import com.agrismart.dto.farm.CreateFarmRequest;
import com.agrismart.dto.farm.FarmResponse;
import com.agrismart.dto.farm.UpdateFarmRequest;
import com.agrismart.service.FarmService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/farms")
public class FarmController {

    private final FarmService farmService;

    public FarmController(FarmService farmService) {
        this.farmService = farmService;
    }

    /**
     * Creates a new farm plot for an existing user.
     */
    @PostMapping
    public ResponseEntity<FarmResponse> createFarm(@Valid @RequestBody CreateFarmRequest request) {
        FarmResponse created = farmService.createFarm(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(created.id())
                .toUri();
        return ResponseEntity.created(location).body(created);
    }

    /**
     * Retrieves details for a specific farm.
     */
    @GetMapping("/{id}")
    public ResponseEntity<FarmResponse> getFarmById(@PathVariable UUID id) {
        FarmResponse farm = farmService.getFarmById(id);
        return ResponseEntity.ok(farm);
    }

    /**
     * Retrieves all farms or filters by user ID if provided.
     * GET /api/farms
     * GET /api/farms?userId={userId}
     */
    @GetMapping
    public ResponseEntity<List<FarmResponse>> getFarms(@RequestParam(required = false) UUID userId) {
        if (userId != null) {
            List<FarmResponse> farms = farmService.getFarmsByUserId(userId);
            return ResponseEntity.ok(farms);
        }
        List<FarmResponse> farms = farmService.getAllFarms();
        return ResponseEntity.ok(farms);
    }

    /**
     * Updates editable details of a farm.
     */
    @PutMapping("/{id}")
    public ResponseEntity<FarmResponse> updateFarm(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateFarmRequest request
    ) {
        FarmResponse updated = farmService.updateFarm(id, request);
        return ResponseEntity.ok(updated);
    }
}

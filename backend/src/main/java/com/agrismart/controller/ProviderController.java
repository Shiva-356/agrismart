package com.agrismart.controller;

import com.agrismart.dto.provider.CreateProviderRequest;
import com.agrismart.dto.provider.ProviderResponse;
import com.agrismart.dto.provider.UpdateProviderRequest;
import com.agrismart.service.ProviderService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/providers")
public class ProviderController {

    private final ProviderService providerService;

    public ProviderController(ProviderService providerService) {
        this.providerService = providerService;
    }

    /**
     * Lists soil testing providers with optional filtering by verified status, sample acceptance, district, or type.
     */
    @GetMapping
    public ResponseEntity<List<ProviderResponse>> listProviders(
            @RequestParam(required = false) Boolean verified,
            @RequestParam(required = false) Boolean acceptingSamples,
            @RequestParam(required = false) String district,
            @RequestParam(required = false) String type
    ) {
        List<ProviderResponse> providers = providerService.listProviders(verified, acceptingSamples, district, type);
        return ResponseEntity.ok(providers);
    }

    /**
     * Retrieves details for a specific provider by ID.
     */
    @GetMapping("/{id}")
    public ResponseEntity<ProviderResponse> getProviderById(@PathVariable UUID id) {
        ProviderResponse provider = providerService.getProviderById(id);
        return ResponseEntity.ok(provider);
    }

    /**
     * Registers a new soil testing provider.
     */
    @PostMapping
    public ResponseEntity<ProviderResponse> createProvider(@Valid @RequestBody CreateProviderRequest request) {
        ProviderResponse created = providerService.createProvider(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(created.id())
                .toUri();
        return ResponseEntity.created(location).body(created);
    }

    /**
     * Updates an existing soil testing provider.
     */
    @PutMapping("/{id}")
    public ResponseEntity<ProviderResponse> updateProvider(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateProviderRequest request
    ) {
        ProviderResponse updated = providerService.updateProvider(id, request);
        return ResponseEntity.ok(updated);
    }
}

package com.agrismart.controller;

import com.agrismart.dto.soilreport.CreateSoilReportRequest;
import com.agrismart.dto.soilreport.SoilReportResponse;
import com.agrismart.dto.soilreport.VerifySoilReportRequest;
import com.agrismart.service.SoilReportService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;
import java.util.UUID;

/**
 * REST API for laboratory soil report ingestion, retrieval, and verification.
 *
 * Exposes endpoints for creating authentic write-once reports, retrieving reports by ID,
 * listing reports per farm with optional verification filtering, retrieving the latest
 * report for a farm, and explicitly verifying reports.
 *
 * Arbitrary measurement updates (PUT) and deletion (DELETE) are deliberately not exposed
 * to protect empirical scientific records and audit trails.
 */
@RestController
@RequestMapping("/api/soil-reports")
public class SoilReportController {

    private final SoilReportService soilReportService;

    public SoilReportController(SoilReportService soilReportService) {
        this.soilReportService = soilReportService;
    }

    /**
     * Ingests a new laboratory soil report.
     * When associated with an active appointment in TESTING status, automatically
     * advances the appointment to REPORT_READY.
     */
    @PostMapping
    public ResponseEntity<SoilReportResponse> createReport(@Valid @RequestBody CreateSoilReportRequest request) {
        SoilReportResponse created = soilReportService.createReport(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(created.id())
                .toUri();
        return ResponseEntity.created(location).body(created);
    }

    /**
     * Retrieves an individual soil report by ID.
     */
    @GetMapping("/{id}")
    public ResponseEntity<SoilReportResponse> getReportById(@PathVariable UUID id) {
        SoilReportResponse report = soilReportService.getReportById(id);
        return ResponseEntity.ok(report);
    }

    /**
     * Lists soil reports for a specified farm, optionally filtered by verification status.
     * Results are ordered chronologically with the latest test date first.
     */
    @GetMapping
    public ResponseEntity<List<SoilReportResponse>> listReports(
            @RequestParam UUID farmId,
            @RequestParam(required = false) Boolean verified
    ) {
        List<SoilReportResponse> reports = soilReportService.listReports(farmId, verified);
        return ResponseEntity.ok(reports);
    }

    /**
     * Retrieves the single latest soil report for a farm based on test date and creation timestamp.
     */
    @GetMapping("/latest")
    public ResponseEntity<SoilReportResponse> getLatestReport(@RequestParam UUID farmId) {
        SoilReportResponse latest = soilReportService.getLatestReport(farmId);
        return ResponseEntity.ok(latest);
    }

    /**
     * Explicitly marks a soil report as verified by an authorized lab officer or admin.
     */
    @PatchMapping("/{id}/verify")
    public ResponseEntity<SoilReportResponse> verifyReport(
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) VerifySoilReportRequest request
    ) {
        SoilReportResponse verified = soilReportService.verifyReport(id, request);
        return ResponseEntity.ok(verified);
    }
}

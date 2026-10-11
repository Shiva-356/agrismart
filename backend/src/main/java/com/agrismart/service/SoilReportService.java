package com.agrismart.service;

import com.agrismart.dto.soilreport.CreateSoilReportRequest;
import com.agrismart.dto.soilreport.SoilReportResponse;
import com.agrismart.dto.soilreport.VerifySoilReportRequest;
import com.agrismart.entity.Appointment;
import com.agrismart.entity.AppointmentStatus;
import com.agrismart.entity.Farm;
import com.agrismart.entity.SoilReport;
import com.agrismart.exception.BusinessRuleViolationException;
import com.agrismart.exception.InvalidStatusTransitionException;
import com.agrismart.exception.ResourceNotFoundException;
import com.agrismart.repository.AppointmentRepository;
import com.agrismart.repository.FarmRepository;
import com.agrismart.repository.SoilReportRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Service managing authentic laboratory soil reports.
 *
 * Enforces:
 * 1. Write-once immutability for scientific measurements.
 * 2. Strict null safety: unmeasured parameters remain null and are never defaulted to zero.
 * 3. Verified state defaults to false and can only be set via explicit verification workflow.
 * 4. Transactional appointment state synchronization: when a report is created for an appointment
 *    in TESTING status, the appointment is atomically transitioned to REPORT_READY.
 */
@Service
public class SoilReportService {

    private final SoilReportRepository soilReportRepository;
    private final FarmRepository farmRepository;
    private final AppointmentRepository appointmentRepository;

    public SoilReportService(
            SoilReportRepository soilReportRepository,
            FarmRepository farmRepository,
            AppointmentRepository appointmentRepository
    ) {
        this.soilReportRepository = soilReportRepository;
        this.farmRepository = farmRepository;
        this.appointmentRepository = appointmentRepository;
    }

    /**
     * Creates an authentic soil report and links it to the farm and optional appointment.
     * When associated with an active appointment in TESTING status, atomically advances
     * the appointment status to REPORT_READY.
     */
    @Transactional
    public SoilReportResponse createReport(CreateSoilReportRequest request) {
        Farm farm = farmRepository.findById(request.farmId())
                .orElseThrow(() -> new ResourceNotFoundException("Farm not found with ID: " + request.farmId()));

        Appointment appointment = null;
        if (request.appointmentId() != null) {
            appointment = appointmentRepository.findById(request.appointmentId())
                    .orElseThrow(() -> new ResourceNotFoundException("Appointment not found with ID: " + request.appointmentId()));

            // 1. Farm ownership consistency
            if (!appointment.getFarm().getId().equals(request.farmId())) {
                throw new BusinessRuleViolationException(
                        "Appointment " + request.appointmentId() + " does not belong to farm " + request.farmId()
                );
            }

            // 2. Lifecycle status check
            AppointmentStatus currentStatus = appointment.getStatus();
            if (currentStatus == AppointmentStatus.CANCELLED) {
                throw new InvalidStatusTransitionException("Cannot create soil report for a cancelled appointment");
            }
            if (currentStatus == AppointmentStatus.COMPLETED) {
                throw new InvalidStatusTransitionException("Cannot create soil report for an appointment in terminal status: COMPLETED");
            }

            if (currentStatus == AppointmentStatus.TESTING) {
                // Advance appointment state atomically to REPORT_READY
                appointment.setStatus(AppointmentStatus.REPORT_READY);
                String sampleSuffix = request.sampleId() != null ? " (Sample ID: " + request.sampleId().trim() + ")" : "";
                String existingNotes = appointment.getNotes() != null ? appointment.getNotes() + " | " : "";
                appointment.setNotes(existingNotes + "Status changed to REPORT_READY: Soil report created" + sampleSuffix);
                appointmentRepository.save(appointment);
            } else if (currentStatus == AppointmentStatus.REPORT_READY) {
                // Allowed for replacement / supplemental reports; appointment stays REPORT_READY
            } else {
                throw new InvalidStatusTransitionException(
                        "Cannot create soil report for appointment in status " + currentStatus +
                        ". Appointment must be in TESTING status before generating a soil report."
                );
            }
        }

        SoilReport report = new SoilReport();
        report.setFarm(farm);
        report.setAppointment(appointment);
        report.setLaboratoryName(request.laboratoryName().trim());
        report.setSampleId(request.sampleId() != null ? request.sampleId().trim() : null);
        report.setTestDate(request.testDate());
        report.setVerified(false); // New reports always start unverified

        // Nullable empirical measurements - NEVER converted to zero
        report.setNitrogen(request.nitrogen());
        report.setPhosphorus(request.phosphorus());
        report.setPotassium(request.potassium());
        report.setPh(request.ph());
        report.setElectricalConductivity(request.electricalConductivity());
        report.setOrganicCarbon(request.organicCarbon());
        report.setNotes(request.notes() != null ? request.notes().trim() : null);

        SoilReport saved = soilReportRepository.save(report);
        return SoilReportResponse.fromEntity(saved);
    }

    /**
     * Retrieves a soil report by ID.
     */
    @Transactional(readOnly = true)
    public SoilReportResponse getReportById(UUID id) {
        SoilReport report = soilReportRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Soil report not found with ID: " + id));
        return SoilReportResponse.fromEntity(report);
    }

    /**
     * Lists all soil reports for a farm, optionally filtered by verification status.
     * Ordered deterministically: testDate DESC, createdAt DESC.
     */
    @Transactional(readOnly = true)
    public List<SoilReportResponse> listReports(UUID farmId, Boolean verified) {
        if (!farmRepository.existsById(farmId)) {
            throw new ResourceNotFoundException("Farm not found with ID: " + farmId);
        }

        List<SoilReport> reports;
        if (verified != null) {
            reports = soilReportRepository.findByFarmIdAndVerifiedOrderByTestDateDescCreatedAtDesc(farmId, verified);
        } else {
            reports = soilReportRepository.findByFarmIdOrderByTestDateDescCreatedAtDesc(farmId);
        }

        return reports.stream()
                .map(SoilReportResponse::fromEntity)
                .toList();
    }

    /**
     * Retrieves the single latest soil report for a farm based on testDate DESC, createdAt DESC.
     */
    @Transactional(readOnly = true)
    public SoilReportResponse getLatestReport(UUID farmId) {
        if (!farmRepository.existsById(farmId)) {
            throw new ResourceNotFoundException("Farm not found with ID: " + farmId);
        }

        SoilReport report = soilReportRepository.findTopByFarmIdOrderByTestDateDescCreatedAtDesc(farmId)
                .orElseThrow(() -> new ResourceNotFoundException("No soil report found for farm ID: " + farmId));

        return SoilReportResponse.fromEntity(report);
    }

    /**
     * Verifies an existing soil report.
     * Safe and idempotent: if already verified, returns the report without corrupting state.
     */
    @Transactional
    public SoilReportResponse verifyReport(UUID id, VerifySoilReportRequest request) {
        SoilReport report = soilReportRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Soil report not found with ID: " + id));

        if (!report.isVerified()) {
            report.setVerified(true);
            if (request != null && request.remarks() != null && !request.remarks().isBlank()) {
                String existing = report.getNotes() != null ? report.getNotes() + " | " : "";
                report.setNotes(existing + "Verified: " + request.remarks().trim());
            }
            SoilReport saved = soilReportRepository.save(report);
            return SoilReportResponse.fromEntity(saved);
        }

        // Already verified - handle safely and idempotently
        return SoilReportResponse.fromEntity(report);
    }
}

package com.agrismart.service;

import com.agrismart.dto.appointment.AppointmentResponse;
import com.agrismart.dto.appointment.CancelAppointmentRequest;
import com.agrismart.dto.appointment.CreateAppointmentRequest;
import com.agrismart.dto.appointment.UpdateAppointmentStatusRequest;
import com.agrismart.entity.Appointment;
import com.agrismart.entity.AppointmentStatus;
import com.agrismart.entity.Farm;
import com.agrismart.entity.SoilTestingProvider;
import com.agrismart.exception.BusinessRuleViolationException;
import com.agrismart.exception.InvalidStatusTransitionException;
import com.agrismart.exception.ResourceNotFoundException;
import com.agrismart.repository.AppointmentRepository;
import com.agrismart.repository.FarmRepository;
import com.agrismart.repository.SoilTestingProviderRepository;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Service managing soil testing appointments and enforcing the strict lifecycle state machine.
 */
@Service
@Transactional(readOnly = true)
public class AppointmentService {

    private final AppointmentRepository appointmentRepository;
    private final FarmRepository farmRepository;
    private final SoilTestingProviderRepository providerRepository;

    public AppointmentService(
            AppointmentRepository appointmentRepository,
            FarmRepository farmRepository,
            SoilTestingProviderRepository providerRepository
    ) {
        this.appointmentRepository = appointmentRepository;
        this.farmRepository = farmRepository;
        this.providerRepository = providerRepository;
    }

    /**
     * Books a new soil testing appointment.
     */
    @Transactional
    public AppointmentResponse createAppointment(CreateAppointmentRequest request) {
        Farm farm = farmRepository.findById(request.farmId())
                .orElseThrow(() -> new ResourceNotFoundException("Farm not found with ID: " + request.farmId()));

        SoilTestingProvider provider = providerRepository.findById(request.providerId())
                .orElseThrow(() -> new ResourceNotFoundException("Soil testing provider not found with ID: " + request.providerId()));

        if (!provider.isAcceptingSamples()) {
            throw new BusinessRuleViolationException(
                    "Selected provider '" + provider.getName() + "' is not currently accepting new soil samples"
            );
        }

        if (request.scheduledDate().isBefore(LocalDate.now())) {
            throw new BusinessRuleViolationException("Scheduled date cannot be in the past");
        }

        Appointment appointment = new Appointment();
        appointment.setFarm(farm);
        appointment.setProvider(provider);
        appointment.setMethod(request.method());
        appointment.setStatus(AppointmentStatus.BOOKED);
        appointment.setScheduledDate(request.scheduledDate());
        appointment.setScheduledTimeSlot(request.scheduledTimeSlot().trim());
        appointment.setNotes(request.notes() != null ? request.notes().trim() : null);

        Appointment saved = appointmentRepository.save(appointment);
        return AppointmentResponse.fromEntity(saved);
    }

    /**
     * Retrieves an appointment by ID.
     */
    public AppointmentResponse getAppointmentById(UUID id) {
        Appointment appointment = appointmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found with ID: " + id));
        return AppointmentResponse.fromEntity(appointment);
    }

    /**
     * Lists appointments matching optional filters: farmId, providerId, status.
     */
    public List<AppointmentResponse> listAppointments(UUID farmId, UUID providerId, AppointmentStatus status) {
        Specification<Appointment> spec = (root, query, cb) -> {
            var predicates = cb.conjunction();

            if (farmId != null) {
                predicates = cb.and(predicates, cb.equal(root.get("farm").get("id"), farmId));
            }
            if (providerId != null) {
                predicates = cb.and(predicates, cb.equal(root.get("provider").get("id"), providerId));
            }
            if (status != null) {
                predicates = cb.and(predicates, cb.equal(root.get("status"), status));
            }

            return predicates;
        };

        return appointmentRepository.findAll(spec).stream()
                .map(AppointmentResponse::fromEntity)
                .toList();
    }

    /**
     * Updates an appointment's lifecycle status adhering to the controlled state machine.
     */
    @Transactional
    public AppointmentResponse updateAppointmentStatus(UUID id, UpdateAppointmentStatusRequest request) {
        Appointment appointment = appointmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found with ID: " + id));

        AppointmentStatus currentStatus = appointment.getStatus();
        AppointmentStatus targetStatus = request.status();

        validateTransition(currentStatus, targetStatus);

        appointment.setStatus(targetStatus);
        if (request.reason() != null && !request.reason().isBlank()) {
            String existing = appointment.getNotes() != null ? appointment.getNotes() + " | " : "";
            appointment.setNotes(existing + "Status changed to " + targetStatus + ": " + request.reason().trim());
        }

        Appointment updated = appointmentRepository.save(appointment);
        return AppointmentResponse.fromEntity(updated);
    }

    /**
     * Cancels an active appointment.
     */
    @Transactional
    public AppointmentResponse cancelAppointment(UUID id, CancelAppointmentRequest request) {
        Appointment appointment = appointmentRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Appointment not found with ID: " + id));

        AppointmentStatus currentStatus = appointment.getStatus();
        validateTransition(currentStatus, AppointmentStatus.CANCELLED);

        appointment.setStatus(AppointmentStatus.CANCELLED);
        if (request != null && request.reason() != null && !request.reason().isBlank()) {
            String existing = appointment.getNotes() != null ? appointment.getNotes() + " | " : "";
            appointment.setNotes(existing + "Cancellation reason: " + request.reason().trim());
        }

        Appointment cancelled = appointmentRepository.save(appointment);
        return AppointmentResponse.fromEntity(cancelled);
    }

    /**
     * Enforces the controlled state machine transitions:
     * BOOKED -> CONFIRMED, CANCELLED
     * CONFIRMED -> SAMPLE_COLLECTED, CANCELLED
     * SAMPLE_COLLECTED -> TESTING, CANCELLED
     * TESTING -> REPORT_READY (TESTING cannot be cancelled)
     * REPORT_READY -> COMPLETED
     * COMPLETED -> (terminal)
     * CANCELLED -> (terminal)
     */
    private void validateTransition(AppointmentStatus current, AppointmentStatus target) {
        if (current == AppointmentStatus.COMPLETED || current == AppointmentStatus.CANCELLED) {
            throw new InvalidStatusTransitionException("Cannot modify appointment in terminal status: " + current);
        }
        if (current == target) {
            throw new InvalidStatusTransitionException("Appointment is already in status " + current);
        }

        boolean allowed = switch (current) {
            case BOOKED -> (target == AppointmentStatus.CONFIRMED || target == AppointmentStatus.CANCELLED);
            case CONFIRMED -> (target == AppointmentStatus.SAMPLE_COLLECTED || target == AppointmentStatus.CANCELLED);
            case SAMPLE_COLLECTED -> (target == AppointmentStatus.TESTING || target == AppointmentStatus.CANCELLED);
            case TESTING -> (target == AppointmentStatus.REPORT_READY);
            case REPORT_READY -> (target == AppointmentStatus.COMPLETED);
            default -> false;
        };

        if (!allowed) {
            if (current == AppointmentStatus.TESTING && target == AppointmentStatus.CANCELLED) {
                throw new InvalidStatusTransitionException(
                        "Cannot cancel appointment in TESTING stage. Laboratory analysis is already in progress."
                );
            }
            throw new InvalidStatusTransitionException(
                    "Invalid status transition from " + current + " to " + target +
                            ". Skipping intermediate stages or moving backward is not permitted."
            );
        }
    }
}

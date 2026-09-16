package com.agrismart.controller;

import com.agrismart.dto.appointment.AppointmentResponse;
import com.agrismart.dto.appointment.CancelAppointmentRequest;
import com.agrismart.dto.appointment.CreateAppointmentRequest;
import com.agrismart.dto.appointment.UpdateAppointmentStatusRequest;
import com.agrismart.entity.AppointmentStatus;
import com.agrismart.service.AppointmentService;
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

@RestController
@RequestMapping("/api/appointments")
public class AppointmentController {

    private final AppointmentService appointmentService;

    public AppointmentController(AppointmentService appointmentService) {
        this.appointmentService = appointmentService;
    }

    /**
     * Books a new soil testing appointment.
     */
    @PostMapping
    public ResponseEntity<AppointmentResponse> createAppointment(@Valid @RequestBody CreateAppointmentRequest request) {
        AppointmentResponse created = appointmentService.createAppointment(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(created.id())
                .toUri();
        return ResponseEntity.created(location).body(created);
    }

    /**
     * Retrieves details for a specific appointment.
     */
    @GetMapping("/{id}")
    public ResponseEntity<AppointmentResponse> getAppointmentById(@PathVariable UUID id) {
        AppointmentResponse appointment = appointmentService.getAppointmentById(id);
        return ResponseEntity.ok(appointment);
    }

    /**
     * Lists appointments with optional filtering by farm, provider, or lifecycle status.
     */
    @GetMapping
    public ResponseEntity<List<AppointmentResponse>> listAppointments(
            @RequestParam(required = false) UUID farmId,
            @RequestParam(required = false) UUID providerId,
            @RequestParam(required = false) AppointmentStatus status
    ) {
        List<AppointmentResponse> appointments = appointmentService.listAppointments(farmId, providerId, status);
        return ResponseEntity.ok(appointments);
    }

    /**
     * Advances or updates an appointment's lifecycle status.
     */
    @PatchMapping("/{id}/status")
    public ResponseEntity<AppointmentResponse> updateAppointmentStatus(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateAppointmentStatusRequest request
    ) {
        AppointmentResponse updated = appointmentService.updateAppointmentStatus(id, request);
        return ResponseEntity.ok(updated);
    }

    /**
     * Cancels an active appointment.
     */
    @PostMapping("/{id}/cancel")
    public ResponseEntity<AppointmentResponse> cancelAppointment(
            @PathVariable UUID id,
            @RequestBody(required = false) CancelAppointmentRequest request
    ) {
        AppointmentResponse cancelled = appointmentService.cancelAppointment(id, request != null ? request : new CancelAppointmentRequest(null));
        return ResponseEntity.ok(cancelled);
    }
}

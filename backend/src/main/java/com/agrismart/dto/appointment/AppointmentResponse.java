package com.agrismart.dto.appointment;

import com.agrismart.dto.provider.ProviderSummaryResponse;
import com.agrismart.entity.Appointment;
import com.agrismart.entity.AppointmentMethod;
import com.agrismart.entity.AppointmentStatus;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record AppointmentResponse(
        UUID id,
        UUID farmId,
        FarmSummaryResponse farm,
        UUID providerId,
        ProviderSummaryResponse provider,
        AppointmentStatus status,
        AppointmentMethod method,
        LocalDate scheduledDate,
        String scheduledTimeSlot,
        String notes,
        Instant createdAt,
        Instant updatedAt
) {
    public static AppointmentResponse fromEntity(Appointment appointment) {
        if (appointment == null) {
            return null;
        }
        return new AppointmentResponse(
                appointment.getId(),
                appointment.getFarm() != null ? appointment.getFarm().getId() : null,
                FarmSummaryResponse.fromEntity(appointment.getFarm()),
                appointment.getProvider() != null ? appointment.getProvider().getId() : null,
                ProviderSummaryResponse.fromEntity(appointment.getProvider()),
                appointment.getStatus(),
                appointment.getMethod(),
                appointment.getScheduledDate(),
                appointment.getScheduledTimeSlot(),
                appointment.getNotes(),
                appointment.getCreatedAt(),
                appointment.getUpdatedAt()
        );
    }
}

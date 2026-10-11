package com.agrismart.dto.appointment;

import com.agrismart.entity.AppointmentMethod;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.UUID;

public record CreateAppointmentRequest(
        @NotNull(message = "Farm ID is required")
        UUID farmId,

        @NotNull(message = "Provider ID is required")
        UUID providerId,

        @NotNull(message = "Appointment method is required (SAMPLE_COLLECTION or LAB_VISIT)")
        AppointmentMethod method,

        @NotNull(message = "Scheduled date is required")
        @FutureOrPresent(message = "Scheduled date cannot be in the past")
        LocalDate scheduledDate,

        @NotBlank(message = "Scheduled time slot is required (e.g., '09:00 AM - 11:00 AM')")
        @Size(max = 100, message = "Time slot must not exceed 100 characters")
        String scheduledTimeSlot,

        @Size(max = 1000, message = "Notes must not exceed 1000 characters")
        String notes
) {
}

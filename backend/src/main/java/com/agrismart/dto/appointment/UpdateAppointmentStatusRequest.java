package com.agrismart.dto.appointment;

import com.agrismart.entity.AppointmentStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateAppointmentStatusRequest(
        @NotNull(message = "Target status is required")
        AppointmentStatus status,

        @Size(max = 500, message = "Status change reason must not exceed 500 characters")
        String reason
) {
}

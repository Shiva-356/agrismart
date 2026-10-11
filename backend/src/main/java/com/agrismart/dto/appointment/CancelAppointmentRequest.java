package com.agrismart.dto.appointment;

import jakarta.validation.constraints.Size;

public record CancelAppointmentRequest(
        @Size(max = 500, message = "Cancellation reason must not exceed 500 characters")
        String reason
) {
}

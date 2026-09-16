package com.agrismart.entity;

/**
 * Controlled lifecycle stages of a soil testing appointment.
 */
public enum AppointmentStatus {
    BOOKED,
    CONFIRMED,
    SAMPLE_COLLECTED,
    TESTING,
    REPORT_READY,
    COMPLETED,
    CANCELLED
}

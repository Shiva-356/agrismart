package com.agrismart.controller;

import com.agrismart.dto.appointment.AppointmentResponse;
import com.agrismart.dto.appointment.CancelAppointmentRequest;
import com.agrismart.dto.appointment.CreateAppointmentRequest;
import com.agrismart.dto.appointment.FarmSummaryResponse;
import com.agrismart.dto.appointment.UpdateAppointmentStatusRequest;
import com.agrismart.dto.provider.ProviderSummaryResponse;
import com.agrismart.entity.AppointmentMethod;
import com.agrismart.entity.AppointmentStatus;
import com.agrismart.exception.BusinessRuleViolationException;
import com.agrismart.exception.GlobalExceptionHandler;
import com.agrismart.exception.InvalidStatusTransitionException;
import com.agrismart.exception.ResourceNotFoundException;
import com.agrismart.service.AppointmentService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AppointmentControllerTest {

    private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Mock
    private AppointmentService appointmentService;

    @InjectMocks
    private AppointmentController appointmentController;

    private UUID appointmentId;
    private UUID farmId;
    private UUID providerId;
    private AppointmentResponse sampleResponse;

    @BeforeEach
    void setUp() {
        objectMapper.registerModule(new JavaTimeModule());

        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();

        this.mockMvc = MockMvcBuilders
                .standaloneSetup(appointmentController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setValidator(validator)
                .build();

        appointmentId = UUID.randomUUID();
        farmId = UUID.randomUUID();
        providerId = UUID.randomUUID();

        FarmSummaryResponse farmSummary = new FarmSummaryResponse(
                farmId,
                "Green Valley Field",
                "Warangal Rural",
                "Warangal",
                BigDecimal.valueOf(4.5)
        );

        ProviderSummaryResponse providerSummary = new ProviderSummaryResponse(
                providerId,
                "Telangana State Soil Testing Lab",
                "Government Soil Testing Lab",
                "Rajendranagar, Hyderabad",
                "+91 40 2401 5011",
                true,
                true
        );

        sampleResponse = new AppointmentResponse(
                appointmentId,
                farmId,
                farmSummary,
                providerId,
                providerSummary,
                AppointmentStatus.BOOKED,
                AppointmentMethod.SAMPLE_COLLECTION,
                LocalDate.now().plusDays(3),
                "09:00 AM - 11:00 AM",
                "Soil sample from north parcel",
                Instant.now(),
                Instant.now()
        );
    }

    @Test
    void createAppointmentReturnsCreatedWithLocation() throws Exception {
        CreateAppointmentRequest request = new CreateAppointmentRequest(
                farmId,
                providerId,
                AppointmentMethod.SAMPLE_COLLECTION,
                LocalDate.now().plusDays(3),
                "09:00 AM - 11:00 AM",
                "Soil sample from north parcel"
        );

        when(appointmentService.createAppointment(any(CreateAppointmentRequest.class))).thenReturn(sampleResponse);

        mockMvc.perform(post("/api/appointments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", containsString("/api/appointments/" + appointmentId)))
                .andExpect(jsonPath("$.id", is(appointmentId.toString())))
                .andExpect(jsonPath("$.farmId", is(farmId.toString())))
                .andExpect(jsonPath("$.providerId", is(providerId.toString())))
                .andExpect(jsonPath("$.status", is("BOOKED")))
                .andExpect(jsonPath("$.method", is("SAMPLE_COLLECTION")))
                // Verify embedded summary objects rather than raw entities
                .andExpect(jsonPath("$.farm.name", is("Green Valley Field")))
                .andExpect(jsonPath("$.provider.name", is("Telangana State Soil Testing Lab")));
    }

    @Test
    void createAppointmentWithNonexistentFarmReturnsNotFound() throws Exception {
        CreateAppointmentRequest request = new CreateAppointmentRequest(
                farmId,
                providerId,
                AppointmentMethod.SAMPLE_COLLECTION,
                LocalDate.now().plusDays(2),
                "10:00 AM - 12:00 PM",
                null
        );

        when(appointmentService.createAppointment(any(CreateAppointmentRequest.class)))
                .thenThrow(new ResourceNotFoundException("Farm not found with ID: " + farmId));

        mockMvc.perform(post("/api/appointments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status", is(404)))
                .andExpect(jsonPath("$.error", is("RESOURCE_NOT_FOUND")))
                .andExpect(jsonPath("$.message", containsString("Farm not found")));
    }

    @Test
    void createAppointmentWithNonexistentProviderReturnsNotFound() throws Exception {
        CreateAppointmentRequest request = new CreateAppointmentRequest(
                farmId,
                providerId,
                AppointmentMethod.LAB_VISIT,
                LocalDate.now().plusDays(2),
                "10:00 AM - 12:00 PM",
                null
        );

        when(appointmentService.createAppointment(any(CreateAppointmentRequest.class)))
                .thenThrow(new ResourceNotFoundException("Soil testing provider not found with ID: " + providerId));

        mockMvc.perform(post("/api/appointments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status", is(404)))
                .andExpect(jsonPath("$.error", is("RESOURCE_NOT_FOUND")))
                .andExpect(jsonPath("$.message", containsString("Soil testing provider not found")));
    }

    @Test
    void createAppointmentWhenProviderNotAcceptingSamplesReturnsUnprocessableEntity() throws Exception {
        CreateAppointmentRequest request = new CreateAppointmentRequest(
                farmId,
                providerId,
                AppointmentMethod.SAMPLE_COLLECTION,
                LocalDate.now().plusDays(4),
                "02:00 PM - 04:00 PM",
                null
        );

        when(appointmentService.createAppointment(any(CreateAppointmentRequest.class)))
                .thenThrow(new BusinessRuleViolationException("Selected provider is not currently accepting new soil samples"));

        mockMvc.perform(post("/api/appointments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.status", is(422)))
                .andExpect(jsonPath("$.error", is("BUSINESS_RULE_VIOLATION")))
                .andExpect(jsonPath("$.message", containsString("not currently accepting new soil samples")));
    }

    @Test
    void createAppointmentWithPastDateReturnsBadRequest() throws Exception {
        CreateAppointmentRequest pastRequest = new CreateAppointmentRequest(
                farmId,
                providerId,
                AppointmentMethod.SAMPLE_COLLECTION,
                LocalDate.now().minusDays(5), // Past date violates @FutureOrPresent
                "09:00 AM - 11:00 AM",
                null
        );

        mockMvc.perform(post("/api/appointments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(pastRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status", is(400)))
                .andExpect(jsonPath("$.error", is("VALIDATION_ERROR")))
                .andExpect(jsonPath("$.fieldErrors.scheduledDate").exists());
    }

    @Test
    void getAppointmentByIdReturnsAppointment() throws Exception {
        when(appointmentService.getAppointmentById(appointmentId)).thenReturn(sampleResponse);

        mockMvc.perform(get("/api/appointments/{id}", appointmentId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(appointmentId.toString())))
                .andExpect(jsonPath("$.status", is("BOOKED")));
    }

    @Test
    void listAppointmentsWithFiltersReturnsList() throws Exception {
        when(appointmentService.listAppointments(farmId, providerId, AppointmentStatus.BOOKED))
                .thenReturn(List.of(sampleResponse));

        mockMvc.perform(get("/api/appointments")
                        .param("farmId", farmId.toString())
                        .param("providerId", providerId.toString())
                        .param("status", "BOOKED"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id", is(appointmentId.toString())));

        verify(appointmentService).listAppointments(farmId, providerId, AppointmentStatus.BOOKED);
    }

    @Test
    void updateAppointmentStatusTransitionsSuccessfully() throws Exception {
        UpdateAppointmentStatusRequest request = new UpdateAppointmentStatusRequest(
                AppointmentStatus.CONFIRMED,
                "Provider accepted slot"
        );

        AppointmentResponse updatedResponse = new AppointmentResponse(
                appointmentId,
                farmId,
                sampleResponse.farm(),
                providerId,
                sampleResponse.provider(),
                AppointmentStatus.CONFIRMED,
                sampleResponse.method(),
                sampleResponse.scheduledDate(),
                sampleResponse.scheduledTimeSlot(),
                "Status changed to CONFIRMED: Provider accepted slot",
                sampleResponse.createdAt(),
                Instant.now()
        );

        when(appointmentService.updateAppointmentStatus(eq(appointmentId), any(UpdateAppointmentStatusRequest.class)))
                .thenReturn(updatedResponse);

        mockMvc.perform(patch("/api/appointments/{id}/status", appointmentId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("CONFIRMED")));
    }

    @Test
    void updateAppointmentStatusInvalidTransitionReturnsConflict() throws Exception {
        // Skipping states: BOOKED directly to TESTING
        UpdateAppointmentStatusRequest invalidRequest = new UpdateAppointmentStatusRequest(
                AppointmentStatus.TESTING,
                "Attempting to skip to testing"
        );

        when(appointmentService.updateAppointmentStatus(eq(appointmentId), any(UpdateAppointmentStatusRequest.class)))
                .thenThrow(new InvalidStatusTransitionException("Invalid status transition from BOOKED to TESTING"));

        mockMvc.perform(patch("/api/appointments/{id}/status", appointmentId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status", is(409)))
                .andExpect(jsonPath("$.error", is("INVALID_STATUS_TRANSITION")))
                .andExpect(jsonPath("$.message", containsString("Invalid status transition from BOOKED to TESTING")));
    }

    @Test
    void cancelAppointmentReturnsCancelledStatus() throws Exception {
        CancelAppointmentRequest request = new CancelAppointmentRequest("Farmer rescheduled field preparation");

        AppointmentResponse cancelledResponse = new AppointmentResponse(
                appointmentId,
                farmId,
                sampleResponse.farm(),
                providerId,
                sampleResponse.provider(),
                AppointmentStatus.CANCELLED,
                sampleResponse.method(),
                sampleResponse.scheduledDate(),
                sampleResponse.scheduledTimeSlot(),
                "Cancellation reason: Farmer rescheduled field preparation",
                sampleResponse.createdAt(),
                Instant.now()
        );

        when(appointmentService.cancelAppointment(eq(appointmentId), any(CancelAppointmentRequest.class)))
                .thenReturn(cancelledResponse);

        mockMvc.perform(post("/api/appointments/{id}/cancel", appointmentId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("CANCELLED")));
    }

    @Test
    void cancelAppointmentInTerminalStatusReturnsConflict() throws Exception {
        CancelAppointmentRequest request = new CancelAppointmentRequest("Attempting to re-cancel");

        when(appointmentService.cancelAppointment(eq(appointmentId), any(CancelAppointmentRequest.class)))
                .thenThrow(new InvalidStatusTransitionException("Cannot modify appointment in terminal status: CANCELLED"));

        mockMvc.perform(post("/api/appointments/{id}/cancel", appointmentId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status", is(409)))
                .andExpect(jsonPath("$.error", is("INVALID_STATUS_TRANSITION")))
                .andExpect(jsonPath("$.message", containsString("terminal status")));
    }
}

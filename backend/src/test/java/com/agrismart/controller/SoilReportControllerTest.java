package com.agrismart.controller;

import com.agrismart.dto.soilreport.CreateSoilReportRequest;
import com.agrismart.dto.soilreport.SoilMeasurementAvailability;
import com.agrismart.dto.soilreport.SoilReportResponse;
import com.agrismart.dto.soilreport.VerifySoilReportRequest;
import com.agrismart.exception.BusinessRuleViolationException;
import com.agrismart.exception.GlobalExceptionHandler;
import com.agrismart.exception.InvalidStatusTransitionException;
import com.agrismart.exception.ResourceNotFoundException;
import com.agrismart.service.SoilReportService;
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
class SoilReportControllerTest {

    private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Mock
    private SoilReportService soilReportService;

    @InjectMocks
    private SoilReportController soilReportController;

    private UUID reportId;
    private UUID farmId;
    private UUID appointmentId;
    private SoilReportResponse sampleResponse;

    @BeforeEach
    void setUp() {
        objectMapper.registerModule(new JavaTimeModule());

        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();

        mockMvc = MockMvcBuilders.standaloneSetup(soilReportController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setValidator(validator)
                .build();

        reportId = UUID.randomUUID();
        farmId = UUID.randomUUID();
        appointmentId = UUID.randomUUID();

        SoilMeasurementAvailability availability = new SoilMeasurementAvailability(
                true, true, true, true, true, true, true
        );

        sampleResponse = new SoilReportResponse(
                reportId,
                farmId,
                "Sri Lakshmi Farm",
                appointmentId,
                "Telangana State Soil Testing Laboratory",
                "WAR-2026-0042",
                LocalDate.now(),
                false,
                new BigDecimal("185.50"),
                new BigDecimal("32.40"),
                new BigDecimal("210.00"),
                new BigDecimal("6.80"),
                new BigDecimal("0.75"),
                new BigDecimal("0.65"),
                "Authentic lab result",
                availability,
                Instant.now(),
                Instant.now()
        );
    }

    @Test
    void createReportSuccessReturns201AndLocationHeader() throws Exception {
        CreateSoilReportRequest request = new CreateSoilReportRequest(
                farmId,
                appointmentId,
                "Telangana State Soil Testing Laboratory",
                "WAR-2026-0042",
                LocalDate.now(),
                new BigDecimal("185.50"),
                new BigDecimal("32.40"),
                new BigDecimal("210.00"),
                new BigDecimal("6.80"),
                new BigDecimal("0.75"),
                new BigDecimal("0.65"),
                "Authentic lab result"
        );

        when(soilReportService.createReport(any(CreateSoilReportRequest.class))).thenReturn(sampleResponse);

        mockMvc.perform(post("/api/soil-reports")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", containsString("/api/soil-reports/" + reportId)))
                .andExpect(jsonPath("$.id", is(reportId.toString())))
                .andExpect(jsonPath("$.verified", is(false)))
                .andExpect(jsonPath("$.availability.isMlFeatureReady", is(true)))
                .andExpect(jsonPath("$.nitrogen", is(185.50)));

        verify(soilReportService).createReport(any(CreateSoilReportRequest.class));
    }

    @Test
    void createReportMissingFarmIdReturns400() throws Exception {
        CreateSoilReportRequest request = new CreateSoilReportRequest(
                null, // Missing farmId
                appointmentId,
                "Laboratory A",
                "SAMP-1",
                LocalDate.now(),
                null, null, null, null, null, null, null
        );

        mockMvc.perform(post("/api/soil-reports")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", is("VALIDATION_ERROR")))
                .andExpect(jsonPath("$.validationErrors.farmId", containsString("Farm ID is required")));
    }

    @Test
    void createReportBlankLaboratoryNameReturns400() throws Exception {
        CreateSoilReportRequest request = new CreateSoilReportRequest(
                farmId,
                appointmentId,
                "   ", // Blank laboratoryName
                "SAMP-1",
                LocalDate.now(),
                null, null, null, null, null, null, null
        );

        mockMvc.perform(post("/api/soil-reports")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", is("VALIDATION_ERROR")))
                .andExpect(jsonPath("$.validationErrors.laboratoryName", containsString("Laboratory name is required")));
    }

    @Test
    void createReportFutureTestDateReturns400() throws Exception {
        CreateSoilReportRequest request = new CreateSoilReportRequest(
                farmId,
                appointmentId,
                "Laboratory A",
                "SAMP-1",
                LocalDate.now().plusDays(2), // Future date
                null, null, null, null, null, null, null
        );

        mockMvc.perform(post("/api/soil-reports")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", is("VALIDATION_ERROR")))
                .andExpect(jsonPath("$.validationErrors.testDate", containsString("cannot be in the future")));
    }

    @Test
    void createReportNegativeNitrogenReturns400() throws Exception {
        CreateSoilReportRequest request = new CreateSoilReportRequest(
                farmId,
                appointmentId,
                "Laboratory A",
                "SAMP-1",
                LocalDate.now(),
                new BigDecimal("-5.0"), // Negative N
                null, null, null, null, null, null
        );

        mockMvc.perform(post("/api/soil-reports")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", is("VALIDATION_ERROR")))
                .andExpect(jsonPath("$.validationErrors.nitrogen", containsString("cannot be negative")));
    }

    @Test
    void createReportPhOutOfRangeReturns400() throws Exception {
        CreateSoilReportRequest request = new CreateSoilReportRequest(
                farmId,
                appointmentId,
                "Laboratory A",
                "SAMP-1",
                LocalDate.now(),
                null, null, null,
                new BigDecimal("15.5"), // Out of standard physical bounds
                null, null, null
        );

        mockMvc.perform(post("/api/soil-reports")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", is("VALIDATION_ERROR")))
                .andExpect(jsonPath("$.validationErrors.ph", containsString("pH cannot exceed 14.0")));
    }

    @Test
    void createReportAppointmentFarmMismatchReturns422() throws Exception {
        CreateSoilReportRequest request = new CreateSoilReportRequest(
                farmId,
                appointmentId,
                "Laboratory A",
                "SAMP-1",
                LocalDate.now(),
                null, null, null, null, null, null, null
        );

        when(soilReportService.createReport(any(CreateSoilReportRequest.class)))
                .thenThrow(new BusinessRuleViolationException("Appointment does not belong to farm " + farmId));

        mockMvc.perform(post("/api/soil-reports")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.error", is("BUSINESS_RULE_VIOLATION")))
                .andExpect(jsonPath("$.message", containsString("does not belong to farm")));
    }

    @Test
    void createReportInvalidAppointmentStateReturns409() throws Exception {
        CreateSoilReportRequest request = new CreateSoilReportRequest(
                farmId,
                appointmentId,
                "Laboratory A",
                "SAMP-1",
                LocalDate.now(),
                null, null, null, null, null, null, null
        );

        when(soilReportService.createReport(any(CreateSoilReportRequest.class)))
                .thenThrow(new InvalidStatusTransitionException("Appointment must be in TESTING status"));

        mockMvc.perform(post("/api/soil-reports")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error", is("INVALID_STATUS_TRANSITION")))
                .andExpect(jsonPath("$.message", containsString("must be in TESTING status")));
    }

    @Test
    void getReportByIdSuccessReturns200() throws Exception {
        when(soilReportService.getReportById(reportId)).thenReturn(sampleResponse);

        mockMvc.perform(get("/api/soil-reports/{id}", reportId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(reportId.toString())))
                .andExpect(jsonPath("$.laboratoryName", is("Telangana State Soil Testing Laboratory")))
                .andExpect(jsonPath("$.verified", is(false)));
    }

    @Test
    void getReportByIdNotFoundReturns404() throws Exception {
        UUID nonExistentId = UUID.randomUUID();
        when(soilReportService.getReportById(nonExistentId))
                .thenThrow(new ResourceNotFoundException("Soil report not found with ID: " + nonExistentId));

        mockMvc.perform(get("/api/soil-reports/{id}", nonExistentId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error", is("RESOURCE_NOT_FOUND")))
                .andExpect(jsonPath("$.message", containsString("not found with ID: " + nonExistentId)));
    }

    @Test
    void listReportsByFarmReturnsList() throws Exception {
        when(soilReportService.listReports(eq(farmId), eq(null))).thenReturn(List.of(sampleResponse));

        mockMvc.perform(get("/api/soil-reports").param("farmId", farmId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id", is(reportId.toString())));
    }

    @Test
    void getLatestReportReturns200() throws Exception {
        when(soilReportService.getLatestReport(farmId)).thenReturn(sampleResponse);

        mockMvc.perform(get("/api/soil-reports/latest").param("farmId", farmId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(reportId.toString())))
                .andExpect(jsonPath("$.sampleId", is("WAR-2026-0042")));
    }

    @Test
    void verifyReportSuccessReturns200() throws Exception {
        SoilMeasurementAvailability avail = new SoilMeasurementAvailability(
                true, true, true, true, true, true, true
        );
        SoilReportResponse verifiedResponse = new SoilReportResponse(
                reportId,
                farmId,
                "Sri Lakshmi Farm",
                appointmentId,
                "Telangana State Soil Testing Laboratory",
                "WAR-2026-0042",
                LocalDate.now(),
                true, // Verified
                new BigDecimal("185.50"),
                new BigDecimal("32.40"),
                new BigDecimal("210.00"),
                new BigDecimal("6.80"),
                new BigDecimal("0.75"),
                new BigDecimal("0.65"),
                "Verified: Lead Officer Approved",
                avail,
                Instant.now(),
                Instant.now()
        );

        VerifySoilReportRequest request = new VerifySoilReportRequest("Lead Officer Approved");
        when(soilReportService.verifyReport(eq(reportId), any(VerifySoilReportRequest.class)))
                .thenReturn(verifiedResponse);

        mockMvc.perform(patch("/api/soil-reports/{id}/verify", reportId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(reportId.toString())))
                .andExpect(jsonPath("$.verified", is(true)))
                .andExpect(jsonPath("$.notes", containsString("Lead Officer Approved")));
    }
}

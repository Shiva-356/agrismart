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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoilReportServiceTest {

    @Mock
    private SoilReportRepository soilReportRepository;

    @Mock
    private FarmRepository farmRepository;

    @Mock
    private AppointmentRepository appointmentRepository;

    @InjectMocks
    private SoilReportService soilReportService;

    private UUID farmId;
    private UUID appointmentId;
    private UUID reportId;
    private Farm mockFarm;
    private Appointment mockAppointment;
    private SoilReport mockReport;

    @BeforeEach
    void setUp() {
        farmId = UUID.randomUUID();
        appointmentId = UUID.randomUUID();
        reportId = UUID.randomUUID();

        mockFarm = new Farm();
        mockFarm.setId(farmId);
        mockFarm.setName("Sri Lakshmi Farm");

        mockAppointment = new Appointment();
        mockAppointment.setId(appointmentId);
        mockAppointment.setFarm(mockFarm);
        mockAppointment.setStatus(AppointmentStatus.TESTING);

        mockReport = new SoilReport();
        mockReport.setId(reportId);
        mockReport.setFarm(mockFarm);
        mockReport.setAppointment(mockAppointment);
        mockReport.setLaboratoryName("Telangana State Soil Testing Laboratory");
        mockReport.setSampleId("WAR-2026-0042");
        mockReport.setTestDate(LocalDate.now());
        mockReport.setVerified(false);
        mockReport.setNitrogen(new BigDecimal("185.50"));
        mockReport.setPhosphorus(new BigDecimal("32.40"));
        mockReport.setPotassium(new BigDecimal("210.00"));
        mockReport.setPh(new BigDecimal("6.80"));
        mockReport.setElectricalConductivity(new BigDecimal("0.75"));
        mockReport.setOrganicCarbon(new BigDecimal("0.65"));
        mockReport.setCreatedAt(Instant.now());
        mockReport.setUpdatedAt(Instant.now());
    }

    @Test
    void createReportSuccessfullyAdvancesTestingAppointmentToReportReady() {
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
                "Core test complete"
        );

        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(appointmentRepository.findById(appointmentId)).thenReturn(Optional.of(mockAppointment));
        when(soilReportRepository.save(any(SoilReport.class))).thenAnswer(inv -> {
            SoilReport r = inv.getArgument(0);
            r.setId(reportId);
            r.setCreatedAt(Instant.now());
            r.setUpdatedAt(Instant.now());
            return r;
        });

        SoilReportResponse response = soilReportService.createReport(request);

        assertThat(response).isNotNull();
        assertThat(response.id()).isEqualTo(reportId);
        assertThat(response.verified()).isFalse(); // Initial state MUST be false
        assertThat(response.nitrogen()).isEqualByComparingTo("185.50");
        assertThat(response.availability().hasNitrogen()).isTrue();
        assertThat(response.availability().isMlFeatureReady()).isTrue();

        // Verify appointment transitioned from TESTING to REPORT_READY
        assertThat(mockAppointment.getStatus()).isEqualTo(AppointmentStatus.REPORT_READY);
        assertThat(mockAppointment.getNotes()).contains("Status changed to REPORT_READY: Soil report created");
        verify(appointmentRepository).save(mockAppointment);
        verify(soilReportRepository).save(any(SoilReport.class));
    }

    @Test
    void createReportWithoutAppointmentSucceeds() {
        CreateSoilReportRequest request = new CreateSoilReportRequest(
                farmId,
                null,
                "Direct Lab Ingestion",
                "EXT-998",
                LocalDate.now(),
                new BigDecimal("120.00"),
                new BigDecimal("25.00"),
                new BigDecimal("180.00"),
                new BigDecimal("7.20"),
                null,
                null,
                null
        );

        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(soilReportRepository.save(any(SoilReport.class))).thenAnswer(inv -> {
            SoilReport r = inv.getArgument(0);
            r.setId(reportId);
            r.setCreatedAt(Instant.now());
            r.setUpdatedAt(Instant.now());
            return r;
        });

        SoilReportResponse response = soilReportService.createReport(request);

        assertThat(response).isNotNull();
        assertThat(response.appointmentId()).isNull();
        assertThat(response.verified()).isFalse();
        verify(appointmentRepository, never()).save(any());
        verify(soilReportRepository).save(any(SoilReport.class));
    }

    @Test
    void createReportWithNullableMeasurementsLeavesNullsAndSetsMlReadinessAccurately() {
        // Report with missing potassium and electricalConductivity
        CreateSoilReportRequest request = new CreateSoilReportRequest(
                farmId,
                null,
                "Selective Assay Lab",
                "SAM-11",
                LocalDate.now(),
                new BigDecimal("140.00"),
                new BigDecimal("22.00"),
                null, // Missing K
                new BigDecimal("6.50"),
                null, // Missing EC
                new BigDecimal("0.50"),
                null
        );

        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(soilReportRepository.save(any(SoilReport.class))).thenAnswer(inv -> {
            SoilReport r = inv.getArgument(0);
            r.setId(reportId);
            r.setCreatedAt(Instant.now());
            r.setUpdatedAt(Instant.now());
            return r;
        });

        SoilReportResponse response = soilReportService.createReport(request);

        assertThat(response.potassium()).isNull(); // NEVER converted to zero!
        assertThat(response.electricalConductivity()).isNull();
        assertThat(response.availability().hasPotassium()).isFalse();
        assertThat(response.availability().hasElectricalConductivity()).isFalse();
        // Since potassium is null, isMlFeatureReady MUST be false
        assertThat(response.availability().isMlFeatureReady()).isFalse();
    }

    @Test
    void createReportNonexistentFarmThrowsResourceNotFound() {
        CreateSoilReportRequest request = new CreateSoilReportRequest(
                farmId,
                null,
                "Lab A",
                null,
                LocalDate.now(),
                null, null, null, null, null, null, null
        );

        when(farmRepository.findById(farmId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> soilReportService.createReport(request))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Farm not found");
    }

    @Test
    void createReportNonexistentAppointmentThrowsResourceNotFound() {
        CreateSoilReportRequest request = new CreateSoilReportRequest(
                farmId,
                appointmentId,
                "Lab A",
                null,
                LocalDate.now(),
                null, null, null, null, null, null, null
        );

        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(appointmentRepository.findById(appointmentId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> soilReportService.createReport(request))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Appointment not found");
    }

    @Test
    void createReportAppointmentFarmMismatchThrowsBusinessRuleViolation() {
        Farm anotherFarm = new Farm();
        anotherFarm.setId(UUID.randomUUID());
        mockAppointment.setFarm(anotherFarm); // Mismatched farm

        CreateSoilReportRequest request = new CreateSoilReportRequest(
                farmId,
                appointmentId,
                "Lab A",
                null,
                LocalDate.now(),
                null, null, null, null, null, null, null
        );

        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(appointmentRepository.findById(appointmentId)).thenReturn(Optional.of(mockAppointment));

        assertThatThrownBy(() -> soilReportService.createReport(request))
                .isInstanceOf(BusinessRuleViolationException.class)
                .hasMessageContaining("does not belong to farm");
    }

    @Test
    void createReportForCancelledAppointmentThrowsConflict() {
        mockAppointment.setStatus(AppointmentStatus.CANCELLED);

        CreateSoilReportRequest request = new CreateSoilReportRequest(
                farmId,
                appointmentId,
                "Lab A",
                null,
                LocalDate.now(),
                null, null, null, null, null, null, null
        );

        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(appointmentRepository.findById(appointmentId)).thenReturn(Optional.of(mockAppointment));

        assertThatThrownBy(() -> soilReportService.createReport(request))
                .isInstanceOf(InvalidStatusTransitionException.class)
                .hasMessageContaining("Cannot create soil report for a cancelled appointment");
    }

    @Test
    void createReportForAppointmentNotInTestingThrowsConflict() {
        mockAppointment.setStatus(AppointmentStatus.BOOKED); // Not yet in TESTING

        CreateSoilReportRequest request = new CreateSoilReportRequest(
                farmId,
                appointmentId,
                "Lab A",
                null,
                LocalDate.now(),
                null, null, null, null, null, null, null
        );

        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(appointmentRepository.findById(appointmentId)).thenReturn(Optional.of(mockAppointment));

        assertThatThrownBy(() -> soilReportService.createReport(request))
                .isInstanceOf(InvalidStatusTransitionException.class)
                .hasMessageContaining("Appointment must be in TESTING status before generating a soil report");
    }

    @Test
    void createReportForAppointmentAlreadyReportReadySucceedsAsReplacement() {
        mockAppointment.setStatus(AppointmentStatus.REPORT_READY);

        CreateSoilReportRequest request = new CreateSoilReportRequest(
                farmId,
                appointmentId,
                "Lab A",
                "REPLACEMENT-01",
                LocalDate.now(),
                new BigDecimal("100"), new BigDecimal("20"), new BigDecimal("150"), new BigDecimal("7.0"),
                null, null, "Replacement report"
        );

        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(appointmentRepository.findById(appointmentId)).thenReturn(Optional.of(mockAppointment));
        when(soilReportRepository.save(any(SoilReport.class))).thenAnswer(inv -> inv.getArgument(0));

        SoilReportResponse response = soilReportService.createReport(request);

        assertThat(response).isNotNull();
        assertThat(mockAppointment.getStatus()).isEqualTo(AppointmentStatus.REPORT_READY);
    }

    @Test
    void getReportByIdReturnsResponse() {
        when(soilReportRepository.findById(reportId)).thenReturn(Optional.of(mockReport));

        SoilReportResponse response = soilReportService.getReportById(reportId);

        assertThat(response.id()).isEqualTo(reportId);
        assertThat(response.laboratoryName()).isEqualTo("Telangana State Soil Testing Laboratory");
    }

    @Test
    void getReportByIdNotFoundThrows() {
        UUID randomId = UUID.randomUUID();
        when(soilReportRepository.findById(randomId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> soilReportService.getReportById(randomId))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Soil report not found with ID: " + randomId);
    }

    @Test
    void listReportsByFarmReturnsOrderedList() {
        when(farmRepository.existsById(farmId)).thenReturn(true);
        when(soilReportRepository.findByFarmIdOrderByTestDateDescCreatedAtDesc(farmId)).thenReturn(List.of(mockReport));

        List<SoilReportResponse> list = soilReportService.listReports(farmId, null);

        assertThat(list).hasSize(1);
        assertThat(list.get(0).id()).isEqualTo(reportId);
        verify(soilReportRepository).findByFarmIdOrderByTestDateDescCreatedAtDesc(farmId);
    }

    @Test
    void listReportsWithVerifiedFilterCallsFilteredQuery() {
        when(farmRepository.existsById(farmId)).thenReturn(true);
        when(soilReportRepository.findByFarmIdAndVerifiedOrderByTestDateDescCreatedAtDesc(farmId, true))
                .thenReturn(List.of());

        List<SoilReportResponse> list = soilReportService.listReports(farmId, true);

        assertThat(list).isEmpty();
        verify(soilReportRepository).findByFarmIdAndVerifiedOrderByTestDateDescCreatedAtDesc(farmId, true);
    }

    @Test
    void getLatestReportReturnsOrderedLatest() {
        when(farmRepository.existsById(farmId)).thenReturn(true);
        when(soilReportRepository.findTopByFarmIdOrderByTestDateDescCreatedAtDesc(farmId))
                .thenReturn(Optional.of(mockReport));

        SoilReportResponse latest = soilReportService.getLatestReport(farmId);

        assertThat(latest.id()).isEqualTo(reportId);
        assertThat(latest.testDate()).isEqualTo(mockReport.getTestDate());
    }

    @Test
    void getLatestReportWhenNoneExistsThrowsNotFound() {
        when(farmRepository.existsById(farmId)).thenReturn(true);
        when(soilReportRepository.findTopByFarmIdOrderByTestDateDescCreatedAtDesc(farmId))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> soilReportService.getLatestReport(farmId))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("No soil report found for farm ID: " + farmId);
    }

    @Test
    void verifyReportSetsVerifiedTrueAndAppendsRemarks() {
        when(soilReportRepository.findById(reportId)).thenReturn(Optional.of(mockReport));
        when(soilReportRepository.save(any(SoilReport.class))).thenAnswer(inv -> inv.getArgument(0));

        VerifySoilReportRequest request = new VerifySoilReportRequest("Verified by Dr. R. Sharma, Senior Chemist");
        SoilReportResponse verified = soilReportService.verifyReport(reportId, request);

        assertThat(verified.verified()).isTrue();
        assertThat(mockReport.isVerified()).isTrue();
        assertThat(mockReport.getNotes()).contains("Verified: Verified by Dr. R. Sharma, Senior Chemist");
    }

    @Test
    void verifyAlreadyVerifiedReportIsIdempotentAndSafe() {
        mockReport.setVerified(true);
        mockReport.setNotes("Existing verification notes");

        when(soilReportRepository.findById(reportId)).thenReturn(Optional.of(mockReport));

        VerifySoilReportRequest request = new VerifySoilReportRequest("Secondary attempt");
        SoilReportResponse result = soilReportService.verifyReport(reportId, request);

        assertThat(result.verified()).isTrue();
        assertThat(mockReport.getNotes()).isEqualTo("Existing verification notes");
        verify(soilReportRepository, never()).save(any());
    }
}

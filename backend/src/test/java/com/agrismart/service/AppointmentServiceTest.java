package com.agrismart.service;

import com.agrismart.dto.appointment.AppointmentResponse;
import com.agrismart.dto.appointment.CancelAppointmentRequest;
import com.agrismart.dto.appointment.CreateAppointmentRequest;
import com.agrismart.dto.appointment.UpdateAppointmentStatusRequest;
import com.agrismart.entity.Appointment;
import com.agrismart.entity.AppointmentMethod;
import com.agrismart.entity.AppointmentStatus;
import com.agrismart.entity.Farm;
import com.agrismart.entity.SoilTestingProvider;
import com.agrismart.exception.BusinessRuleViolationException;
import com.agrismart.exception.InvalidStatusTransitionException;
import com.agrismart.exception.ResourceNotFoundException;
import com.agrismart.repository.AppointmentRepository;
import com.agrismart.repository.FarmRepository;
import com.agrismart.repository.SoilTestingProviderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.jpa.domain.Specification;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AppointmentServiceTest {

    @Mock
    private AppointmentRepository appointmentRepository;

    @Mock
    private FarmRepository farmRepository;

    @Mock
    private SoilTestingProviderRepository providerRepository;

    @InjectMocks
    private AppointmentService appointmentService;

    private UUID farmId;
    private UUID providerId;
    private UUID appointmentId;
    private Farm mockFarm;
    private SoilTestingProvider mockProvider;
    private Appointment mockAppointment;

    @BeforeEach
    void setUp() {
        farmId = UUID.randomUUID();
        providerId = UUID.randomUUID();
        appointmentId = UUID.randomUUID();

        mockFarm = new Farm();
        mockFarm.setId(farmId);
        mockFarm.setName("Sri Lakshmi Farm");
        mockFarm.setLocation("Narsampet Road");
        mockFarm.setDistrict("Warangal");
        mockFarm.setLandAreaAcres(BigDecimal.valueOf(5.0));

        mockProvider = new SoilTestingProvider();
        mockProvider.setId(providerId);
        mockProvider.setName("Telangana Soil Testing Lab");
        mockProvider.setType("Government Soil Testing Lab");
        mockProvider.setAddress("Rajendranagar, Hyderabad");
        mockProvider.setPhone("+91 40 2401 5011");
        mockProvider.setVerified(true);
        mockProvider.setAcceptingSamples(true);

        mockAppointment = new Appointment();
        mockAppointment.setId(appointmentId);
        mockAppointment.setFarm(mockFarm);
        mockAppointment.setProvider(mockProvider);
        mockAppointment.setStatus(AppointmentStatus.BOOKED);
        mockAppointment.setMethod(AppointmentMethod.SAMPLE_COLLECTION);
        mockAppointment.setScheduledDate(LocalDate.now().plusDays(3));
        mockAppointment.setScheduledTimeSlot("09:00 AM - 11:00 AM");
        mockAppointment.setNotes("Baseline test");
        mockAppointment.setCreatedAt(Instant.now());
        mockAppointment.setUpdatedAt(Instant.now());
    }

    @Test
    void createAppointmentSuccess() {
        CreateAppointmentRequest request = new CreateAppointmentRequest(
                farmId,
                providerId,
                AppointmentMethod.SAMPLE_COLLECTION,
                LocalDate.now().plusDays(4),
                "10:00 AM - 12:00 PM",
                "Field ready for core sampling"
        );

        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(providerRepository.findById(providerId)).thenReturn(Optional.of(mockProvider));
        when(appointmentRepository.save(any(Appointment.class))).thenAnswer(inv -> {
            Appointment a = inv.getArgument(0);
            a.setId(UUID.randomUUID());
            a.setCreatedAt(Instant.now());
            a.setUpdatedAt(Instant.now());
            return a;
        });

        AppointmentResponse response = appointmentService.createAppointment(request);

        assertThat(response).isNotNull();
        assertThat(response.status()).isEqualTo(AppointmentStatus.BOOKED);
        assertThat(response.method()).isEqualTo(AppointmentMethod.SAMPLE_COLLECTION);
        assertThat(response.farmId()).isEqualTo(farmId);
        assertThat(response.providerId()).isEqualTo(providerId);
        assertThat(response.farm().name()).isEqualTo("Sri Lakshmi Farm");
    }

    @Test
    void createAppointmentNonexistentFarmThrows() {
        CreateAppointmentRequest request = new CreateAppointmentRequest(
                farmId,
                providerId,
                AppointmentMethod.LAB_VISIT,
                LocalDate.now().plusDays(2),
                "10:00 AM - 12:00 PM",
                null
        );

        when(farmRepository.findById(farmId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> appointmentService.createAppointment(request))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Farm not found");
    }

    @Test
    void createAppointmentNonexistentProviderThrows() {
        CreateAppointmentRequest request = new CreateAppointmentRequest(
                farmId,
                providerId,
                AppointmentMethod.LAB_VISIT,
                LocalDate.now().plusDays(2),
                "10:00 AM - 12:00 PM",
                null
        );

        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(providerRepository.findById(providerId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> appointmentService.createAppointment(request))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Soil testing provider not found");
    }

    @Test
    void createAppointmentProviderNotAcceptingSamplesThrows() {
        mockProvider.setAcceptingSamples(false);

        CreateAppointmentRequest request = new CreateAppointmentRequest(
                farmId,
                providerId,
                AppointmentMethod.SAMPLE_COLLECTION,
                LocalDate.now().plusDays(3),
                "10:00 AM - 12:00 PM",
                null
        );

        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(providerRepository.findById(providerId)).thenReturn(Optional.of(mockProvider));

        assertThatThrownBy(() -> appointmentService.createAppointment(request))
                .isInstanceOf(BusinessRuleViolationException.class)
                .hasMessageContaining("not currently accepting new soil samples");
    }

    @Test
    void createAppointmentPastDateThrows() {
        CreateAppointmentRequest request = new CreateAppointmentRequest(
                farmId,
                providerId,
                AppointmentMethod.SAMPLE_COLLECTION,
                LocalDate.now().minusDays(1), // Past date
                "10:00 AM - 12:00 PM",
                null
        );

        when(farmRepository.findById(farmId)).thenReturn(Optional.of(mockFarm));
        when(providerRepository.findById(providerId)).thenReturn(Optional.of(mockProvider));

        assertThatThrownBy(() -> appointmentService.createAppointment(request))
                .isInstanceOf(BusinessRuleViolationException.class)
                .hasMessageContaining("cannot be in the past");
    }

    @Test
    void validLifecycleStateTransitionsExecuteSuccessfully() {
        when(appointmentRepository.findById(appointmentId)).thenReturn(Optional.of(mockAppointment));
        when(appointmentRepository.save(any(Appointment.class))).thenAnswer(inv -> inv.getArgument(0));

        // 1. BOOKED -> CONFIRMED
        AppointmentResponse confirmed = appointmentService.updateAppointmentStatus(
                appointmentId, new UpdateAppointmentStatusRequest(AppointmentStatus.CONFIRMED, "Accepted"));
        assertThat(confirmed.status()).isEqualTo(AppointmentStatus.CONFIRMED);

        // 2. CONFIRMED -> SAMPLE_COLLECTED
        AppointmentResponse collected = appointmentService.updateAppointmentStatus(
                appointmentId, new UpdateAppointmentStatusRequest(AppointmentStatus.SAMPLE_COLLECTED, "Collected from field"));
        assertThat(collected.status()).isEqualTo(AppointmentStatus.SAMPLE_COLLECTED);

        // 3. SAMPLE_COLLECTED -> TESTING
        AppointmentResponse testing = appointmentService.updateAppointmentStatus(
                appointmentId, new UpdateAppointmentStatusRequest(AppointmentStatus.TESTING, "Sample arrived at lab"));
        assertThat(testing.status()).isEqualTo(AppointmentStatus.TESTING);

        // 4. TESTING -> REPORT_READY
        AppointmentResponse reportReady = appointmentService.updateAppointmentStatus(
                appointmentId, new UpdateAppointmentStatusRequest(AppointmentStatus.REPORT_READY, "Spectroscopy completed"));
        assertThat(reportReady.status()).isEqualTo(AppointmentStatus.REPORT_READY);

        // 5. REPORT_READY -> COMPLETED
        AppointmentResponse completed = appointmentService.updateAppointmentStatus(
                appointmentId, new UpdateAppointmentStatusRequest(AppointmentStatus.COMPLETED, "Dispatched"));
        assertThat(completed.status()).isEqualTo(AppointmentStatus.COMPLETED);
    }

    @Test
    void invalidStatusTransitionSkipsStateThrowsConflict() {
        // BOOKED cannot skip to TESTING
        when(appointmentRepository.findById(appointmentId)).thenReturn(Optional.of(mockAppointment));

        assertThatThrownBy(() -> appointmentService.updateAppointmentStatus(
                appointmentId, new UpdateAppointmentStatusRequest(AppointmentStatus.TESTING, null)))
                .isInstanceOf(InvalidStatusTransitionException.class)
                .hasMessageContaining("Invalid status transition from BOOKED to TESTING");
    }

    @Test
    void cancelInTestingStageThrowsConflict() {
        mockAppointment.setStatus(AppointmentStatus.TESTING);
        when(appointmentRepository.findById(appointmentId)).thenReturn(Optional.of(mockAppointment));

        assertThatThrownBy(() -> appointmentService.cancelAppointment(
                appointmentId, new CancelAppointmentRequest("Farmer changed mind")))
                .isInstanceOf(InvalidStatusTransitionException.class)
                .hasMessageContaining("Cannot cancel appointment in TESTING stage");
    }

    @Test
    void cancelCompletedAppointmentThrowsConflict() {
        mockAppointment.setStatus(AppointmentStatus.COMPLETED);
        when(appointmentRepository.findById(appointmentId)).thenReturn(Optional.of(mockAppointment));

        assertThatThrownBy(() -> appointmentService.cancelAppointment(
                appointmentId, new CancelAppointmentRequest("Attempting cancel on completed")))
                .isInstanceOf(InvalidStatusTransitionException.class)
                .hasMessageContaining("terminal status: COMPLETED");
    }

    @Test
    void cancelCancelledAppointmentThrowsConflict() {
        mockAppointment.setStatus(AppointmentStatus.CANCELLED);
        when(appointmentRepository.findById(appointmentId)).thenReturn(Optional.of(mockAppointment));

        assertThatThrownBy(() -> appointmentService.cancelAppointment(
                appointmentId, new CancelAppointmentRequest("Attempting to cancel already cancelled")))
                .isInstanceOf(InvalidStatusTransitionException.class)
                .hasMessageContaining("terminal status: CANCELLED");
    }

    @Test
    void cancelValidAppointmentSucceeds() {
        when(appointmentRepository.findById(appointmentId)).thenReturn(Optional.of(mockAppointment));
        when(appointmentRepository.save(any(Appointment.class))).thenAnswer(inv -> inv.getArgument(0));

        AppointmentResponse response = appointmentService.cancelAppointment(
                appointmentId, new CancelAppointmentRequest("Heavy rains postponed field access"));

        assertThat(response.status()).isEqualTo(AppointmentStatus.CANCELLED);
        assertThat(response.notes()).contains("Cancellation reason: Heavy rains postponed field access");
    }

    @Test
    void getAppointmentByIdReturnsDto() {
        when(appointmentRepository.findById(appointmentId)).thenReturn(Optional.of(mockAppointment));

        AppointmentResponse response = appointmentService.getAppointmentById(appointmentId);

        assertThat(response.id()).isEqualTo(appointmentId);
        assertThat(response.status()).isEqualTo(AppointmentStatus.BOOKED);
    }

    @Test
    void listAppointmentsWithFiltersQueriesRepository() {
        when(appointmentRepository.findAll(any(Specification.class))).thenReturn(List.of(mockAppointment));

        List<AppointmentResponse> list = appointmentService.listAppointments(farmId, providerId, AppointmentStatus.BOOKED);

        assertThat(list).hasSize(1);
        assertThat(list.get(0).id()).isEqualTo(appointmentId);
        verify(appointmentRepository).findAll(any(Specification.class));
    }
}

package com.agrismart.repository;

import com.agrismart.entity.Appointment;
import com.agrismart.entity.AppointmentMethod;
import com.agrismart.entity.AppointmentStatus;
import com.agrismart.entity.Farm;
import com.agrismart.entity.SoilReport;
import com.agrismart.entity.SoilTestingProvider;
import com.agrismart.entity.User;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.TestPropertySource;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Validates JPA entity mappings, foreign key references, lifecycle callbacks,
 * and Spring Data repositories against an in-memory test database.
 */
@DataJpaTest
@TestPropertySource(properties = {
    "spring.datasource.url=jdbc:h2:mem:agrismart_entity_test;DB_CLOSE_DELAY=-1;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "spring.flyway.enabled=false"
})
class RepositoryMappingTest {

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private FarmRepository farmRepository;

    @Autowired
    private SoilTestingProviderRepository providerRepository;

    @Autowired
    private AppointmentRepository appointmentRepository;

    @Autowired
    private SoilReportRepository soilReportRepository;

    @Test
    @DisplayName("User mapping: can persist and find by email")
    void testUserMapping() {
        User user = new User("Ramesh Kumar", "ramesh.kumar@example.com", "+919876543210");
        User saved = userRepository.save(user);

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getCreatedAt()).isNotNull();

        Optional<User> found = userRepository.findByEmail("ramesh.kumar@example.com");
        assertThat(found).isPresent();
        assertThat(found.get().getFullName()).isEqualTo("Ramesh Kumar");
        assertThat(userRepository.existsByEmail("ramesh.kumar@example.com")).isTrue();
    }

    @Test
    @DisplayName("Farm mapping: belongs to User and can be queried by district")
    void testFarmMapping() {
        User user = userRepository.save(new User("Lakshmi Devi", "lakshmi@example.com", null));

        Farm farm = new Farm(
                user,
                "Lakshmi Plot 1",
                "Warangal Rural",
                "Warangal",
                new BigDecimal("5.50"),
                "Borewell + Drip"
        );
        farm.setCurrentCrop("Cotton");
        Farm savedFarm = farmRepository.save(farm);

        assertThat(savedFarm.getId()).isNotNull();
        assertThat(savedFarm.getUser().getId()).isEqualTo(user.getId());

        List<Farm> userFarms = farmRepository.findByUserId(user.getId());
        assertThat(userFarms).hasSize(1);
        assertThat(userFarms.get(0).getName()).isEqualTo("Lakshmi Plot 1");

        List<Farm> districtFarms = farmRepository.findByDistrict("Warangal");
        assertThat(districtFarms).hasSize(1);
    }

    @Test
    @DisplayName("SoilTestingProvider mapping: verifies provider attributes without fabricated seed data")
    void testProviderMapping() {
        SoilTestingProvider provider = new SoilTestingProvider(
                "District Agricultural Testing Laboratory",
                "Government Soil Testing Lab",
                "Station Road, Warangal"
        );
        provider.setVerified(true);
        provider.setReportTimeDays(7);
        SoilTestingProvider saved = providerRepository.save(provider);

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.isVerified()).isTrue();
        assertThat(saved.isAcceptingSamples()).isTrue();

        List<SoilTestingProvider> verifiedProviders = providerRepository.findByVerifiedTrue();
        assertThat(verifiedProviders).extracting(SoilTestingProvider::getName)
                .contains("District Agricultural Testing Laboratory");
    }

    @Test
    @DisplayName("Appointment mapping: manages status enum and connections between Farm and Provider")
    void testAppointmentMapping() {
        User user = userRepository.save(new User("Anil Rao", "anil@example.com", null));
        Farm farm = farmRepository.save(new Farm(
                user, "Anil Farm North", "Karimnagar", "Karimnagar",
                new BigDecimal("3.00"), "Canal"
        ));
        SoilTestingProvider provider = providerRepository.save(new SoilTestingProvider(
                "Regional Agronomy Center", "University Agronomy Center", "Karimnagar Bypass"
        ));

        Appointment appointment = new Appointment(
                farm,
                provider,
                AppointmentStatus.BOOKED,
                AppointmentMethod.SAMPLE_COLLECTION,
                LocalDate.now().plusDays(3),
                "09:00 AM - 11:00 AM"
        );
        appointment.setNotes("Field sample collection requested");

        Appointment saved = appointmentRepository.save(appointment);
        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getStatus()).isEqualTo(AppointmentStatus.BOOKED);
        assertThat(saved.getMethod()).isEqualTo(AppointmentMethod.SAMPLE_COLLECTION);

        List<Appointment> farmAppointments = appointmentRepository.findByFarmId(farm.getId());
        assertThat(farmAppointments).hasSize(1);
        assertThat(farmAppointments.get(0).getProvider().getId()).isEqualTo(provider.getId());

        List<Appointment> bookedAppointments = appointmentRepository.findByStatus(AppointmentStatus.BOOKED);
        assertThat(bookedAppointments).hasSize(1);
    }

    @Test
    @DisplayName("SoilReport mapping: missing soil measurements strictly remain null (no fabrication or zero defaults)")
    void testSoilReportMissingValuesRemainNull() {
        User user = userRepository.save(new User("Sita Ram", "sita@example.com", null));
        Farm farm = farmRepository.save(new Farm(
                user, "Sita Field South", "Khammam", "Khammam",
                new BigDecimal("2.25"), "Borewell"
        ));

        SoilReport report = new SoilReport(farm, "State Soil Testing Laboratory", LocalDate.now());
        report.setSampleId("ST-2026-001");
        // Genuine test measured only Nitrogen and pH; Phosphorus and Potassium were not tested yet
        report.setNitrogen(new BigDecimal("180.50"));
        report.setPh(new BigDecimal("6.80"));
        // phosphorus, potassium, electricalConductivity, organicCarbon are left unset

        SoilReport saved = soilReportRepository.save(report);
        entityManager.flush();
        entityManager.clear();

        SoilReport reloaded = soilReportRepository.findById(saved.getId()).orElseThrow();
        assertThat(reloaded.getNitrogen()).isEqualByComparingTo("180.50");
        assertThat(reloaded.getPh()).isEqualByComparingTo("6.80");

        // CRITICAL DOMAIN RULE: Missing values must strictly remain null
        assertThat(reloaded.getPhosphorus())
                .as("Phosphorus was not measured and must remain null, never defaulted to zero")
                .isNull();
        assertThat(reloaded.getPotassium())
                .as("Potassium was not measured and must remain null, never defaulted to zero")
                .isNull();
        assertThat(reloaded.getElectricalConductivity()).isNull();
        assertThat(reloaded.getOrganicCarbon()).isNull();

        Optional<SoilReport> latest = soilReportRepository.findTopByFarmIdOrderByTestDateDesc(farm.getId());
        assertThat(latest).isPresent();
        assertThat(latest.get().getLaboratoryName()).isEqualTo("State Soil Testing Laboratory");
    }
}

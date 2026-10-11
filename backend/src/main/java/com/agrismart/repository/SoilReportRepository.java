package com.agrismart.repository;

import com.agrismart.entity.SoilReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface SoilReportRepository extends JpaRepository<SoilReport, UUID> {

    List<SoilReport> findByFarmId(UUID farmId);

    List<SoilReport> findByFarmIdOrderByTestDateDescCreatedAtDesc(UUID farmId);

    List<SoilReport> findByFarmIdAndVerifiedOrderByTestDateDescCreatedAtDesc(UUID farmId, boolean verified);

    Optional<SoilReport> findTopByFarmIdOrderByTestDateDesc(UUID farmId);

    Optional<SoilReport> findTopByFarmIdOrderByTestDateDescCreatedAtDesc(UUID farmId);

    Optional<SoilReport> findTopByFarmIdAndVerifiedTrueOrderByTestDateDescCreatedAtDesc(UUID farmId);

    Optional<SoilReport> findByAppointmentId(UUID appointmentId);
}

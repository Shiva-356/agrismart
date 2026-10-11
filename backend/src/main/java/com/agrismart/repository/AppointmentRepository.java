package com.agrismart.repository;

import com.agrismart.entity.Appointment;
import com.agrismart.entity.AppointmentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Repository
public interface AppointmentRepository extends JpaRepository<Appointment, UUID>, JpaSpecificationExecutor<Appointment> {

    List<Appointment> findByFarmId(UUID farmId);

    List<Appointment> findByProviderId(UUID providerId);

    List<Appointment> findByStatus(AppointmentStatus status);

    List<Appointment> findByProviderIdAndStatus(UUID providerId, AppointmentStatus status);

    List<Appointment> findByScheduledDate(LocalDate scheduledDate);
}

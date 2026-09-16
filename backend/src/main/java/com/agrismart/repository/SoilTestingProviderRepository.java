package com.agrismart.repository;

import com.agrismart.entity.SoilTestingProvider;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface SoilTestingProviderRepository extends JpaRepository<SoilTestingProvider, UUID>, JpaSpecificationExecutor<SoilTestingProvider> {

    List<SoilTestingProvider> findByVerifiedTrue();

    List<SoilTestingProvider> findByAcceptingSamplesTrue();

    List<SoilTestingProvider> findByType(String type);
}

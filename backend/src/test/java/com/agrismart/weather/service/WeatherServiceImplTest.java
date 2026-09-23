package com.agrismart.weather.service;

import com.agrismart.entity.Farm;
import com.agrismart.exception.RecommendationPrerequisiteException;
import com.agrismart.exception.WeatherServiceException;
import com.agrismart.weather.WeatherObservation;
import com.agrismart.weather.location.LocationResolver;
import com.agrismart.weather.location.ResolvedLocation;
import com.agrismart.weather.provider.WeatherProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WeatherServiceImplTest {

    @Mock
    private LocationResolver locationResolver;

    @Mock
    private WeatherProvider weatherProvider;

    @InjectMocks
    private WeatherServiceImpl weatherService;

    private Farm farm;
    private ResolvedLocation resolvedLocation;
    private WeatherObservation observation;

    @BeforeEach
    void setUp() {
        farm = new Farm();
        farm.setId(UUID.randomUUID());
        farm.setLocation("Warangal Rural");
        farm.setDistrict("Warangal");

        resolvedLocation = new ResolvedLocation(17.97, 79.59, "Warangal", "Warangal");
        observation = new WeatherObservation(27.5, 74.0, 120.0, Instant.now(), "Open-Meteo");
    }

    @Test
    @DisplayName("Orchestrates location resolution and weather retrieval")
    void getWeatherForFarmSuccess() {
        when(locationResolver.resolve(farm)).thenReturn(resolvedLocation);
        when(weatherProvider.getCurrentWeather(resolvedLocation)).thenReturn(observation);

        WeatherObservation result = weatherService.getWeatherForFarm(farm);

        assertThat(result).isNotNull();
        assertThat(result.temperature()).isEqualTo(27.5);
        assertThat(result.humidity()).isEqualTo(74.0);
        assertThat(result.rainfall()).isEqualTo(120.0);
        verify(locationResolver).resolve(farm);
        verify(weatherProvider).getCurrentWeather(resolvedLocation);
    }

    @Test
    @DisplayName("Propagates WEATHER_LOCATION_UNRESOLVED if location resolution fails")
    void locationResolutionFailurePropagates() {
        when(locationResolver.resolve(farm)).thenThrow(
                new RecommendationPrerequisiteException("WEATHER_LOCATION_UNRESOLVED", "Location could not be resolved")
        );

        assertThatThrownBy(() -> weatherService.getWeatherForFarm(farm))
                .isInstanceOf(RecommendationPrerequisiteException.class)
                .satisfies(e -> {
                    RecommendationPrerequisiteException ex = (RecommendationPrerequisiteException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("WEATHER_LOCATION_UNRESOLVED");
                });

        verify(weatherProvider, never()).getCurrentWeather(any());
    }

    @Test
    @DisplayName("Propagates WEATHER_DATA_UNAVAILABLE if weather provider fails")
    void weatherProviderFailurePropagates() {
        when(locationResolver.resolve(farm)).thenReturn(resolvedLocation);
        when(weatherProvider.getCurrentWeather(resolvedLocation)).thenThrow(
                new WeatherServiceException("WEATHER_DATA_UNAVAILABLE", "Weather service unavailable")
        );

        assertThatThrownBy(() -> weatherService.getWeatherForFarm(farm))
                .isInstanceOf(WeatherServiceException.class)
                .satisfies(e -> {
                    WeatherServiceException ex = (WeatherServiceException) e;
                    assertThat(ex.getErrorCode()).isEqualTo("WEATHER_DATA_UNAVAILABLE");
                });
    }
}

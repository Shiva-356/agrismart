package com.agrismart.controller;

import com.agrismart.entity.Farm;
import com.agrismart.exception.ResourceNotFoundException;
import com.agrismart.repository.FarmRepository;
import com.agrismart.weather.WeatherObservation;
import com.agrismart.weather.service.WeatherService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * REST API for retrieving live weather observations for a farm plot.
 * Delegates to WeatherService which uses Open-Meteo location resolution and forecasting.
 */
@RestController
@RequestMapping("/api/weather")
public class WeatherController {

    private final FarmRepository farmRepository;
    private final WeatherService weatherService;

    public WeatherController(FarmRepository farmRepository, WeatherService weatherService) {
        this.farmRepository = farmRepository;
        this.weatherService = weatherService;
    }

    /**
     * Retrieves live weather observation for the given farm location.
     * GET /api/weather?farmId={farmId}
     */
    @GetMapping
    public ResponseEntity<WeatherObservation> getWeather(@RequestParam UUID farmId) {
        Farm farm = farmRepository.findById(farmId)
                .orElseThrow(() -> new ResourceNotFoundException("Farm not found with ID: " + farmId));
        WeatherObservation weather = weatherService.getWeatherForFarm(farm);
        return ResponseEntity.ok(weather);
    }
}

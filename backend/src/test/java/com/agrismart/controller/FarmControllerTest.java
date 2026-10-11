package com.agrismart.controller;

import com.agrismart.dto.farm.CreateFarmRequest;
import com.agrismart.dto.farm.FarmResponse;
import com.agrismart.dto.farm.UpdateFarmRequest;
import com.agrismart.exception.GlobalExceptionHandler;
import com.agrismart.exception.ResourceNotFoundException;
import com.agrismart.service.FarmService;
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
import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class FarmControllerTest {

    private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    @Mock
    private FarmService farmService;

    @InjectMocks
    private FarmController farmController;

    private UUID userId;
    private UUID farmId;
    private FarmResponse mockFarmResponse;

    @BeforeEach
    void setUp() {
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();

        this.mockMvc = MockMvcBuilders
                .standaloneSetup(farmController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setValidator(validator)
                .build();

        userId = UUID.randomUUID();
        farmId = UUID.randomUUID();
        mockFarmResponse = new FarmResponse(
                farmId,
                userId,
                "Green Valley Plot 1",
                "Near Lake, Station Road",
                "Warangal",
                BigDecimal.valueOf(5.0),
                "Paddy",
                "CANAL",
                Instant.now(),
                Instant.now()
        );
    }

    @Test
    void postValidFarmReturns201CreatedWithLocationHeader() throws Exception {
        CreateFarmRequest request = new CreateFarmRequest(
                userId,
                "Green Valley Plot 1",
                "Near Lake, Station Road",
                "Warangal",
                BigDecimal.valueOf(5.0),
                "Paddy",
                "CANAL"
        );

        when(farmService.createFarm(any(CreateFarmRequest.class))).thenReturn(mockFarmResponse);

        mockMvc.perform(post("/api/farms")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", containsString("/api/farms/" + farmId)))
                .andExpect(jsonPath("$.id", is(farmId.toString())))
                .andExpect(jsonPath("$.userId", is(userId.toString())))
                .andExpect(jsonPath("$.name", is("Green Valley Plot 1")))
                .andExpect(jsonPath("$.district", is("Warangal")))
                .andExpect(jsonPath("$.landAreaAcres", is(5.0)));
    }

    @Test
    void postInvalidFarmRequestReturns400BadRequest() throws Exception {
        // Missing name and district, landAreaAcres is negative
        CreateFarmRequest invalidRequest = new CreateFarmRequest(
                userId,
                "",
                "Location",
                "",
                BigDecimal.valueOf(-2.0),
                "Crop",
                "DRIP"
        );

        mockMvc.perform(post("/api/farms")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", is("VALIDATION_ERROR")))
                .andExpect(jsonPath("$.fieldErrors.name", notNullValue()))
                .andExpect(jsonPath("$.fieldErrors.district", notNullValue()))
                .andExpect(jsonPath("$.fieldErrors.landAreaAcres", notNullValue()))
                .andExpect(jsonPath("$.validationErrors.name", notNullValue()));
    }

    @Test
    void postFarmWithNonexistentUserReturns404NotFound() throws Exception {
        UUID nonExistentUserId = UUID.randomUUID();
        CreateFarmRequest request = new CreateFarmRequest(
                nonExistentUserId,
                "Farm A",
                "Location A",
                "District A",
                BigDecimal.valueOf(3.0),
                null,
                "BOREWELL"
        );

        when(farmService.createFarm(any(CreateFarmRequest.class)))
                .thenThrow(new ResourceNotFoundException("User not found with ID: " + nonExistentUserId));

        mockMvc.perform(post("/api/farms")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status", is(404)))
                .andExpect(jsonPath("$.error", is("RESOURCE_NOT_FOUND")))
                .andExpect(jsonPath("$.message", containsString("User not found with ID")));
    }

    @Test
    void getExistingFarmReturns200Ok() throws Exception {
        when(farmService.getFarmById(farmId)).thenReturn(mockFarmResponse);

        mockMvc.perform(get("/api/farms/" + farmId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(farmId.toString())))
                .andExpect(jsonPath("$.name", is("Green Valley Plot 1")))
                .andExpect(jsonPath("$.district", is("Warangal")));
    }

    @Test
    void getMissingFarmReturns404NotFound() throws Exception {
        UUID nonExistentId = UUID.randomUUID();
        when(farmService.getFarmById(nonExistentId))
                .thenThrow(new ResourceNotFoundException("Farm not found with ID: " + nonExistentId));

        mockMvc.perform(get("/api/farms/" + nonExistentId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status", is(404)))
                .andExpect(jsonPath("$.error", is("RESOURCE_NOT_FOUND")))
                .andExpect(jsonPath("$.message", containsString("Farm not found with ID")));
    }

    @Test
    void listAllFarmsWithoutUserIdParamReturns200OkWithList() throws Exception {
        when(farmService.getAllFarms()).thenReturn(List.of(mockFarmResponse));

        mockMvc.perform(get("/api/farms"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id", is(farmId.toString())))
                .andExpect(jsonPath("$[0].name", is("Green Valley Plot 1")));
    }

    @Test
    void getFarmsByUserReturns200OkWithList() throws Exception {
        when(farmService.getFarmsByUserId(userId)).thenReturn(List.of(mockFarmResponse));

        mockMvc.perform(get("/api/farms").param("userId", userId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id", is(farmId.toString())))
                .andExpect(jsonPath("$[0].userId", is(userId.toString())))
                .andExpect(jsonPath("$[0].name", is("Green Valley Plot 1")));
    }

    @Test
    void getFarmsByUserMissingReturns404NotFound() throws Exception {
        UUID nonExistentUserId = UUID.randomUUID();
        when(farmService.getFarmsByUserId(nonExistentUserId))
                .thenThrow(new ResourceNotFoundException("User not found with ID: " + nonExistentUserId));

        mockMvc.perform(get("/api/farms").param("userId", nonExistentUserId.toString()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status", is(404)))
                .andExpect(jsonPath("$.error", is("RESOURCE_NOT_FOUND")))
                .andExpect(jsonPath("$.message", containsString("User not found with ID")));
    }

    @Test
    void putFarmReturns200OkWithUpdatedFarm() throws Exception {
        UpdateFarmRequest request = new UpdateFarmRequest(
                "Updated Green Valley",
                "New Location",
                "Warangal Urban",
                BigDecimal.valueOf(6.5),
                "Wheat",
                "DRIP"
        );

        FarmResponse updatedResponse = new FarmResponse(
                farmId,
                userId,
                "Updated Green Valley",
                "New Location",
                "Warangal Urban",
                BigDecimal.valueOf(6.5),
                "Wheat",
                "DRIP",
                Instant.now(),
                Instant.now()
        );

        when(farmService.updateFarm(eq(farmId), any(UpdateFarmRequest.class))).thenReturn(updatedResponse);

        mockMvc.perform(put("/api/farms/" + farmId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(farmId.toString())))
                .andExpect(jsonPath("$.name", is("Updated Green Valley")))
                .andExpect(jsonPath("$.district", is("Warangal Urban")))
                .andExpect(jsonPath("$.landAreaAcres", is(6.5)));
    }

    @Test
    void putFarmWithNonexistentFarmReturns404NotFound() throws Exception {
        UUID nonExistentFarmId = UUID.randomUUID();
        UpdateFarmRequest request = new UpdateFarmRequest(
                "Updated Name",
                "New Location",
                "District",
                BigDecimal.valueOf(2.0),
                "Maize",
                "DRIP"
        );

        when(farmService.updateFarm(eq(nonExistentFarmId), any(UpdateFarmRequest.class)))
                .thenThrow(new ResourceNotFoundException("Farm not found with ID: " + nonExistentFarmId));

        mockMvc.perform(put("/api/farms/" + nonExistentFarmId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status", is(404)))
                .andExpect(jsonPath("$.error", is("RESOURCE_NOT_FOUND")))
                .andExpect(jsonPath("$.message", containsString("Farm not found with ID")));
    }

    @Test
    void putFarmWithInvalidDataReturns400BadRequest() throws Exception {
        UpdateFarmRequest invalidRequest = new UpdateFarmRequest(
                "",
                "",
                "",
                BigDecimal.valueOf(-1.0),
                null,
                ""
        );

        mockMvc.perform(put("/api/farms/" + farmId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", is("VALIDATION_ERROR")))
                .andExpect(jsonPath("$.fieldErrors.name", notNullValue()))
                .andExpect(jsonPath("$.fieldErrors.location", notNullValue()))
                .andExpect(jsonPath("$.fieldErrors.district", notNullValue()))
                .andExpect(jsonPath("$.fieldErrors.landAreaAcres", notNullValue()))
                .andExpect(jsonPath("$.fieldErrors.irrigation", notNullValue()));
    }
}

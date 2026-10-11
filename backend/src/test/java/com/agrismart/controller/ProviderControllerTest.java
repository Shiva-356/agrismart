package com.agrismart.controller;

import com.agrismart.dto.provider.CreateProviderRequest;
import com.agrismart.dto.provider.ProviderResponse;
import com.agrismart.dto.provider.UpdateProviderRequest;
import com.agrismart.exception.GlobalExceptionHandler;
import com.agrismart.exception.ResourceNotFoundException;
import com.agrismart.service.ProviderService;
import com.fasterxml.jackson.databind.ObjectMapper;
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

import java.time.Instant;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class ProviderControllerTest {

    private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Mock
    private ProviderService providerService;

    @InjectMocks
    private ProviderController providerController;

    @BeforeEach
    void setUp() {
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();

        this.mockMvc = MockMvcBuilders
                .standaloneSetup(providerController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setValidator(validator)
                .build();
    }

    @Test
    void createProviderReturnsCreatedWithLocation() throws Exception {
        UUID providerId = UUID.randomUUID();
        CreateProviderRequest request = new CreateProviderRequest(
                "Telangana State Soil Testing Lab",
                "Government Soil Testing Lab",
                "Agriculture Complex, Rajendranagar, Hyderabad",
                "+91 40 2401 5011",
                17.3200,
                78.4100,
                "09:00 AM - 05:00 PM",
                7
        );

        ProviderResponse response = new ProviderResponse(
                providerId,
                request.name(),
                request.type(),
                request.address(),
                request.phone(),
                false,
                true,
                request.latitude(),
                request.longitude(),
                request.openingHours(),
                request.reportTimeDays(),
                Instant.now(),
                Instant.now()
        );

        when(providerService.createProvider(any(CreateProviderRequest.class))).thenReturn(response);

        mockMvc.perform(post("/api/providers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", containsString("/api/providers/" + providerId)))
                .andExpect(jsonPath("$.id", is(providerId.toString())))
                .andExpect(jsonPath("$.name", is("Telangana State Soil Testing Lab")))
                .andExpect(jsonPath("$.verified", is(false)))
                .andExpect(jsonPath("$.acceptingSamples", is(true)));
    }

    @Test
    void createProviderWithValidationFailureReturnsBadRequest() throws Exception {
        // Missing name and invalid turnaround days
        CreateProviderRequest invalidRequest = new CreateProviderRequest(
                "",
                "",
                "",
                "invalid-phone",
                -100.0,
                200.0,
                null,
                -5
        );

        mockMvc.perform(post("/api/providers")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status", is(400)))
                .andExpect(jsonPath("$.error", is("VALIDATION_ERROR")))
                .andExpect(jsonPath("$.fieldErrors.name").exists())
                .andExpect(jsonPath("$.fieldErrors.type").exists())
                .andExpect(jsonPath("$.fieldErrors.address").exists());
    }

    @Test
    void getProviderByIdReturnsProviderWhenFound() throws Exception {
        UUID providerId = UUID.randomUUID();
        ProviderResponse response = new ProviderResponse(
                providerId,
                "Central Soil Testing Laboratory",
                "Regional Soil Testing Center",
                "Station Road, Warangal",
                "+91 870 2500 123",
                true,
                true,
                17.9784,
                79.6000,
                "09:30 AM - 05:30 PM",
                5,
                Instant.now(),
                Instant.now()
        );

        when(providerService.getProviderById(providerId)).thenReturn(response);

        mockMvc.perform(get("/api/providers/{id}", providerId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(providerId.toString())))
                .andExpect(jsonPath("$.name", is("Central Soil Testing Laboratory")))
                .andExpect(jsonPath("$.verified", is(true)));
    }

    @Test
    void getProviderByIdReturnsNotFoundWhenMissing() throws Exception {
        UUID missingId = UUID.randomUUID();
        when(providerService.getProviderById(missingId))
                .thenThrow(new ResourceNotFoundException("Soil testing provider not found with ID: " + missingId));

        mockMvc.perform(get("/api/providers/{id}", missingId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status", is(404)))
                .andExpect(jsonPath("$.error", is("RESOURCE_NOT_FOUND")))
                .andExpect(jsonPath("$.message", containsString(missingId.toString())));
    }

    @Test
    void listProvidersWithFiltersDelegatesToService() throws Exception {
        UUID providerId = UUID.randomUUID();
        ProviderResponse response = new ProviderResponse(
                providerId,
                "Warangal District Lab",
                "Government Soil Testing Lab",
                "Subedari, Warangal Urban, Telangana",
                "+91 870 2456 789",
                true,
                true,
                18.0000,
                79.5800,
                "10:00 AM - 05:00 PM",
                4,
                Instant.now(),
                Instant.now()
        );

        when(providerService.listProviders(true, true, "Warangal", "Government Soil Testing Lab"))
                .thenReturn(List.of(response));

        mockMvc.perform(get("/api/providers")
                        .param("verified", "true")
                        .param("acceptingSamples", "true")
                        .param("district", "Warangal")
                        .param("type", "Government Soil Testing Lab"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].name", is("Warangal District Lab")));

        verify(providerService).listProviders(true, true, "Warangal", "Government Soil Testing Lab");
    }

    @Test
    void updateProviderReturnsUpdatedResponse() throws Exception {
        UUID providerId = UUID.randomUUID();
        UpdateProviderRequest request = new UpdateProviderRequest(
                "Updated Lab Name",
                "Private Lab",
                "New Address",
                "+91 98765 43210",
                true,
                false,
                17.5,
                78.5,
                "08:00 AM - 04:00 PM",
                10
        );

        ProviderResponse response = new ProviderResponse(
                providerId,
                request.name(),
                request.type(),
                request.address(),
                request.phone(),
                true,
                false,
                request.latitude(),
                request.longitude(),
                request.openingHours(),
                request.reportTimeDays(),
                Instant.now(),
                Instant.now()
        );

        when(providerService.updateProvider(eq(providerId), any(UpdateProviderRequest.class))).thenReturn(response);

        mockMvc.perform(put("/api/providers/{id}", providerId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(providerId.toString())))
                .andExpect(jsonPath("$.name", is("Updated Lab Name")))
                .andExpect(jsonPath("$.acceptingSamples", is(false)));
    }
}

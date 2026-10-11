package com.agrismart.controller;

import com.agrismart.dto.user.CreateUserRequest;
import com.agrismart.dto.user.UserResponse;
import com.agrismart.exception.DuplicateResourceException;
import com.agrismart.exception.GlobalExceptionHandler;
import com.agrismart.exception.ResourceNotFoundException;
import com.agrismart.service.UserService;
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

import java.time.Instant;
import java.util.UUID;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class UserControllerTest {

    private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    @Mock
    private UserService userService;

    @InjectMocks
    private UserController userController;

    private UUID userId;
    private UserResponse mockResponse;

    @BeforeEach
    void setUp() {
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();

        this.mockMvc = MockMvcBuilders
                .standaloneSetup(userController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setValidator(validator)
                .build();

        userId = UUID.randomUUID();
        mockResponse = new UserResponse(
                userId,
                "Ramesh Patel",
                "ramesh@example.com",
                "+91 98765 43210",
                Instant.now(),
                Instant.now()
        );
    }

    @Test
    void postValidUserReturns201CreatedWithLocationHeader() throws Exception {
        CreateUserRequest request = new CreateUserRequest(
                "Ramesh Patel",
                "ramesh@example.com",
                "+91 98765 43210"
        );

        when(userService.createUser(any(CreateUserRequest.class))).thenReturn(mockResponse);

        mockMvc.perform(post("/api/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", containsString("/api/users/" + userId)))
                .andExpect(jsonPath("$.id", is(userId.toString())))
                .andExpect(jsonPath("$.fullName", is("Ramesh Patel")))
                .andExpect(jsonPath("$.email", is("ramesh@example.com")))
                .andExpect(jsonPath("$.phoneNumber", is("+91 98765 43210")));
    }

    @Test
    void postUserWithInvalidEmailReturns400BadRequest() throws Exception {
        CreateUserRequest request = new CreateUserRequest(
                "Ramesh Patel",
                "not-an-email",
                "+91 98765 43210"
        );

        mockMvc.perform(post("/api/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", is("VALIDATION_ERROR")))
                .andExpect(jsonPath("$.fieldErrors.email", notNullValue()))
                .andExpect(jsonPath("$.validationErrors.email", notNullValue()));
    }

    @Test
    void postUserWithMissingFullNameReturns400BadRequest() throws Exception {
        CreateUserRequest request = new CreateUserRequest(
                "",
                "ramesh@example.com",
                "+91 98765 43210"
        );

        mockMvc.perform(post("/api/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error", is("VALIDATION_ERROR")))
                .andExpect(jsonPath("$.fieldErrors.fullName", notNullValue()))
                .andExpect(jsonPath("$.validationErrors.fullName", notNullValue()));
    }

    @Test
    void postDuplicateEmailReturns409Conflict() throws Exception {
        CreateUserRequest request = new CreateUserRequest(
                "Ramesh Patel",
                "ramesh@example.com",
                null
        );

        when(userService.createUser(any(CreateUserRequest.class)))
                .thenThrow(new DuplicateResourceException("User already exists with email: ramesh@example.com"));

        mockMvc.perform(post("/api/users")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status", is(409)))
                .andExpect(jsonPath("$.error", is("CONFLICT")))
                .andExpect(jsonPath("$.message", containsString("User already exists with email")));
    }

    @Test
    void getExistingUserReturns200Ok() throws Exception {
        when(userService.getUserById(userId)).thenReturn(mockResponse);

        mockMvc.perform(get("/api/users/" + userId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(userId.toString())))
                .andExpect(jsonPath("$.fullName", is("Ramesh Patel")))
                .andExpect(jsonPath("$.email", is("ramesh@example.com")));
    }

    @Test
    void getMissingUserReturns404NotFound() throws Exception {
        UUID nonExistentId = UUID.randomUUID();
        when(userService.getUserById(nonExistentId))
                .thenThrow(new ResourceNotFoundException("User not found with ID: " + nonExistentId));

        mockMvc.perform(get("/api/users/" + nonExistentId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status", is(404)))
                .andExpect(jsonPath("$.error", is("RESOURCE_NOT_FOUND")))
                .andExpect(jsonPath("$.message", containsString("User not found with ID")));
    }

    @Test
    void getUserByEmailQueryParamReturns200Ok() throws Exception {
        when(userService.getUserByEmail("ramesh@example.com")).thenReturn(mockResponse);

        mockMvc.perform(get("/api/users").param("email", "ramesh@example.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", is(userId.toString())))
                .andExpect(jsonPath("$.email", is("ramesh@example.com")));
    }

    @Test
    void getUserByEmailMissingReturns404NotFound() throws Exception {
        when(userService.getUserByEmail("missing@example.com"))
                .thenThrow(new ResourceNotFoundException("User not found with email: missing@example.com"));

        mockMvc.perform(get("/api/users").param("email", "missing@example.com"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status", is(404)))
                .andExpect(jsonPath("$.error", is("RESOURCE_NOT_FOUND")));
    }
}

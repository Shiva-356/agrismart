package com.agrismart.service;

import com.agrismart.dto.user.CreateUserRequest;
import com.agrismart.dto.user.UserResponse;
import com.agrismart.entity.User;
import com.agrismart.exception.DuplicateResourceException;
import com.agrismart.exception.ResourceNotFoundException;
import com.agrismart.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private UserService userService;

    private UUID userId;
    private User mockUser;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        mockUser = new User("Ramesh Patel", "ramesh@example.com", "+91 98765 43210");
        mockUser.setId(userId);
        mockUser.setCreatedAt(Instant.now());
        mockUser.setUpdatedAt(Instant.now());
    }

    @Test
    void createValidUserSavesAndReturnsUserResponse() {
        CreateUserRequest request = new CreateUserRequest(
                "Ramesh Patel",
                "ramesh@example.com",
                "+91 98765 43210"
        );

        when(userRepository.existsByEmail("ramesh@example.com")).thenReturn(false);
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User u = invocation.getArgument(0);
            u.setId(userId);
            u.setCreatedAt(Instant.now());
            u.setUpdatedAt(Instant.now());
            return u;
        });

        UserResponse response = userService.createUser(request);

        assertThat(response).isNotNull();
        assertThat(response.id()).isEqualTo(userId);
        assertThat(response.fullName()).isEqualTo("Ramesh Patel");
        assertThat(response.email()).isEqualTo("ramesh@example.com");
        assertThat(response.phoneNumber()).isEqualTo("+91 98765 43210");
        verify(userRepository).save(any(User.class));
    }

    @Test
    void duplicateEmailRejectedWithConflictException() {
        CreateUserRequest request = new CreateUserRequest(
                "Ramesh Patel",
                "ramesh@example.com",
                "+91 98765 43210"
        );

        when(userRepository.existsByEmail("ramesh@example.com")).thenReturn(true);

        assertThatThrownBy(() -> userService.createUser(request))
                .isInstanceOf(DuplicateResourceException.class)
                .hasMessageContaining("User already exists with email: ramesh@example.com");

        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void getExistingUserReturnsUserResponse() {
        when(userRepository.findById(userId)).thenReturn(Optional.of(mockUser));

        UserResponse response = userService.getUserById(userId);

        assertThat(response).isNotNull();
        assertThat(response.id()).isEqualTo(userId);
        assertThat(response.fullName()).isEqualTo("Ramesh Patel");
        assertThat(response.email()).isEqualTo("ramesh@example.com");
    }

    @Test
    void missingUserReturns404ResourceNotFoundException() {
        UUID nonExistentId = UUID.randomUUID();
        when(userRepository.findById(nonExistentId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.getUserById(nonExistentId))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("User not found with ID: " + nonExistentId);
    }

    @Test
    void getUserByEmailReturnsUserWhenFound() {
        when(userRepository.findByEmail("ramesh@example.com")).thenReturn(Optional.of(mockUser));

        UserResponse response = userService.getUserByEmail("ramesh@example.com");

        assertThat(response).isNotNull();
        assertThat(response.email()).isEqualTo("ramesh@example.com");
    }

    @Test
    void getUserByEmailThrowsNotFoundWhenMissing() {
        when(userRepository.findByEmail("missing@example.com")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.getUserByEmail("missing@example.com"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("User not found with email: missing@example.com");
    }
}

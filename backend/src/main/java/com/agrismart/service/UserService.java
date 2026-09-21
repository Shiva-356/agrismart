package com.agrismart.service;

import com.agrismart.dto.user.CreateUserRequest;
import com.agrismart.dto.user.UserResponse;
import com.agrismart.entity.User;
import com.agrismart.exception.BusinessRuleViolationException;
import com.agrismart.exception.DuplicateResourceException;
import com.agrismart.exception.ResourceNotFoundException;
import com.agrismart.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Service managing user accounts.
 */
@Service
@Transactional(readOnly = true)
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * Registers a new user account.
     * Rejects duplicate email addresses with DuplicateResourceException (HTTP 409).
     */
    @Transactional
    public UserResponse createUser(CreateUserRequest request) {
        String email = request.email().trim();

        if (userRepository.existsByEmail(email)) {
            throw new DuplicateResourceException("User already exists with email: " + email);
        }

        String fullName = request.fullName().trim();
        String phoneNumber = request.phoneNumber() != null ? request.phoneNumber().trim() : null;
        if (phoneNumber != null && phoneNumber.isBlank()) {
            phoneNumber = null;
        }

        User user = new User(fullName, email, phoneNumber);
        User saved = userRepository.save(user);
        return UserResponse.fromEntity(saved);
    }

    /**
     * Retrieves a user by their unique identifier.
     */
    public UserResponse getUserById(UUID id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found with ID: " + id));
        return UserResponse.fromEntity(user);
    }

    /**
     * Retrieves a user by their registered email address.
     */
    public UserResponse getUserByEmail(String email) {
        if (email == null || email.isBlank()) {
            throw new BusinessRuleViolationException("Email parameter cannot be blank");
        }
        User user = userRepository.findByEmail(email.trim())
                .orElseThrow(() -> new ResourceNotFoundException("User not found with email: " + email.trim()));
        return UserResponse.fromEntity(user);
    }
}

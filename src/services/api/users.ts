import { apiGet, apiPost } from "./client";

export interface UserResponse {
  id: string;
  fullName: string;
  email: string;
  phoneNumber?: string | null | undefined;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
}

export interface CreateUserRequest {
  fullName: string;
  email: string;
  phoneNumber?: string | null | undefined;
}

/**
 * Users API service module.
 * Spring Boot REST endpoints:
 * - POST /api/users
 * - GET  /api/users/{id}
 * - GET  /api/users?email={email}
 */
export const usersApi = {
  create: (request: CreateUserRequest) => apiPost<UserResponse>("/api/users", request),
  getById: (id: string) => apiGet<UserResponse>(`/api/users/${id}`),
  get: (id: string) => apiGet<UserResponse>(`/api/users/${id}`),
  getByEmail: (email: string) =>
    apiGet<UserResponse>("/api/users", { params: { email: email.trim() } }),
};

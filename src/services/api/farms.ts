import { apiGet, apiPost, apiPut } from "./client";

export interface FarmResponse {
  id: string;
  userId: string;
  name: string;
  location: string;
  district: string;
  landAreaAcres: number;
  currentCrop: string | null;
  irrigation: string;
  createdAt?: string | undefined;
  updatedAt?: string | undefined;
}

export interface CreateFarmRequest {
  userId: string;
  name: string;
  location: string;
  district: string;
  landAreaAcres: number;
  currentCrop?: string | null | undefined;
  irrigation: string;
}

export interface UpdateFarmRequest {
  userId?: string | undefined;
  name: string;
  location: string;
  district: string;
  landAreaAcres: number;
  currentCrop?: string | null | undefined;
  irrigation: string;
}

/**
 * Farms API service module.
 * Spring Boot REST endpoints:
 * - POST /api/farms
 * - GET  /api/farms
 * - GET  /api/farms/{id}
 * - GET  /api/farms?userId={userId}
 * - PUT  /api/farms/{id}
 */
export const farmsApi = {
  create: (request: CreateFarmRequest) => apiPost<FarmResponse>("/api/farms", request),
  list: (userId?: string) =>
    apiGet<FarmResponse[]>("/api/farms", userId ? { params: { userId } } : undefined),
  getById: (id: string) => apiGet<FarmResponse>(`/api/farms/${id}`),
  get: (id: string) => apiGet<FarmResponse>(`/api/farms/${id}`),
  update: (id: string, request: UpdateFarmRequest) =>
    apiPut<FarmResponse>(`/api/farms/${id}`, request),
};

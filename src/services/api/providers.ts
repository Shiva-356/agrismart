import { apiGet } from "./client";

export interface ProviderResponse {
  id: string;
  name: string;
  type: string;
  address: string;
  phone: string;
  verified: boolean;
  acceptingSamples: boolean;
  latitude: number | null;
  longitude: number | null;
  openingHours: string | null;
  reportTimeDays: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListProvidersParams {
  verified?: boolean | undefined;
  acceptingSamples?: boolean | undefined;
  district?: string | undefined;
  type?: string | undefined;
}

/**
 * Soil Testing Providers API service module.
 * Spring Boot REST endpoints:
 * - GET /api/providers
 * - GET /api/providers/{id}
 */
export const providersApi = {
  list: (params?: ListProvidersParams): Promise<ProviderResponse[]> => {
    const queryParams: Record<string, string | boolean> = {};
    if (params?.verified !== undefined) {
      queryParams["verified"] = params.verified;
    }
    if (params?.acceptingSamples !== undefined) {
      queryParams["acceptingSamples"] = params.acceptingSamples;
    }
    if (params?.district) {
      queryParams["district"] = params.district;
    }
    if (params?.type) {
      queryParams["type"] = params.type;
    }
    const hasParams = Object.keys(queryParams).length > 0;
    return apiGet<ProviderResponse[]>(
      "/api/providers",
      hasParams ? { params: queryParams } : undefined,
    );
  },

  getById: (id: string): Promise<ProviderResponse> =>
    apiGet<ProviderResponse>(`/api/providers/${id}`),

  get: (id: string): Promise<ProviderResponse> => apiGet<ProviderResponse>(`/api/providers/${id}`),
};

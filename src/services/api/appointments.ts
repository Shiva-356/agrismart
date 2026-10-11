import { apiGet, apiPatch, apiPost } from "./client";

export type AppointmentMethod = "SAMPLE_COLLECTION" | "LAB_VISIT";

export type AppointmentStatus =
  | "BOOKED"
  | "CONFIRMED"
  | "SAMPLE_COLLECTED"
  | "TESTING"
  | "REPORT_READY"
  | "COMPLETED"
  | "CANCELLED";

export interface FarmSummaryResponse {
  id: string;
  name: string;
  location: string;
  district: string;
}

export interface ProviderSummaryResponse {
  id: string;
  name: string;
  address: string;
  phone: string;
}

export interface AppointmentResponse {
  id: string;
  farmId: string | null;
  farm: FarmSummaryResponse | null;
  providerId: string | null;
  provider: ProviderSummaryResponse | null;
  status: AppointmentStatus;
  method: AppointmentMethod;
  scheduledDate: string;
  scheduledTimeSlot: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAppointmentRequest {
  farmId: string;
  providerId: string;
  method: AppointmentMethod;
  scheduledDate: string;
  scheduledTimeSlot: string;
  notes?: string | undefined;
}

export interface UpdateAppointmentStatusRequest {
  status: AppointmentStatus;
  reason?: string | undefined;
}

export interface CancelAppointmentRequest {
  reason?: string | undefined;
}

export interface ListAppointmentsParams {
  farmId?: string | undefined;
  providerId?: string | undefined;
  status?: AppointmentStatus | undefined;
}

/**
 * Appointments API service module.
 * Spring Boot REST endpoints:
 * - POST  /api/appointments
 * - GET   /api/appointments/{id}
 * - GET   /api/appointments
 * - PATCH /api/appointments/{id}/status
 * - POST  /api/appointments/{id}/cancel
 */
export const appointmentsApi = {
  create: (request: CreateAppointmentRequest): Promise<AppointmentResponse> =>
    apiPost<AppointmentResponse>("/api/appointments", request),

  getById: (id: string): Promise<AppointmentResponse> =>
    apiGet<AppointmentResponse>(`/api/appointments/${id}`),

  get: (id: string): Promise<AppointmentResponse> =>
    apiGet<AppointmentResponse>(`/api/appointments/${id}`),

  list: (params?: ListAppointmentsParams): Promise<AppointmentResponse[]> => {
    const queryParams: Record<string, string> = {};
    if (params?.farmId) {
      queryParams["farmId"] = params.farmId;
    }
    if (params?.providerId) {
      queryParams["providerId"] = params.providerId;
    }
    if (params?.status) {
      queryParams["status"] = params.status;
    }
    const hasParams = Object.keys(queryParams).length > 0;
    return apiGet<AppointmentResponse[]>(
      "/api/appointments",
      hasParams ? { params: queryParams } : undefined,
    );
  },

  updateStatus: (
    id: string,
    request: UpdateAppointmentStatusRequest,
  ): Promise<AppointmentResponse> =>
    apiPatch<AppointmentResponse>(`/api/appointments/${id}/status`, request),

  cancel: (id: string, request?: CancelAppointmentRequest): Promise<AppointmentResponse> =>
    apiPost<AppointmentResponse>(`/api/appointments/${id}/cancel`, request ?? {}),
};

import { apiGet, apiPatch, apiPost } from "./client";

export interface SoilMeasurementAvailability {
  hasN: boolean;
  hasP: boolean;
  hasK: boolean;
  hasPh: boolean;
  hasEc: boolean;
  hasOc: boolean;
  mlReady: boolean;
}

export interface SoilReportResponse {
  id: string;
  farmId: string;
  farmName: string | null;
  appointmentId: string | null;
  laboratoryName: string;
  sampleId: string | null;
  testDate: string;
  verified: boolean;
  nitrogen: number | null;
  phosphorus: number | null;
  potassium: number | null;
  ph: number | null;
  electricalConductivity: number | null;
  organicCarbon: number | null;
  notes: string | null;
  availability: SoilMeasurementAvailability;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSoilReportRequest {
  farmId: string;
  appointmentId?: string | undefined;
  laboratoryName: string;
  sampleId?: string | undefined;
  testDate: string;
  nitrogen?: number | undefined;
  phosphorus?: number | undefined;
  potassium?: number | undefined;
  ph?: number | undefined;
  electricalConductivity?: number | undefined;
  organicCarbon?: number | undefined;
  notes?: string | undefined;
}

export interface VerifySoilReportRequest {
  remarks?: string | undefined;
}

export interface ListSoilReportsParams {
  farmId: string;
  verified?: boolean | undefined;
}

/**
 * Soil Reports API service module.
 * Spring Boot REST endpoints:
 * - POST  /api/soil-reports
 * - GET   /api/soil-reports/{id}
 * - GET   /api/soil-reports?farmId={farmId}&verified={optional}
 * - GET   /api/soil-reports/latest?farmId={farmId}
 * - PATCH /api/soil-reports/{id}/verify
 */
export const soilReportsApi = {
  create: (request: CreateSoilReportRequest): Promise<SoilReportResponse> =>
    apiPost<SoilReportResponse>("/api/soil-reports", request),

  getById: (id: string): Promise<SoilReportResponse> =>
    apiGet<SoilReportResponse>(`/api/soil-reports/${id}`),

  get: (id: string): Promise<SoilReportResponse> =>
    apiGet<SoilReportResponse>(`/api/soil-reports/${id}`),

  list: (params: ListSoilReportsParams): Promise<SoilReportResponse[]> => {
    const queryParams: Record<string, string | boolean> = { farmId: params.farmId };
    if (params.verified !== undefined) {
      queryParams["verified"] = params.verified;
    }
    return apiGet<SoilReportResponse[]>("/api/soil-reports", { params: queryParams });
  },

  getLatest: (farmId: string): Promise<SoilReportResponse> =>
    apiGet<SoilReportResponse>("/api/soil-reports/latest", { params: { farmId } }),

  verify: (id: string, request?: VerifySoilReportRequest): Promise<SoilReportResponse> =>
    apiPatch<SoilReportResponse>(`/api/soil-reports/${id}/verify`, request ?? {}),
};

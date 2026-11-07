import { apiGet, apiPost } from "./client";

export interface RankedCropResponse {
  crop: string;
  probability: number;
}

export interface RecommendationInputFeatures {
  nitrogen: number | null;
  phosphorus: number | null;
  potassium: number | null;
  ph: number | null;
  temperature: number | null;
  humidity: number | null;
  rainfall: number | null;
  seasonalRainfallMm?: number | null | undefined;
  soilReportDate: string | null;
  weatherObservedAt: string | null;
  weatherSource: string | null;
}

export interface RecommendationResponse {
  farmId: string;
  soilReportId: string;
  recommendedCrop: string;
  rankedCrops: RankedCropResponse[];
  modelName: string;
  inputFeatures: RecommendationInputFeatures;
  generatedAt: string;
  note: string | null;
}

/**
 * Ambient station weather observation (`/api/weather`).
 * `rainfall` here is short-interval / 1-hour precipitation and MUST NEVER be passed
 * as `seasonalRainfallMm` to the crop recommendation endpoints.
 */
export interface WeatherObservation {
  temperature: number;
  humidity: number;
  rainfall: number;
  observedAt?: string | undefined;
  source?: string | undefined;
}

/**
 * Request payload for `POST /api/farms/{farmId}/recommendation`.
 * Requires explicit growing-season cumulative rainfall (`seasonalRainfallMm`) in mm.
 */
export interface RecommendationRequest {
  temperature?: number | null | undefined;
  humidity?: number | null | undefined;
  seasonalRainfallMm: number;
  observedAt?: string | undefined;
  source?: string | undefined;
}

/**
 * Recommendations API service module.
 * Spring Boot REST endpoints:
 * - GET  /api/farms/{farmId}/recommendation?seasonalRainfallMm=...
 * - POST /api/farms/{farmId}/recommendation
 */
export const recommendationsApi = {
  get: (farmId: string, seasonalRainfallMm?: number): Promise<RecommendationResponse> =>
    apiGet<RecommendationResponse>(`/api/farms/${farmId}/recommendation`, {
      params: seasonalRainfallMm !== undefined ? { seasonalRainfallMm } : undefined,
    }),

  generate: (farmId: string, request: RecommendationRequest): Promise<RecommendationResponse> =>
    apiPost<RecommendationResponse>(`/api/farms/${farmId}/recommendation`, request),
};

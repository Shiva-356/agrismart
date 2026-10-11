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

export interface WeatherObservation {
  temperature: number;
  humidity: number;
  rainfall: number;
  observedAt?: string | undefined;
  source?: string | undefined;
}

/**
 * Recommendations API service module.
 * Spring Boot REST endpoints:
 * - GET  /api/farms/{farmId}/recommendation
 * - POST /api/farms/{farmId}/recommendation
 */
export const recommendationsApi = {
  get: (farmId: string): Promise<RecommendationResponse> =>
    apiGet<RecommendationResponse>(`/api/farms/${farmId}/recommendation`),

  generate: (farmId: string, weather?: WeatherObservation): Promise<RecommendationResponse> =>
    apiPost<RecommendationResponse>(
      `/api/farms/${farmId}/recommendation`,
      weather !== undefined ? weather : {},
    ),
};

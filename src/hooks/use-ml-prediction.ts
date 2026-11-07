import { useQuery } from "@tanstack/react-query";
import { areMlFeaturesComplete, type MlPredictionFeatures } from "@/lib/agri";
import { predictionService } from "@/services";
import type { CropPrediction } from "@/services/types";

export interface UseMlPredictionResult {
  mlPrediction: CropPrediction | null;
  mlServiceError: string | null;
  mlLoading: boolean;
  allowLocalForestFallback: boolean;
  refetchMl: () => void;
}

/**
 * Connects active farm-plan laboratory & seasonal climate inputs to the real
 * `POST /api/predict` service (FastAPI scikit-learn runtime when configured,
 * or the server-side 200-tree exported Random Forest artifact).
 *
 * - Never calls `/api/predict` when any of the 7 required features is missing or out of range.
 * - Surfaces genuine API errors (`mlServiceError`) and disables local fallback on service errors
 *   so failed ML requests degrade transparently to Rule-Based recommendations instead of claiming
 *   a hybrid result.
 */
export function useMlPrediction(
  features: Partial<MlPredictionFeatures> | null | undefined,
): UseMlPredictionResult {
  const isComplete = areMlFeaturesComplete(features);
  const stableVector = isComplete
    ? [
        features.N,
        features.P,
        features.K,
        features.temperature,
        features.humidity,
        features.ph,
        features.rainfall,
      ]
    : null;

  const query = useQuery({
    queryKey: ["ml-prediction", ...(stableVector ?? ["incomplete"])],
    queryFn: () => {
      if (!isComplete) {
        throw new Error("All 7 ML features are required before calling /api/predict.");
      }
      return predictionService.predict({
        N: features.N,
        P: features.P,
        K: features.K,
        temperature: features.temperature,
        humidity: features.humidity,
        ph: features.ph,
        rainfall: features.rainfall,
      });
    },
    enabled: isComplete && typeof window !== "undefined",
    staleTime: 60_000,
    retry: 1,
  });

  const mlServiceError =
    query.error instanceof Error ? query.error.message : query.error ? String(query.error) : null;

  return {
    mlPrediction: query.data ?? null,
    mlServiceError,
    mlLoading: isComplete && query.isFetching,
    allowLocalForestFallback: mlServiceError === null,
    refetchMl: () => {
      void query.refetch();
    },
  };
}

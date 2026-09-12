import {
  demoAppointments,
  demoCultivation,
  demoFarm,
  demoMlEvaluation,
  demoNotifications,
  demoProviders,
  demoRecommendation,
  demoReports,
  demoWeather,
} from "./demo-data";
import evaluationArtifact from "./ml/evaluation_results.json";
import type {
  Appointment,
  CropPrediction,
  CultivationStage,
  Envelope,
  Farm,
  MlEvaluation,
  Notification,
  Provider,
  RecommendationResult,
  SoilReport,
  SoilStatus,
  Weather,
} from "./types";

export * from "./types";

/**
 * Service layer. Each domain has its own adapter so a real API client can
 * replace the demo adapter without touching any component.
 */
export const API_BASE = import.meta.env["VITE_AGRISMART_API_URL"] as string | undefined;
export const USING_DEMO_ADAPTERS = !API_BASE;

const LATENCY = 250;

async function demo<T>(data: T): Promise<Envelope<T>> {
  await new Promise((r) => setTimeout(r, LATENCY));
  return { data, source: "demo", fetchedAt: new Date().toISOString() };
}

async function get<T>(path: string, fallback: T): Promise<Envelope<T>> {
  if (!API_BASE) return demo(fallback);
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return { data: (await res.json()) as T, source: "api", fetchedAt: new Date().toISOString() };
}

async function post<T>(path: string, body: unknown, fallback: T): Promise<Envelope<T>> {
  if (!API_BASE) return demo(fallback);
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return { data: (await res.json()) as T, source: "api", fetchedAt: new Date().toISOString() };
}

export const farmsService = {
  getActiveFarm: () => get<Farm>("/farms/active", demoFarm),
};

export const weatherService = {
  getCurrent: (farmId: string) =>
    get<Weather>(`/weather?farmId=${encodeURIComponent(farmId)}`, demoWeather),
};

export const soilService = {
  getStatus: async (): Promise<Envelope<SoilStatus>> => {
    const reports = await soilReportsService.list();
    const latest = reports.data[0];
    return {
      ...reports,
      data: {
        hasReport: Boolean(latest),
        latestReportId: latest?.id ?? null,
        parameters: latest?.parameters ?? [],
      },
    };
  },
};

export const providersService = {
  list: () => get<Provider[]>("/providers", demoProviders),
  byId: async (id: string) => {
    const all = await providersService.list();
    return { ...all, data: all.data.find((p) => p.id === id) ?? null };
  },
};

export const appointmentsService = {
  list: () => get<Appointment[]>("/appointments", demoAppointments),
  byId: async (id: string) => {
    const all = await appointmentsService.list();
    return { ...all, data: all.data.find((a) => a.id === id) ?? null };
  },
  book: (payload: Omit<Appointment, "id" | "status" | "history" | "providerName">) =>
    post<Appointment | null>("/appointments", payload, null),
};

export const soilReportsService = {
  list: () => get<SoilReport[]>("/soil-reports", demoReports),
  byId: async (id: string) => {
    const all = await soilReportsService.list();
    return { ...all, data: all.data.find((r) => r.id === id) ?? null };
  },
};

export const recommendationsService = {
  get: (farmId: string) =>
    get<RecommendationResult>(
      `/recommendations?farmId=${encodeURIComponent(farmId)}`,
      demoRecommendation,
    ),
};

export const cultivationService = {
  getGuide: (crop: string) =>
    get<CultivationStage[]>(`/cultivation/${encodeURIComponent(crop)}`, demoCultivation(crop)),
};

export const mlEvaluationService = {
  /**
   * Real evaluation artifact produced by `python ml/train.py` and checked into
   * `src/services/ml/`. Falls back to the demo adapter only if the artifact is
   * missing. Nothing here is computed in the browser.
   */
  get: async (): Promise<Envelope<MlEvaluation>> => {
    if (API_BASE) return get<MlEvaluation>("/ml-evaluation", demoMlEvaluation);
    const artifact = evaluationArtifact as unknown as MlEvaluation & { generatedAt?: string };
    if (!artifact?.benchmarks?.length) return demo(demoMlEvaluation);
    return {
      data: artifact,
      source: "artifact",
      fetchedAt: artifact.generatedAt ?? new Date().toISOString(),
    };
  },
};

export const predictionService = {
  /** Calls the app's /api/predict route (FastAPI when configured, otherwise the exported forest). */
  predict: async (input: {
    N: number;
    P: number;
    K: number;
    temperature: number;
    humidity: number;
    ph: number;
    rainfall: number;
  }): Promise<CropPrediction> => {
    const res = await fetch("/api/predict", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error ?? `Prediction failed (${res.status})`);
    return body as CropPrediction;
  },
};

export const notificationsService = {
  list: () => get<Notification[]>("/notifications", demoNotifications),
};

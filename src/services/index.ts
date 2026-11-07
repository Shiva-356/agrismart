import {
  demoAppointments,
  demoFarm,
  demoMlEvaluation,
  demoNotifications,
  demoProviders,
  demoReports,
  demoWeather,
} from "./demo-data";
import {
  ALL_CULTIVATION_GUIDES,
  getCropCultivationGuide,
  type CropCultivationGuide,
} from "@/data/crop-cultivation";
import {
  fetchOpenMeteoWeather,
  searchLocations,
  requestBrowserGeolocation,
  type GeocodedLocation,
} from "./weather";
import evaluationArtifact from "./ml/evaluation_results.json";
import {
  API_BASE_URL,
  ApiError,
  apiGet,
  appointmentsApi,
  farmsApi,
  providersApi,
  recommendationsApi,
  soilReportsApi,
  usersApi,
  type AppointmentMethod as ApiAppointmentMethod,
  type AppointmentResponse,
  type AppointmentStatus as ApiAppointmentStatus,
  type CreateAppointmentRequest,
  type CreateFarmRequest,
  type CreateUserRequest,
  type FarmResponse,
  type ProviderResponse,
  type RankedCropResponse,
  type RecommendationRequest,
  type RecommendationResponse,
  type SoilReportResponse,
  type UpdateFarmRequest,
} from "./api";
import {
  clearAllHistory,
  deleteHistoryRecord,
  findDemoProfile,
  getActiveFarmId,
  isBackendUserSession,
  loadHistory,
  loadUser,
  saveDemoProfile,
  saveHistoryEntry,
  setActiveFarmId,
  setUser,
  type DeleteHistoryResult,
  type HistoryEntry,
  type MlPredictionFeatures,
  type UserSession,
} from "@/lib/agri";
import type {
  Appointment,
  CropPrediction,
  CropRecommendation,
  CultivationStage,
  Envelope,
  Farm,
  MlEvaluation,
  Notification,
  Provider,
  RecommendationResult,
  SoilReport,
  SoilStatus,
  UserProfile,
  Weather,
} from "./types";

export * from "./types";
export * from "./api";
export type { AppointmentStatus } from "./types";
export type { CropCultivationGuide } from "@/data/crop-cultivation";

/**
 * Service layer. Each domain has its own adapter so a real API client can
 * replace the demo adapter without touching any component.
 * Uses the centrally resolved API base URL from the API client.
 */
export const API_BASE = API_BASE_URL;
export const USING_DEMO_ADAPTERS = !API_BASE;

/**
 * Returns true when no backend API URL is configured OR the user explicitly
 * opted into an unauthenticated local Demo Mode session.
 */
export function shouldUseDemoAdapters(): boolean {
  if (!API_BASE) return true;
  const current = loadUser();
  return current?.authMode === "demo";
}

const LATENCY = 250;

async function demo<T>(data: T): Promise<Envelope<T>> {
  await new Promise((r) => setTimeout(r, LATENCY));
  return { data, source: "demo", fetchedAt: new Date().toISOString() };
}

async function get<T>(path: string, fallback: T): Promise<Envelope<T>> {
  if (shouldUseDemoAdapters()) return demo(fallback);
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  return { data: (await res.json()) as T, source: "api", fetchedAt: new Date().toISOString() };
}

/**
 * Adapts Spring Boot FarmResponse into the frontend Farm domain model.
 */
export function adaptFarmResponse(farm: FarmResponse, ownerName?: string): Farm {
  return {
    id: farm.id,
    userId: farm.userId,
    name: farm.name,
    ownerName: ownerName || "Farmer",
    location: farm.location,
    district: farm.district,
    landAreaAcres: Number(farm.landAreaAcres),
    currentCrop: farm.currentCrop ?? null,
    irrigation: farm.irrigation,
    createdAt: farm.createdAt,
    updatedAt: farm.updatedAt,
  };
}

/**
 * Adapts Spring Boot ProviderResponse into the frontend Provider domain model.
 * Important: Missing coordinates remain null. Distance remains null.
 * Empty services and testTypes are preserved without fabricating capabilities.
 */
export function adaptProviderResponse(p: ProviderResponse): Provider {
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    distanceKm: null,
    address: p.address,
    phone: p.phone ?? null,
    verified: p.verified,
    acceptingSamples: p.acceptingSamples,
    services: [],
    testTypes: [],
    openingHours: p.openingHours ?? null,
    reportTimeDays: p.reportTimeDays ?? null,
    lat: p.latitude ?? null,
    lng: p.longitude ?? null,
  };
}

const APPOINTMENT_STATUS_MAP: Record<ApiAppointmentStatus, Appointment["status"]> = {
  BOOKED: "booked",
  CONFIRMED: "confirmed",
  SAMPLE_COLLECTED: "sample_collected",
  TESTING: "testing",
  REPORT_READY: "report_ready",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

/**
 * Adapts Spring Boot AppointmentResponse into the frontend Appointment domain model.
 * Note: The backend currently does not provide a complete appointment status history table.
 * We construct only a conservative current-state representation from updatedAt / createdAt
 * without fabricating historical transition timestamps.
 */
export function adaptAppointmentResponse(a: AppointmentResponse): Appointment {
  const status = APPOINTMENT_STATUS_MAP[a.status] ?? "booked";
  const method: "sample_collection" | "lab_visit" =
    a.method === "LAB_VISIT" ? "lab_visit" : "sample_collection";
  const statusTimestamp = a.updatedAt || a.createdAt || new Date().toISOString();

  return {
    id: a.id,
    providerId: a.provider?.id ?? a.providerId ?? "",
    providerName: a.provider?.name ?? "Soil Testing Centre",
    method,
    date: a.scheduledDate,
    time: a.scheduledTimeSlot,
    farmName: a.farm?.name ?? "Farm",
    notes: a.notes ?? "",
    status,
    history: [{ status, at: statusTimestamp }],
  };
}

function getSoilRating(
  key: string,
  val: number | null | undefined,
): "low" | "optimal" | "high" | null {
  if (val === null || val === undefined) return null;
  if (key === "n") {
    if (val < 280) return "low";
    if (val <= 560) return "optimal";
    return "high";
  }
  if (key === "p") {
    if (val < 23) return "low";
    if (val <= 56) return "optimal";
    return "high";
  }
  if (key === "k") {
    if (val < 145) return "low";
    if (val <= 337) return "optimal";
    return "high";
  }
  if (key === "ph") {
    if (val < 6.0) return "low";
    if (val <= 7.5) return "optimal";
    return "high";
  }
  return null;
}

/**
 * Adapts Spring Boot SoilReportResponse into the frontend SoilReport domain model.
 * Preserves nullable N/P/K/pH/EC/organic-carbon values without fabricating zeros.
 */
export function adaptSoilReportResponse(r: SoilReportResponse): SoilReport {
  return {
    id: r.id,
    laboratory: r.laboratoryName,
    sampleId: r.sampleId ?? "",
    testDate: r.testDate,
    verified: r.verified,
    status: r.verified ? "ready" : "pending",
    parameters: [
      {
        key: "n",
        label: "Nitrogen",
        status: r.nitrogen !== null && r.nitrogen !== undefined ? "available" : "not_tested",
        value: r.nitrogen ?? null,
        unit: "kg/ha",
        rating: getSoilRating("n", r.nitrogen),
      },
      {
        key: "p",
        label: "Phosphorus",
        status: r.phosphorus !== null && r.phosphorus !== undefined ? "available" : "not_tested",
        value: r.phosphorus ?? null,
        unit: "kg/ha",
        rating: getSoilRating("p", r.phosphorus),
      },
      {
        key: "k",
        label: "Potassium",
        status: r.potassium !== null && r.potassium !== undefined ? "available" : "not_tested",
        value: r.potassium ?? null,
        unit: "kg/ha",
        rating: getSoilRating("k", r.potassium),
      },
      {
        key: "ph",
        label: "pH",
        status: r.ph !== null && r.ph !== undefined ? "available" : "not_tested",
        value: r.ph ?? null,
        unit: null,
        rating: getSoilRating("ph", r.ph),
      },
      {
        key: "ec",
        label: "Electrical conductivity",
        status:
          r.electricalConductivity !== null && r.electricalConductivity !== undefined
            ? "available"
            : "not_tested",
        value: r.electricalConductivity ?? null,
        unit: "dS/m",
        rating: null,
      },
      {
        key: "oc",
        label: "Organic carbon",
        status:
          r.organicCarbon !== null && r.organicCarbon !== undefined ? "available" : "not_tested",
        value: r.organicCarbon ?? null,
        unit: "%",
        rating: null,
      },
    ],
  };
}

/**
 * Adapts Spring Boot RecommendationResponse into the frontend RecommendationResult domain model.
 */
export function adaptRecommendationResponse(r: RecommendationResponse): RecommendationResult {
  const ranked = r.rankedCrops || [];
  const mapCrop = (rc: RankedCropResponse): CropRecommendation => {
    const confidencePct = rc.probability != null ? Math.round(rc.probability * 100) : null;
    const suitability =
      confidencePct !== null ? `${confidencePct}% Uncalibrated Model Score` : "Model Candidate";
    const guide = getCropCultivationGuide(rc.crop);
    return {
      crop: rc.crop,
      confidencePct,
      suitability,
      waterRequirement: guide?.waterRequirement ?? null,
      growthDurationDays: guide?.durationDays ?? null,
      complexity: guide?.category ? `${guide.category}` : null,
      weatherSuitability: null,
      soilSuitability: null,
    };
  };

  const firstRanked = ranked[0];
  const top: CropRecommendation =
    firstRanked !== undefined
      ? mapCrop(firstRanked)
      : (() => {
          const guide = getCropCultivationGuide(r.recommendedCrop);
          return {
            crop: r.recommendedCrop,
            confidencePct: null,
            suitability: "Model Candidate",
            waterRequirement: guide?.waterRequirement ?? null,
            growthDurationDays: guide?.durationDays ?? null,
            complexity: guide?.category ? `${guide.category}` : null,
            weatherSuitability: null,
            soilSuitability: null,
          };
        })();

  const alternatives: CropRecommendation[] = ranked.length > 1 ? ranked.slice(1).map(mapCrop) : [];

  const used: string[] = [];
  const missing: string[] = [];
  const feats = r.inputFeatures;
  if (feats) {
    if (feats.nitrogen != null) used.push("Nitrogen (N)");
    else missing.push("Nitrogen (N)");
    if (feats.phosphorus != null) used.push("Phosphorus (P)");
    else missing.push("Phosphorus (P)");
    if (feats.potassium != null) used.push("Potassium (K)");
    else missing.push("Potassium (K)");
    if (feats.ph != null) used.push("Soil pH");
    else missing.push("Soil pH");
    if (feats.temperature != null) used.push("Temperature");
    else missing.push("Temperature");
    if (feats.humidity != null) used.push("Humidity");
    else missing.push("Humidity");
    const seasonalRain = feats.seasonalRainfallMm ?? feats.rainfall;
    if (seasonalRain != null) used.push("Seasonal rainfall");
    else missing.push("Seasonal rainfall");
  }

  const totalFeatures = 7;
  const dataCompletenessPct = feats ? Math.round((used.length / totalFeatures) * 100) : null;
  const reliability: "High" | "Moderate" | "Low" | null =
    dataCompletenessPct !== null
      ? dataCompletenessPct >= 80
        ? "High"
        : dataCompletenessPct >= 50
          ? "Moderate"
          : "Low"
      : null;

  return {
    top,
    alternatives,
    dataCompletenessPct,
    reliability,
    explanation:
      r.note ||
      `Uncalibrated ${r.modelName || "ML model"} score derived from benchmark training data; not a calibrated probability or field guarantee.`,
    factors: [],
    dataUsed: used,
    dataMissing: missing,
  };
}

/**
 * User service adapters.
 * Important: The Spring Boot backend currently implements profile lookup/creation
 * (`POST /api/users`, `GET /api/users?email=...`) without password hashing,
 * credential verification, session tokens, or authorization.
 * Backend profile operations and Demo Mode sessions are kept strictly separated.
 */
export const usersService = {
  /**
   * Looks up a registered farmer profile on the Spring Boot backend by email.
   * - Requires API_BASE to be configured.
   * - Distinguishes verified RESOURCE_NOT_FOUND (account does not exist) from
   *   missing /api/users endpoints (HTTP 404 HTML/NOT_FOUND) and network errors.
   */
  loginBackendProfile: async (email: string): Promise<UserProfile> => {
    const cleanEmail = email.trim();
    if (!API_BASE) {
      throw new ApiError({
        status: 503,
        error: "BACKEND_NOT_CONFIGURED",
        message:
          "No Spring Boot backend URL (VITE_AGRISMART_API_URL) is configured in this environment. Use explicit Demo Mode to preview locally.",
      });
    }
    try {
      return await usersApi.getByEmail(cleanEmail);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.isEndpointMissing) {
        throw new ApiError({
          status: 503,
          error: "AUTH_ENDPOINT_UNAVAILABLE",
          message:
            "The backend /api/users endpoint is not available at the configured API URL. Account existence could not be verified.",
        });
      }
      throw err;
    }
  },

  /**
   * Creates a farmer profile record on the Spring Boot backend.
   * Never sends or stores plaintext passwords.
   */
  registerBackendProfile: async (request: CreateUserRequest): Promise<UserProfile> => {
    if (!API_BASE) {
      throw new ApiError({
        status: 503,
        error: "BACKEND_NOT_CONFIGURED",
        message:
          "No Spring Boot backend URL (VITE_AGRISMART_API_URL) is configured in this environment. Use explicit Demo Mode to preview locally.",
      });
    }
    try {
      return await usersApi.create({
        fullName: request.fullName.trim(),
        email: request.email.trim(),
        phoneNumber: request.phoneNumber?.trim() || null,
      });
    } catch (err: unknown) {
      if (err instanceof ApiError && err.isEndpointMissing) {
        throw new ApiError({
          status: 503,
          error: "AUTH_ENDPOINT_UNAVAILABLE",
          message:
            "The backend /api/users endpoint is not available at the configured API URL. Could not create a backend profile.",
        });
      }
      throw err;
    }
  },

  /**
   * Starts an explicitly labelled, unauthenticated local Demo Mode session.
   * Never fabricates a backend UUID and never accepts or stores passwords.
   */
  startDemoSession: (input?: {
    email?: string | undefined;
    fullName?: string | undefined;
    phoneNumber?: string | null | undefined;
  }): UserSession => {
    const rawEmail = input?.email?.trim() || "";
    const existingDemo = rawEmail ? findDemoProfile(rawEmail) : null;
    const resolvedEmail = rawEmail || existingDemo?.email || "demo.farmer@agrismart.local";
    const resolvedName =
      input?.fullName?.trim() ||
      existingDemo?.fullName ||
      (rawEmail ? rawEmail.split("@")[0] : "") ||
      "Demo Farmer";
    const resolvedPhone = input?.phoneNumber?.trim() ?? existingDemo?.phoneNumber ?? null;

    saveDemoProfile({
      email: resolvedEmail,
      fullName: resolvedName,
      phoneNumber: resolvedPhone,
    });

    const session: UserSession = {
      email: resolvedEmail,
      fullName: resolvedName,
      phoneNumber: resolvedPhone,
      authMode: "demo",
    };
    setActiveFarmId(null);
    setUser(session);
    return session;
  },

  create: async (request: CreateUserRequest): Promise<Envelope<UserProfile>> => {
    if (shouldUseDemoAdapters()) {
      const session = usersService.startDemoSession({
        email: request.email,
        fullName: request.fullName,
        phoneNumber: request.phoneNumber,
      });
      return demo<UserProfile>({
        id: "demo-preview-only",
        fullName: session.fullName ?? request.fullName,
        email: session.email,
        phoneNumber: session.phoneNumber ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    const user = await usersService.registerBackendProfile(request);
    return { data: user, source: "api", fetchedAt: new Date().toISOString() };
  },

  getById: async (id: string): Promise<Envelope<UserProfile>> => {
    if (shouldUseDemoAdapters()) {
      return demo<UserProfile>({
        id,
        fullName: "Demo Farmer",
        email: "demo.farmer@agrismart.local",
        phoneNumber: null,
      });
    }
    const user = await usersApi.get(id);
    return { data: user, source: "api", fetchedAt: new Date().toISOString() };
  },

  getByEmail: async (email: string): Promise<Envelope<UserProfile | null>> => {
    if (shouldUseDemoAdapters()) {
      const saved = findDemoProfile(email);
      return demo<UserProfile>({
        id: "demo-preview-only",
        fullName: saved?.fullName || email.split("@")[0] || "Demo Farmer",
        email,
        phoneNumber: saved?.phoneNumber ?? null,
      });
    }
    const user = await usersService.loginBackendProfile(email);
    return { data: user, source: "api", fetchedAt: new Date().toISOString() };
  },
};

/**
 * Farm service adapter preserving dashboard and route behaviors.
 * Enforces user-scoped farm queries without calling unrestricted GET /api/farms.
 */
export const farmsService = {
  current: () => farmsService.getActiveFarm(),

  getActiveFarm: async (): Promise<Envelope<Farm | null>> => {
    if (shouldUseDemoAdapters()) {
      return demo<Farm>(demoFarm);
    }
    const sessionUser = loadUser();
    const activeFarmId = getActiveFarmId();

    // 1. If UserSession has an activeFarmId, load by ID
    if (activeFarmId) {
      try {
        const farm = await farmsApi.get(activeFarmId);
        return {
          data: adaptFarmResponse(farm, sessionUser?.fullName),
          source: "api",
          fetchedAt: new Date().toISOString(),
        };
      } catch (err) {
        // If activeFarmId not found on server, clear and fall through to user's list
        if (err instanceof ApiError && err.isResourceNotFound) {
          setActiveFarmId(null);
        } else {
          throw err;
        }
      }
    }

    // 2. If UserSession has a verified backend user ID, list farms for that user
    let effectiveUserId = isBackendUserSession(sessionUser) ? sessionUser?.id : undefined;
    if (!effectiveUserId && sessionUser?.email && sessionUser.authMode !== "demo") {
      try {
        const resolvedUser = await usersApi.getByEmail(sessionUser.email);
        if (resolvedUser?.id) {
          effectiveUserId = resolvedUser.id;
          setUser({
            ...(sessionUser ?? {}),
            id: resolvedUser.id,
            email: resolvedUser.email,
            fullName: resolvedUser.fullName || sessionUser?.fullName,
            phoneNumber: resolvedUser.phoneNumber ?? sessionUser?.phoneNumber,
            authMode: "backend",
          });
        }
      } catch (err) {
        console.warn("Could not auto-resolve backend user by email:", err);
      }
    }

    if (effectiveUserId) {
      try {
        const userFarms = await farmsApi.list(effectiveUserId);
        const firstFarm = userFarms[0];
        if (firstFarm) {
          setActiveFarmId(firstFarm.id);
          return {
            data: adaptFarmResponse(firstFarm, sessionUser?.fullName),
            source: "api",
            fetchedAt: new Date().toISOString(),
          };
        }
        return {
          data: null,
          source: "api",
          fetchedAt: new Date().toISOString(),
        };
      } catch (err) {
        console.warn("Failed to fetch user farms via API:", err);
        throw err;
      }
    }

    // 3. If there is NO backend user ID, do NOT query unrestricted /api/farms
    return {
      data: null,
      source: "api",
      fetchedAt: new Date().toISOString(),
    };
  },

  list: async (userId?: string): Promise<Envelope<Farm[]>> => {
    if (shouldUseDemoAdapters()) {
      return demo<Farm[]>([demoFarm]);
    }
    const sessionUser = loadUser();
    const effectiveUserId =
      userId || (isBackendUserSession(sessionUser) ? sessionUser?.id : undefined);

    if (effectiveUserId) {
      try {
        const farms = await farmsApi.list(effectiveUserId);
        const adapted = farms.map((f) => adaptFarmResponse(f, sessionUser?.fullName));
        return {
          data: adapted,
          source: "api",
          fetchedAt: new Date().toISOString(),
        };
      } catch (err) {
        console.warn("Failed to list farms via API:", err);
        throw err;
      }
    }

    // Never call GET /api/farms without userId
    return {
      data: [],
      source: "api",
      fetchedAt: new Date().toISOString(),
    };
  },

  getById: async (id: string): Promise<Envelope<Farm | null>> => {
    if (shouldUseDemoAdapters()) {
      return demo<Farm>(demoFarm);
    }
    const sessionUser = loadUser();
    try {
      const farm = await farmsApi.get(id);
      return {
        data: adaptFarmResponse(farm, sessionUser?.fullName),
        source: "api",
        fetchedAt: new Date().toISOString(),
      };
    } catch (err) {
      if (err instanceof ApiError && err.isResourceNotFound) {
        return { data: null, source: "api", fetchedAt: new Date().toISOString() };
      }
      console.warn(`Failed to get farm ${id} via API:`, err);
      throw err;
    }
  },

  create: async (request: CreateFarmRequest, ownerName?: string): Promise<Envelope<Farm>> => {
    if (shouldUseDemoAdapters()) {
      const fakeFarm: Farm = {
        ...demoFarm,
        ...request,
        id: "farm-" + Date.now(),
        ownerName: ownerName || "Farmer",
        currentCrop: request.currentCrop ?? null,
      };
      setActiveFarmId(fakeFarm.id);
      return demo<Farm>(fakeFarm);
    }
    const sessionUser = loadUser();
    try {
      const created = await farmsApi.create(request);
      const adapted = adaptFarmResponse(created, ownerName || sessionUser?.fullName);
      setActiveFarmId(adapted.id);
      return {
        data: adapted,
        source: "api",
        fetchedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.warn("Failed to create farm via API:", err);
      throw err;
    }
  },

  update: async (
    patchOrId: Partial<Farm> | string,
    request?: UpdateFarmRequest,
    ownerName?: string,
  ): Promise<Envelope<Farm>> => {
    if (shouldUseDemoAdapters()) {
      if (typeof patchOrId === "object") {
        return demo<Farm>({ ...demoFarm, ...patchOrId });
      }
      return demo<Farm>({
        ...demoFarm,
        ...request,
        id: patchOrId,
        ownerName: ownerName || "Farmer",
        currentCrop: request?.currentCrop ?? null,
      });
    }
    const sessionUser = loadUser();
    if (typeof patchOrId === "string" && request) {
      try {
        const updated = await farmsApi.update(patchOrId, request);
        const adapted = adaptFarmResponse(updated, ownerName || sessionUser?.fullName);
        return {
          data: adapted,
          source: "api",
          fetchedAt: new Date().toISOString(),
        };
      } catch (err) {
        console.warn("Failed to update farm via API:", err);
        throw err;
      }
    }
    throw new Error("Invalid arguments to farmsService.update in API mode.");
  },
};

export const weatherService = {
  getCurrent: async (
    farmId?: string,
    coordsOverride?: { lat: number; lon: number; locationName?: string },
  ): Promise<Envelope<Weather>> => {
    // 1. If coordinates override is provided (e.g. from user location selection)
    if (coordsOverride && coordsOverride.lat != null && coordsOverride.lon != null) {
      try {
        const live = await fetchOpenMeteoWeather(
          coordsOverride.lat,
          coordsOverride.lon,
          coordsOverride.locationName,
        );
        return {
          data: live,
          source: live.isLive ? "api" : "demo",
          fetchedAt: live.observedAt,
        };
      } catch (err) {
        console.warn("Failed to fetch weather for coordinates:", err);
      }
    }

    // 2. Query Spring Boot backend if API_BASE is active and not in demo session
    if (!shouldUseDemoAdapters() && farmId) {
      try {
        const obs = await apiGet<{
          temperature: number;
          humidity: number;
          rainfall: number;
          observedAt?: string;
          source?: string;
        }>("/api/weather", { params: { farmId } });

        return {
          data: {
            temperatureC: obs.temperature,
            humidityPct: obs.humidity,
            rainfallMm: obs.rainfall,
            condition: obs.source || "Observed",
            observedAt: obs.observedAt || new Date().toISOString(),
            forecast: [],
            locationName: obs.source || "Field Station",
            sourceDetails: "Backend Weather Service",
            isLive: true,
          },
          source: "api",
          fetchedAt: obs.observedAt || new Date().toISOString(),
        };
      } catch (err) {
        console.warn("Backend weather API query failed, trying farm location fallback:", err);
      }
    }

    // 3. Fallback: resolve farm location using OpenAPI geocoding and live forecast
    if (farmId) {
      try {
        const farmRes = await farmsService.getById(farmId);
        const farm = farmRes?.data;
        const queryLoc = farm?.location || farm?.district;
        if (queryLoc) {
          const locs = await searchLocations(queryLoc);
          if (locs.length > 0 && locs[0]) {
            const top = locs[0];
            const live = await fetchOpenMeteoWeather(top.latitude, top.longitude, top.label);
            return {
              data: live,
              source: live.isLive ? "api" : "demo",
              fetchedAt: live.observedAt,
            };
          }
        }
      } catch (err) {
        console.debug("Live farm geocoding fallback failed:", err);
      }
    }

    return demo<Weather>(demoWeather);
  },

  getByCoordinates: async (
    latitude: number,
    longitude: number,
    locationName?: string,
  ): Promise<Envelope<Weather>> => {
    const live = await fetchOpenMeteoWeather(latitude, longitude, locationName);
    return {
      data: live,
      source: live.isLive ? "api" : "demo",
      fetchedAt: live.observedAt,
    };
  },

  getByQuery: async (query: string): Promise<Envelope<Weather>> => {
    const locs = await searchLocations(query);
    if (!locs.length || !locs[0]) {
      throw new Error(`Location not found for: "${query}"`);
    }
    const top = locs[0];
    const live = await fetchOpenMeteoWeather(top.latitude, top.longitude, top.label);
    return {
      data: live,
      source: live.isLive ? "api" : "demo",
      fetchedAt: live.observedAt,
    };
  },

  searchLocations: async (query: string): Promise<GeocodedLocation[]> => {
    return searchLocations(query);
  },

  requestUserLocation: async (): Promise<{ latitude: number; longitude: number }> => {
    return requestBrowserGeolocation();
  },
};

export const soilService = {
  getStatus: async (farmId?: string): Promise<Envelope<SoilStatus>> => {
    if (shouldUseDemoAdapters()) {
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
    }
    const effectiveFarmId = farmId ?? getActiveFarmId();
    if (!effectiveFarmId) {
      return {
        data: {
          hasReport: false,
          latestReportId: null,
          parameters: [],
        },
        source: "api",
        fetchedAt: new Date().toISOString(),
      };
    }
    try {
      const latest = await soilReportsApi.getLatest(effectiveFarmId);
      const adapted = adaptSoilReportResponse(latest);
      return {
        data: {
          hasReport: true,
          latestReportId: adapted.id,
          parameters: adapted.parameters,
        },
        source: "api",
        fetchedAt: new Date().toISOString(),
      };
    } catch (err) {
      if (err instanceof ApiError && err.isResourceNotFound) {
        return {
          data: {
            hasReport: false,
            latestReportId: null,
            parameters: [],
          },
          source: "api",
          fetchedAt: new Date().toISOString(),
        };
      }
      console.warn("Failed to fetch latest soil report via API:", err);
      throw err;
    }
  },
};

export const providersService = {
  list: async (): Promise<Envelope<Provider[]>> => {
    if (shouldUseDemoAdapters()) {
      return demo(demoProviders);
    }
    try {
      const response = await providersApi.list();
      const adapted = response.map(adaptProviderResponse);
      return {
        data: adapted,
        source: "api",
        fetchedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.warn("Failed to fetch providers via API:", err);
      throw err;
    }
  },

  byId: async (id: string): Promise<Envelope<Provider | null>> => {
    if (shouldUseDemoAdapters()) {
      const all = await providersService.list();
      return { ...all, data: all.data.find((p) => p.id === id) ?? null };
    }
    try {
      const response = await providersApi.get(id);
      return {
        data: adaptProviderResponse(response),
        source: "api",
        fetchedAt: new Date().toISOString(),
      };
    } catch (err) {
      if (err instanceof ApiError && err.isResourceNotFound) {
        return {
          data: null,
          source: "api",
          fetchedAt: new Date().toISOString(),
        };
      }
      console.warn(`Failed to fetch provider ${id} via API:`, err);
      throw err;
    }
  },
};

export const appointmentsService = {
  list: async (farmId?: string): Promise<Envelope<Appointment[]>> => {
    if (shouldUseDemoAdapters()) {
      return demo(demoAppointments);
    }
    const effectiveFarmId = farmId ?? getActiveFarmId();
    if (!effectiveFarmId) {
      // When API mode is configured but no active farm exists, return an empty scoped list
      return {
        data: [],
        source: "api",
        fetchedAt: new Date().toISOString(),
      };
    }
    try {
      const response = await appointmentsApi.list({ farmId: effectiveFarmId });
      const adapted = response.map(adaptAppointmentResponse);
      return {
        data: adapted,
        source: "api",
        fetchedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.warn("Failed to fetch appointments via API:", err);
      throw err;
    }
  },

  byId: async (id: string): Promise<Envelope<Appointment | null>> => {
    if (shouldUseDemoAdapters()) {
      const all = await appointmentsService.list();
      return { ...all, data: all.data.find((a) => a.id === id) ?? null };
    }
    try {
      const response = await appointmentsApi.get(id);
      return {
        data: adaptAppointmentResponse(response),
        source: "api",
        fetchedAt: new Date().toISOString(),
      };
    } catch (err) {
      if (err instanceof ApiError && err.isResourceNotFound) {
        return {
          data: null,
          source: "api",
          fetchedAt: new Date().toISOString(),
        };
      }
      console.warn(`Failed to fetch appointment ${id} via API:`, err);
      throw err;
    }
  },

  book: async (
    payload: Omit<Appointment, "id" | "status" | "history" | "providerName"> & {
      farmId?: string | undefined;
    },
  ): Promise<Envelope<Appointment | null>> => {
    if (shouldUseDemoAdapters()) {
      return {
        data: null,
        source: "demo",
        fetchedAt: new Date().toISOString(),
      };
    }
    const targetFarmId = payload.farmId ?? getActiveFarmId();
    if (!targetFarmId) {
      throw new Error("Cannot book appointment: No active farm ID available.");
    }
    try {
      const method: ApiAppointmentMethod =
        payload.method === "lab_visit" ? "LAB_VISIT" : "SAMPLE_COLLECTION";
      const request: CreateAppointmentRequest = {
        farmId: targetFarmId,
        providerId: payload.providerId,
        method,
        scheduledDate: payload.date,
        scheduledTimeSlot: payload.time,
        notes: payload.notes || undefined,
      };
      const response = await appointmentsApi.create(request);
      return {
        data: adaptAppointmentResponse(response),
        source: "api",
        fetchedAt: new Date().toISOString(),
      };
    } catch (err) {
      if (err instanceof ApiError) {
        // Re-throw API errors so the caller can display accurate server error messages
        throw err;
      }
      console.warn("Failed to book appointment via API:", err);
      throw err;
    }
  },
};

export const soilReportsService = {
  list: async (farmId?: string): Promise<Envelope<SoilReport[]>> => {
    if (shouldUseDemoAdapters()) {
      return demo(demoReports);
    }
    const effectiveFarmId = farmId ?? getActiveFarmId();
    if (!effectiveFarmId) {
      return {
        data: [],
        source: "api",
        fetchedAt: new Date().toISOString(),
      };
    }
    try {
      const reports = await soilReportsApi.list({ farmId: effectiveFarmId });
      const adapted = reports.map(adaptSoilReportResponse);
      return {
        data: adapted,
        source: "api",
        fetchedAt: new Date().toISOString(),
      };
    } catch (err) {
      console.warn("Failed to fetch soil reports via API:", err);
      throw err;
    }
  },

  byId: async (id: string): Promise<Envelope<SoilReport | null>> => {
    if (shouldUseDemoAdapters()) {
      const all = await soilReportsService.list();
      return { ...all, data: all.data.find((r) => r.id === id) ?? null };
    }
    try {
      const report = await soilReportsApi.get(id);
      return {
        data: adaptSoilReportResponse(report),
        source: "api",
        fetchedAt: new Date().toISOString(),
      };
    } catch (err) {
      if (err instanceof ApiError && err.isResourceNotFound) {
        return {
          data: null,
          source: "api",
          fetchedAt: new Date().toISOString(),
        };
      }
      console.warn(`Failed to fetch soil report ${id} via API:`, err);
      throw err;
    }
  },
};

export const recommendationsService = {
  get: async (
    farmId: string,
    seasonalRainfallMm?: number,
  ): Promise<Envelope<RecommendationResult>> => {
    if (!farmId) {
      throw new Error("farmId is required to fetch recommendations.");
    }
    if (
      seasonalRainfallMm === undefined ||
      typeof seasonalRainfallMm !== "number" ||
      !Number.isFinite(seasonalRainfallMm)
    ) {
      throw new ApiError({
        status: 422,
        error: "SEASONAL_RAINFALL_REQUIRED",
        errorCode: "SEASONAL_RAINFALL_REQUIRED",
        message:
          "Seasonal cumulative rainfall (seasonalRainfallMm in mm) is required for ML crop prediction. Hourly weather precipitation is never substituted.",
      });
    }
    if (shouldUseDemoAdapters()) {
      throw new ApiError({
        status: 503,
        error: "BACKEND_NOT_CONFIGURED",
        errorCode: "BACKEND_NOT_CONFIGURED",
        message:
          "Spring Boot recommendation endpoint is not configured in local preview mode. Active farm plan recommendations are evaluated directly on the client.",
      });
    }
    try {
      const response = await recommendationsApi.get(farmId, seasonalRainfallMm);
      return {
        data: adaptRecommendationResponse(response),
        source: "api",
        fetchedAt: response.generatedAt || new Date().toISOString(),
      };
    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }
      console.warn(`Failed to fetch recommendations for farm ${farmId} via API:`, err);
      throw err;
    }
  },

  generate: async (
    farmId: string,
    request: RecommendationRequest,
  ): Promise<Envelope<RecommendationResult>> => {
    if (!farmId) {
      throw new Error("farmId is required to generate recommendations.");
    }
    if (
      !request ||
      typeof request.seasonalRainfallMm !== "number" ||
      !Number.isFinite(request.seasonalRainfallMm)
    ) {
      throw new ApiError({
        status: 422,
        error: "SEASONAL_RAINFALL_REQUIRED",
        errorCode: "SEASONAL_RAINFALL_REQUIRED",
        message:
          "Seasonal cumulative rainfall (seasonalRainfallMm in mm) is required for ML crop prediction. Hourly weather precipitation is never substituted.",
      });
    }
    if (shouldUseDemoAdapters()) {
      throw new ApiError({
        status: 503,
        error: "BACKEND_NOT_CONFIGURED",
        errorCode: "BACKEND_NOT_CONFIGURED",
        message:
          "Spring Boot recommendation endpoint is not configured in local preview mode. Active farm plan recommendations are evaluated directly on the client.",
      });
    }
    try {
      const response = await recommendationsApi.generate(farmId, request);
      return {
        data: adaptRecommendationResponse(response),
        source: "api",
        fetchedAt: response.generatedAt || new Date().toISOString(),
      };
    } catch (err) {
      if (err instanceof ApiError) {
        throw err;
      }
      console.warn(`Failed to generate recommendation for farm ${farmId} via API:`, err);
      throw err;
    }
  },
};

export const cultivationService = {
  getGuide: async (crop: string): Promise<Envelope<CultivationStage[]>> => {
    const guide = getCropCultivationGuide(crop);
    if (!guide?.growthStages || guide.growthStages.length === 0) {
      return {
        data: [],
        source: "artifact",
        fetchedAt: new Date().toISOString(),
      };
    }
    const stages: CultivationStage[] = guide.growthStages.map((s, i) => ({
      index: s.index ?? i + 1,
      title: s.title,
      what: s.what,
      when: s.when,
      why: s.why,
      caution: s.caution,
    }));
    return {
      data: stages,
      source: "artifact",
      fetchedAt: new Date().toISOString(),
    };
  },
  getFullGuide: async (crop: string): Promise<Envelope<CropCultivationGuide | null>> => {
    const guide = getCropCultivationGuide(crop);
    return {
      data: guide,
      source: "artifact",
      fetchedAt: new Date().toISOString(),
    };
  },
  listAll: async (): Promise<Envelope<CropCultivationGuide[]>> => {
    return {
      data: ALL_CULTIVATION_GUIDES,
      source: "artifact",
      fetchedAt: new Date().toISOString(),
    };
  },
};

export const mlEvaluationService = {
  /**
   * Real evaluation artifact produced by `python ml/train.py` and checked into
   * `src/services/ml/`. Served directly as genuine evaluation data.
   */
  get: async (): Promise<Envelope<MlEvaluation>> => {
    const raw =
      (evaluationArtifact as unknown as { default?: MlEvaluation })?.default ?? evaluationArtifact;
    const artifact = raw as unknown as MlEvaluation & { generatedAt?: string };
    if (artifact && Array.isArray(artifact.benchmarks) && artifact.benchmarks.length > 0) {
      return {
        data: artifact,
        source: "artifact",
        fetchedAt: artifact.generatedAt ?? new Date().toISOString(),
      };
    }
    return demo(demoMlEvaluation);
  },
};

export const predictionService = {
  /** Calls the app's /api/predict route (FastAPI when configured, otherwise the exported forest). */
  predict: async (input: MlPredictionFeatures): Promise<CropPrediction> => {
    const res = await fetch("/api/predict", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = (await res.json().catch(() => null)) as
      (CropPrediction & { error?: string }) | null;
    if (!res.ok || !body) {
      throw new Error(body?.error ?? `Prediction service error (${res.status})`);
    }
    return body;
  },
};

export class SoilAnalysisServiceError extends Error {
  readonly status: number;
  readonly errorCode: string;

  constructor(message: string, status: number, errorCode = "SOIL_ANALYSIS_ERROR") {
    super(message);
    this.name = "SoilAnalysisServiceError";
    this.status = status;
    this.errorCode = errorCode;
  }
}

export const soilAnalysisService = {
  /**
   * Uploads a soil photograph to POST /api/soil-analysis for supervised texture classification.
   * Never falls back to fabricated or hash-based predictions on error.
   */
  analyzeImage: async (
    file: File | Blob,
    filename?: string,
  ): Promise<import("./types").SoilImageAnalysisResult> => {
    const formData = new FormData();
    if (typeof File !== "undefined" && file instanceof File) {
      formData.append("image", file, file.name);
    } else {
      formData.append("image", file, filename ?? "soil-upload.jpg");
    }

    let res: Response;
    try {
      res = await fetch("/api/soil-analysis", {
        method: "POST",
        body: formData,
      });
    } catch {
      throw new SoilAnalysisServiceError(
        "Unable to reach the Soil Analyzer endpoint. Check your connection and retry.",
        0,
        "NETWORK_ERROR",
      );
    }

    const body = (await res.json().catch(() => null)) as
      (import("./types").SoilImageAnalysisResult & { error?: string; errorCode?: string }) | null;

    if (!res.ok || !body || typeof body.status !== "string") {
      throw new SoilAnalysisServiceError(
        body?.error ?? `Soil classification failed (HTTP ${res.status}).`,
        res.status,
        body?.errorCode ?? "SOIL_ANALYSIS_ERROR",
      );
    }

    return body;
  },
};

export const historyService = {
  list: (): HistoryEntry[] => loadHistory(),
  getById: (id: string): HistoryEntry | null => {
    const cleanId = id?.trim();
    if (!cleanId) return null;
    return loadHistory().find((entry) => entry.id === cleanId) ?? null;
  },
  save: (entry: HistoryEntry, currentUser?: UserSession | null): void => {
    saveHistoryEntry(entry, currentUser);
  },
  deleteRecord: async (
    id: string,
    currentUser?: UserSession | null,
  ): Promise<DeleteHistoryResult> => {
    return deleteHistoryRecord(id, currentUser);
  },
  clearAll: (): void => {
    clearAllHistory();
  },
};

export const notificationsService = {
  list: () => demo<Notification[]>(demoNotifications),
};

export {
  fetchOpenMeteoWeather,
  searchLocations,
  requestBrowserGeolocation,
  type GeocodedLocation,
} from "./weather";

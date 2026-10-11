import {
  demoAppointments,
  demoFarm,
  demoMlEvaluation,
  demoNotifications,
  demoProviders,
  demoRecommendation,
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
  type RecommendationResponse,
  type SoilReportResponse,
  type UpdateFarmRequest,
  type WeatherObservation,
} from "./api";
import { getActiveFarmId, loadUser, setActiveFarmId, setUser } from "@/lib/agri";
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
 */
export const API_BASE =
  typeof import.meta !== "undefined" && import.meta.env
    ? (import.meta.env["VITE_AGRISMART_API_URL"] as string | undefined)
    : undefined;
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
    let suitability = "Recommended";
    if (confidencePct !== null) {
      suitability = confidencePct >= 70 ? "High" : confidencePct >= 40 ? "Moderate" : "Low";
    }
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
            suitability: "Recommended",
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
    if (feats.rainfall != null) used.push("Rainfall");
    else missing.push("Rainfall");
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
      `Recommended based on ${r.modelName || "ML model"} analysis of your soil and environmental factors.`,
    factors: [],
    dataUsed: used,
    dataMissing: missing,
  };
}

/**
 * User service adapters.
 * Spring Boot does not manage passwords; only profile information is exchanged.
 */
export const usersService = {
  create: async (request: CreateUserRequest): Promise<Envelope<UserProfile>> => {
    if (!API_BASE) {
      return demo<UserProfile>({
        id: "user-demo-1",
        fullName: request.fullName,
        email: request.email,
        phoneNumber: request.phoneNumber ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    const user = await usersApi.create({
      fullName: request.fullName,
      email: request.email,
      phoneNumber: request.phoneNumber ?? null,
    });
    return { data: user, source: "api", fetchedAt: new Date().toISOString() };
  },

  getById: async (id: string): Promise<Envelope<UserProfile>> => {
    if (!API_BASE) {
      return demo<UserProfile>({
        id,
        fullName: "Demo Farmer",
        email: "farmer@example.com",
        phoneNumber: null,
      });
    }
    const user = await usersApi.get(id);
    return { data: user, source: "api", fetchedAt: new Date().toISOString() };
  },

  getByEmail: async (email: string): Promise<Envelope<UserProfile | null>> => {
    if (!API_BASE) {
      return demo<UserProfile>({
        id: "user-demo-1",
        fullName: email.split("@")[0] || "Demo Farmer",
        email,
        phoneNumber: null,
      });
    }
    const user = await usersApi.getByEmail(email);
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
    if (!API_BASE) {
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
        if (err instanceof ApiError && err.isNotFound) {
          setActiveFarmId(null);
        } else {
          throw err;
        }
      }
    }

    // 2. If UserSession has backend user ID, list farms for that user
    let effectiveUserId = sessionUser?.id;
    if (!effectiveUserId && sessionUser?.email) {
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
    if (!API_BASE) {
      return demo<Farm[]>([demoFarm]);
    }
    const sessionUser = loadUser();
    const effectiveUserId = userId || sessionUser?.id;

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
    if (!API_BASE) {
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
      if (err instanceof ApiError && err.isNotFound) {
        return { data: null, source: "api", fetchedAt: new Date().toISOString() };
      }
      console.warn(`Failed to get farm ${id} via API:`, err);
      throw err;
    }
  },

  create: async (request: CreateFarmRequest, ownerName?: string): Promise<Envelope<Farm>> => {
    if (!API_BASE) {
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
    if (!API_BASE) {
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
          source: "api",
          fetchedAt: live.observedAt,
        };
      } catch (err) {
        console.warn("Failed to fetch weather for coordinates:", err);
      }
    }

    // 2. Query Spring Boot backend if API_BASE or farmId is available
    if (API_BASE && farmId) {
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
              source: "api",
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
      source: "api",
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
      source: "api",
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
    if (!API_BASE) {
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
      if (err instanceof ApiError && err.isNotFound) {
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
    if (!API_BASE) {
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
    if (!API_BASE) {
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
      if (err instanceof ApiError && err.isNotFound) {
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
    if (!API_BASE) {
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
    if (!API_BASE) {
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
      if (err instanceof ApiError && err.isNotFound) {
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
    if (!API_BASE) {
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
    if (!API_BASE) {
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
    if (!API_BASE) {
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
      if (err instanceof ApiError && err.isNotFound) {
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
  get: async (farmId: string): Promise<Envelope<RecommendationResult>> => {
    if (!API_BASE) {
      return demo(demoRecommendation);
    }
    if (!farmId) {
      throw new Error("farmId is required to fetch recommendations.");
    }
    try {
      const response = await recommendationsApi.get(farmId);
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
    weather?: WeatherObservation,
  ): Promise<Envelope<RecommendationResult>> => {
    if (!API_BASE) {
      return demo(demoRecommendation);
    }
    if (!farmId) {
      throw new Error("farmId is required to generate recommendations.");
    }
    try {
      const response = await recommendationsApi.generate(farmId, weather);
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
  list: () => demo<Notification[]>(demoNotifications),
};

export {
  fetchOpenMeteoWeather,
  searchLocations,
  requestBrowserGeolocation,
  type GeocodedLocation,
} from "./weather";

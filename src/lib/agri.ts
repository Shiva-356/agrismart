import {
  predictWithLocalForest,
  localModelAvailable,
  ML_FEATURE_BOUNDS,
  isValidMlFeatureValue,
} from "./ml/forest";
import { getCropCultivationGuide, getCropGuideSlug } from "@/data/crop-cultivation";
import type { CropPrediction } from "@/services/types";
import {
  computeHybridRecommendations,
  DEFAULT_HYBRID_RANKING_CONFIG,
  normalizeMlCandidates,
  resolveCanonicalCropId,
  type CandidateAgreementState,
  type HybridCropCandidate,
  type HybridEngineMode,
  type HybridRankingConfig,
  type HybridRecommendationResult,
  type MlSourceStatus,
} from "./hybrid-ranking";

export {
  ML_FEATURE_BOUNDS,
  isValidMlFeatureValue,
  computeHybridRecommendations,
  DEFAULT_HYBRID_RANKING_CONFIG,
  normalizeMlCandidates,
  resolveCanonicalCropId,
};
export type {
  CandidateAgreementState,
  HybridCropCandidate,
  HybridEngineMode,
  HybridRankingConfig,
  HybridRecommendationResult,
  MlSourceStatus,
};

import { SOIL_TYPES, type SoilType } from "./soil-types";

export { SOIL_TYPES, type SoilType };

export interface MlPredictionFeatures {
  N: number;
  P: number;
  K: number;
  temperature: number;
  humidity: number;
  ph: number;
  rainfall: number;
}

export type FarmInput = {
  name: string;
  landArea: number;
  water: number;
  soilType: SoilType;
  budget: number;
  preferredCrop: string;
  notes: string;
  mlFeatures?: Partial<MlPredictionFeatures> | undefined;
  /**
   * Ambient weather context (temperature & humidity only).
   * Short-interval / hourly station precipitation is deliberately excluded so it
   * can never be mistaken for cumulative seasonal ML rainfall (`MlPredictionFeatures.rainfall`).
   */
  weather?:
    | {
        temperature?: number | null | undefined;
        humidity?: number | null | undefined;
      }
    | undefined;
};

export type RecommendationSource = "HYBRID" | "ML MODEL" | "RULE-BASED" | "DEMO / ILLUSTRATIVE";

export type Recommendation = {
  crop: string;
  canonicalCropId?: string | undefined;
  overallRank?: number | null | undefined;
  source: RecommendationSource;
  confidence?: number | null | undefined; // Compatibility percentage for RULE-BASED; uncalibrated score pct for ML
  voteSharePct?: number | null | undefined; // Uncalibrated Random Forest score percentage (null for RULE-BASED)
  modelScore?: number | null | undefined; // Raw uncalibrated Random Forest class score in [0, 1]
  fusionIndex?: number | null | undefined; // Normalized ordinal CA-RRF index in [0, 1] when hybrid is active
  agreementState?: string | null | undefined;
  hardConstraintTriggered?: boolean | undefined;
  ruleRank?: number | null | undefined;
  mlRank?: number | null | undefined;
  hybridRationale?: string | null | undefined;
  expectedYield?: string | null | undefined;
  waterNeed?: string | null | undefined;
  estimatedProfit?: string | null | undefined;
  growthDurationDays?: number | null | undefined;
  rationale: string;
  modelName?: string | null | undefined;
  treeCount?: number | null | undefined;
  note?: string | null | undefined;
  suitabilityScore?: number | null | undefined;
  matchingFactors?: string[] | undefined;
  limitations?: string[] | undefined;
  economicNote?: string | null | undefined;
  dataUsed?: string[] | undefined;
  dataMissing?: string[] | undefined;
};

export type HistoryEntry = {
  id: string;
  createdAt: string;
  input: FarmInput;
  recommendations: Recommendation[];
  ownerKey?: string | null | undefined;
  hybridMode?: string | undefined;
  sourcesUsed?: string[] | undefined;
  featuresUsed?:
    | {
        N?: number | undefined;
        P?: number | undefined;
        K?: number | undefined;
        temperature?: number | undefined;
        humidity?: number | undefined;
        ph?: number | undefined;
        rainfall?: number | undefined;
      }
    | undefined;
  disclaimer?: string | undefined;
};

/**
 * Validates that all seven real environmental and chemical parameters are provided
 * and fall within the schema bounds accepted by FastAPI and `/api/predict`.
 * Never invents or silently substitutes missing values.
 */
export function areMlFeaturesComplete(
  features: Partial<MlPredictionFeatures> | null | undefined,
): features is MlPredictionFeatures {
  if (!features) return false;
  const keys: (keyof MlPredictionFeatures)[] = [
    "N",
    "P",
    "K",
    "temperature",
    "humidity",
    "ph",
    "rainfall",
  ];
  return keys.every((k) => isValidMlFeatureValue(k, features[k]));
}

export function formatMlPredictionRecommendations(
  features: MlPredictionFeatures,
  ranked: ReadonlyArray<{ crop: string; probability: number }>,
  options?: {
    modelName?: string | null | undefined;
    treeCount?: number | null | undefined;
    isDemoProfile?: boolean | undefined;
  },
): Recommendation[] {
  const isDemo = Boolean(options?.isDemoProfile);
  return ranked.map((r, i) => {
    const guide = getCropCultivationGuide(r.crop);
    const canonicalCropId = guide?.crop ?? r.crop.trim().toLowerCase();
    const modelScorePct = Math.round(r.probability * 100);
    const displayName = guide?.displayName ?? r.crop.charAt(0).toUpperCase() + r.crop.slice(1);
    const isTop = i === 0;

    return {
      crop: displayName,
      canonicalCropId,
      overallRank: i + 1,
      mlRank: i + 1,
      source: isDemo ? "DEMO / ILLUSTRATIVE" : "ML MODEL",
      voteSharePct: modelScorePct,
      confidence: modelScorePct, // backwards-compatible field
      modelScore: r.probability,
      waterNeed: guide?.waterRequirement ?? null,
      growthDurationDays: guide?.durationDays ?? null,
      expectedYield: null, // Unsupported synthetic yield omitted
      estimatedProfit: null, // Unsupported synthetic profit omitted
      modelName: options?.modelName ?? "Random Forest (200 trees)",
      treeCount: options?.treeCount ?? 200,
      rationale: isTop
        ? `Primary prediction: ${displayName} received an uncalibrated model score of ${modelScorePct}% across the 200-tree Random Forest ensemble based on ${isDemo ? "illustrative demo " : "verified "}N=${features.N}, P=${features.P}, K=${features.K}, pH=${features.ph}, Temp=${features.temperature}°C, Humidity=${features.humidity}%, Seasonal Rainfall=${features.rainfall}mm.`
        : `Ranked alternative (#${i + 1}): received a ${modelScorePct}% uncalibrated model score from the trained Random Forest ensemble.`,
      note: isDemo
        ? "Sample benchmark profile for illustration. Scores are uncalibrated Random Forest class score averages on benchmark data, not verified field measurements."
        : "Uncalibrated Random Forest class score average on the benchmark training dataset — not a calibrated field probability or yield guarantee.",
      dataUsed: [
        `Nitrogen (${features.N} kg/ha)`,
        `Phosphorus (${features.P} kg/ha)`,
        `Potassium (${features.K} kg/ha)`,
        `Soil pH (${features.ph})`,
        `Temperature (${features.temperature}°C)`,
        `Humidity (${features.humidity}%)`,
        `Seasonal rainfall (${features.rainfall} mm)`,
      ],
      dataMissing: [],
      limitations: [
        "Model scores are uncalibrated ensemble class score averages on a benchmark dataset, not calibrated probabilities or guaranteed field yield.",
        "Physical soil type, land area, and budget are not features of the 7-parameter ML model.",
      ],
      economicNote: "Cultivation cost and profit are not modeled by the Random Forest classifier.",
    };
  });
}

/**
 * Executes the genuine 200-tree Random Forest model using the exported artifact.
 * Uses ONLY the 7 features the model was trained on.
 * Never passes soil type, land area, or budget to the model.
 * Returns null if features are incomplete or the model fails.
 */
export function generateMlPrediction(features: MlPredictionFeatures): Recommendation[] | null {
  if (!areMlFeaturesComplete(features) || !localModelAvailable) {
    return null;
  }

  const result = predictWithLocalForest(features as unknown as Record<string, number>);
  if (!result || !result.ranked || result.ranked.length === 0) {
    return null;
  }

  return formatMlPredictionRecommendations(features, result.ranked, {
    modelName: "Random Forest (200 trees)",
    treeCount: result.treeCount,
  });
}

/**
 * Agronomic rule database for all 22 benchmark crop classes.
 * Grounded in documented soil, irrigation, and climate requirements from agricultural extension guides.
 */
interface CropAgronomicRule {
  cropId: string;
  displayName: string;
  category: "Cereal" | "Pulse" | "Fruit" | "Fibre & Commercial" | "Plantation";
  durationDays: number;
  waterMin: number;
  waterMax: number;
  waterRequirement: string;
  tempMin: number;
  tempMax: number;
  floodTolerant: boolean;
  droughtTolerant: boolean;
  soilScores: Record<SoilType, number>;
  soilReasons: Record<SoilType, string>;
}

const CROP_AGRONOMIC_RULES: CropAgronomicRule[] = [
  {
    cropId: "rice",
    displayName: "Rice (Paddy)",
    category: "Cereal",
    durationDays: 130,
    waterMin: 1100,
    waterMax: 1400,
    waterRequirement: "High (1100–1400 mm)",
    tempMin: 20,
    tempMax: 38,
    floodTolerant: true,
    droughtTolerant: false,
    soilScores: { Clay: 1.0, "Clay Loam": 1.0, Silty: 0.85, Loamy: 0.6, Sandy: 0.1 },
    soilReasons: {
      Clay: "Heavy clay provides high water retention and minimal percolation needed for puddling.",
      "Clay Loam": "Clay loam retains standing water layer while providing steady nutrient supply.",
      Silty: "Silty alluvial soils support lowland paddy with adequate irrigation.",
      Loamy: "Loamy soil requires higher irrigation frequency to maintain standing water.",
      Sandy: "Sandy soils suffer extreme water percolation loss, making paddy irrigation unviable.",
    },
  },
  {
    cropId: "maize",
    displayName: "Maize (Corn)",
    category: "Cereal",
    durationDays: 100,
    waterMin: 500,
    waterMax: 650,
    waterRequirement: "Medium (500–650 mm)",
    tempMin: 18,
    tempMax: 35,
    floodTolerant: false,
    droughtTolerant: false,
    soilScores: { Loamy: 1.0, "Clay Loam": 0.9, Silty: 0.85, Sandy: 0.65, Clay: 0.5 },
    soilReasons: {
      Loamy: "Deep, well-drained loam provides ideal root penetration and moisture balance.",
      "Clay Loam": "Clay loam offers strong plant anchorage and high cation exchange capacity.",
      Silty: "Silt loam supports healthy early seedling vigor and steady vegetative growth.",
      Sandy: "Sandy loam warms rapidly in spring but requires careful split fertilization.",
      Clay: "Heavy clay is prone to waterlogging which maize roots cannot tolerate.",
    },
  },
  {
    cropId: "chickpea",
    displayName: "Chickpea (Bengal Gram / Chana)",
    category: "Pulse",
    durationDays: 105,
    waterMin: 250,
    waterMax: 350,
    waterRequirement: "Low (250–350 mm)",
    tempMin: 15,
    tempMax: 30,
    floodTolerant: false,
    droughtTolerant: true,
    soilScores: { "Clay Loam": 1.0, Clay: 0.9, Silty: 0.9, Loamy: 0.85, Sandy: 0.4 },
    soilReasons: {
      "Clay Loam": "Clay loam retains residual moisture through winter rabi maturity.",
      Clay: "Deep black cotton soils preserve moisture required for rainfed chickpea.",
      Silty: "Silt loam provides fine tilth and steady root nodulation.",
      Loamy: "Well-drained loam supports productive branching and pod set.",
      Sandy: "Sandy soil dries too rapidly for rabi chickpea without constant irrigation.",
    },
  },
  {
    cropId: "pigeonpeas",
    displayName: "Pigeonpea (Red Gram / Arhar / Tur)",
    category: "Pulse",
    durationDays: 160,
    waterMin: 500,
    waterMax: 650,
    waterRequirement: "Medium (500–650 mm)",
    tempMin: 20,
    tempMax: 35,
    floodTolerant: false,
    droughtTolerant: true,
    soilScores: { Loamy: 1.0, "Clay Loam": 0.9, Silty: 0.8, Clay: 0.6, Sandy: 0.5 },
    soilReasons: {
      Loamy: "Deep loam allows deep taproot development to access subsoil moisture.",
      "Clay Loam": "Clay loam provides sturdy plant anchoring and sustained moisture.",
      Silty: "Silty loam supports good vegetative growth if surface drainage is maintained.",
      Clay: "Clay requires good surface drainage; water stagnation causes phytophthora blight.",
      Sandy: "Sandy loam acceptable, but needs steady moisture during pod development.",
    },
  },
  {
    cropId: "blackgram",
    displayName: "Blackgram (Urad Bean)",
    category: "Pulse",
    durationDays: 80,
    waterMin: 300,
    waterMax: 400,
    waterRequirement: "Low (300–400 mm)",
    tempMin: 22,
    tempMax: 35,
    floodTolerant: false,
    droughtTolerant: true,
    soilScores: { "Clay Loam": 1.0, Loamy: 0.95, Silty: 0.85, Clay: 0.85, Sandy: 0.55 },
    soilReasons: {
      "Clay Loam": "Heavy clay loam provides the moisture retentivity preferred by blackgram.",
      Loamy: "Fertile loam promotes rapid canopy cover and uniform pod maturation.",
      Clay: "Retentive clay soils sustain blackgram well in both kharif and rabi seasons.",
      Silty: "Silt loam promotes uniform germination and healthy root nodule formation.",
      Sandy: "Sandy soils lose moisture too rapidly, reducing pod count per plant.",
    },
  },
  {
    cropId: "mungbean",
    displayName: "Mungbean (Green Gram / Moong)",
    category: "Pulse",
    durationDays: 70,
    waterMin: 250,
    waterMax: 350,
    waterRequirement: "Low (250–350 mm)",
    tempMin: 24,
    tempMax: 38,
    floodTolerant: false,
    droughtTolerant: true,
    soilScores: { Loamy: 0.95, Sandy: 0.85, "Clay Loam": 0.8, Silty: 0.75, Clay: 0.45 },
    soilReasons: {
      Loamy: "Well-drained loam supports fast 60–70 day catch-crop turnaround.",
      Sandy: "Warm sandy loam allows rapid emergence and early pod set.",
      "Clay Loam": "Clay loam supports good growth if soil is well-aerated.",
      Silty: "Silt loam supports uniform flowering; avoid water stagnation.",
      Clay: "Heavy clay risks water stagnation, leading to yellow mosaic vulnerability.",
    },
  },
  {
    cropId: "mothbeans",
    displayName: "Mothbean (Matki)",
    category: "Pulse",
    durationDays: 80,
    waterMin: 200,
    waterMax: 300,
    waterRequirement: "Very Low (200–300 mm)",
    tempMin: 25,
    tempMax: 42,
    floodTolerant: false,
    droughtTolerant: true,
    soilScores: { Sandy: 1.0, Loamy: 0.7, Silty: 0.3, "Clay Loam": 0.2, Clay: 0.1 },
    soilReasons: {
      Sandy:
        "Light sandy soils provide natural drainage where mothbean thrives under arid conditions.",
      Loamy: "Loamy soil acceptable under strict moisture-restricted cultivation.",
      Silty: "Silt soil holds too much moisture, inducing excessive vegetative growth and rotting.",
      "Clay Loam": "Clay loam is too heavy and poorly drained for dryland mothbean roots.",
      Clay: "Heavy clay causes severe root rot and crop failure in mothbean.",
    },
  },
  {
    cropId: "lentil",
    displayName: "Lentil (Masoor)",
    category: "Pulse",
    durationDays: 120,
    waterMin: 200,
    waterMax: 300,
    waterRequirement: "Low (200–300 mm)",
    tempMin: 14,
    tempMax: 28,
    floodTolerant: false,
    droughtTolerant: true,
    soilScores: { "Clay Loam": 1.0, Loamy: 0.9, Silty: 0.85, Clay: 0.8, Sandy: 0.4 },
    soilReasons: {
      "Clay Loam": "Clay loam provides steady residual winter moisture for rabi lentil.",
      Loamy: "Fertile loam provides balanced structure and healthy root nodulation.",
      Silty: "Silt loam gives good seedbed tilth and moisture retention.",
      Clay: "Clay soils support lentil provided surface drainage prevents waterlogging.",
      Sandy: "Sandy soils suffer rapid drought stress during reproductive flowering.",
    },
  },
  {
    cropId: "kidneybeans",
    displayName: "Kidney Beans (Rajmash)",
    category: "Pulse",
    durationDays: 100,
    waterMin: 400,
    waterMax: 500,
    waterRequirement: "Medium (400–500 mm)",
    tempMin: 15,
    tempMax: 26,
    floodTolerant: false,
    droughtTolerant: false,
    soilScores: { Silty: 1.0, "Clay Loam": 0.95, Loamy: 0.9, Clay: 0.6, Sandy: 0.3 },
    soilReasons: {
      Silty: "Deep, fertile silt loam is the premier substrate for rajmash root systems.",
      "Clay Loam": "Rich clay loam supports high pod load and grain weight.",
      Loamy: "Loamy soil provides balanced aeration and moisture holding.",
      Clay: "Heavy clay is prone to water stagnation which damages shallow roots.",
      Sandy: "Sandy soils lack the nutrient retention required by heavy-feeding rajmash.",
    },
  },
  {
    cropId: "cotton",
    displayName: "Cotton (Kapas)",
    category: "Fibre & Commercial",
    durationDays: 160,
    waterMin: 600,
    waterMax: 800,
    waterRequirement: "Medium to High (600–800 mm)",
    tempMin: 22,
    tempMax: 38,
    floodTolerant: false,
    droughtTolerant: false,
    soilScores: { Clay: 1.0, "Clay Loam": 1.0, Loamy: 0.85, Silty: 0.75, Sandy: 0.2 },
    soilReasons: {
      Clay: "Deep black cotton soils (Vertisols) retain moisture through the long boll opening stage.",
      "Clay Loam": "Clay loam vertisols provide ideal moisture preservation and root support.",
      Loamy: "Deep alluvium and fertile loam support vigorous sympodial branching.",
      Silty: "Silt loam supports good plant height; ensure drainage during monsoon.",
      Sandy: "Sandy soils cannot retain the deep moisture needed across a 160-day cycle.",
    },
  },
  {
    cropId: "jute",
    displayName: "Jute (Pat / Golden Fibre)",
    category: "Fibre & Commercial",
    durationDays: 130,
    waterMin: 1000,
    waterMax: 1200,
    waterRequirement: "High (1000–1200 mm)",
    tempMin: 24,
    tempMax: 37,
    floodTolerant: true,
    droughtTolerant: false,
    soilScores: { Silty: 1.0, "Clay Loam": 0.9, Clay: 0.8, Loamy: 0.75, Sandy: 0.15 },
    soilReasons: {
      Silty:
        "Deep alluvial floodplains and deltaic silts provide the ideal golden fibre substrate.",
      "Clay Loam": "Rich clay loam supports tall vegetative stalk growth and retting quality.",
      Clay: "Clay soils hold moisture well; capsularis jute tolerates standing water.",
      Loamy: "Loamy alluvium supports good fibre yield with regular irrigation.",
      Sandy: "Sandy soils dry out rapidly and fail to support the required stem elongation.",
    },
  },
  {
    cropId: "coconut",
    displayName: "Coconut (Kalpavriksha)",
    category: "Plantation",
    durationDays: 365,
    waterMin: 1200,
    waterMax: 1800,
    waterRequirement: "High (1200–1800 mm)",
    tempMin: 22,
    tempMax: 35,
    floodTolerant: false,
    droughtTolerant: false,
    soilScores: { Sandy: 0.85, Loamy: 0.85, Silty: 0.7, "Clay Loam": 0.6, Clay: 0.25 },
    soilReasons: {
      Sandy: "Coastal sandy and red sandy loams allow deep rooting and necessary aeration.",
      Loamy: "Deep alluvial loam supports healthy frond development and steady nut yield.",
      Silty: "Alluvial deltaic silt supports coastal plantations if water table is 1–2m.",
      "Clay Loam": "Clay loam acceptable if subsurface drainage is active.",
      Clay: "Heavy, compacted clay impedes root respiration and palm growth.",
    },
  },
  {
    cropId: "coffee",
    displayName: "Coffee (Arabica & Robusta)",
    category: "Plantation",
    durationDays: 240,
    waterMin: 1500,
    waterMax: 2000,
    waterRequirement: "High (1500–2000 mm)",
    tempMin: 15,
    tempMax: 28,
    floodTolerant: false,
    droughtTolerant: false,
    soilScores: { Loamy: 0.9, "Clay Loam": 0.7, Silty: 0.5, Sandy: 0.2, Clay: 0.2 },
    soilReasons: {
      Loamy: "Deep, porous forest loam rich in organic humus provides ideal hillside drainage.",
      "Clay Loam": "Clay loam acceptable on sloped terrain with natural drainage.",
      Silty: "Silt soil requires good humus to avoid compaction.",
      Sandy: "Sandy soil lacks the organic humus and moisture buffer coffee demands.",
      Clay: "Heavy waterlogged clay leads to root rot and poor bean quality.",
    },
  },
  {
    cropId: "apple",
    displayName: "Apple",
    category: "Fruit",
    durationDays: 180,
    waterMin: 750,
    waterMax: 1000,
    waterRequirement: "Medium (750–1000 mm)",
    tempMin: 10,
    tempMax: 24,
    floodTolerant: false,
    droughtTolerant: false,
    soilScores: { Loamy: 0.85, "Clay Loam": 0.7, Silty: 0.6, Sandy: 0.2, Clay: 0.2 },
    soilReasons: {
      Loamy: "Deep, rich, well-drained loams (minimum 1.5m depth) suit temperate orchard roots.",
      "Clay Loam": "Clay loam provides moisture retention on temperate hill terraces.",
      Silty: "Silt loam acceptable in temperate valleys with subsoil drainage.",
      Sandy: "Sandy soils fail to buffer moisture and tree root anchorage.",
      Clay: "Heavy clay results in water stagnation and root asphyxiation.",
    },
  },
  {
    cropId: "banana",
    displayName: "Banana",
    category: "Fruit",
    durationDays: 330,
    waterMin: 1500,
    waterMax: 2000,
    waterRequirement: "High (1500–2000 mm)",
    tempMin: 20,
    tempMax: 38,
    floodTolerant: false,
    droughtTolerant: false,
    soilScores: { Loamy: 0.95, "Clay Loam": 0.8, Silty: 0.8, Clay: 0.5, Sandy: 0.35 },
    soilReasons: {
      Loamy: "Deep, fertile loam rich in organic matter supports rapid pseudostem development.",
      "Clay Loam": "Clay loam supports heavy bunch weights if drainage ditches are maintained.",
      Silty: "River valley silt provides high nutrient availability for rapid growth.",
      Clay: "Heavy clay requires active drainage; water stagnation causes panama wilt spread.",
      Sandy: "Sandy soil leaches applied nutrients too rapidly for this heavy feeder.",
    },
  },
  {
    cropId: "grapes",
    displayName: "Grapes",
    category: "Fruit",
    durationDays: 140,
    waterMin: 500,
    waterMax: 700,
    waterRequirement: "Medium (500–700 mm)",
    tempMin: 15,
    tempMax: 38,
    floodTolerant: false,
    droughtTolerant: false,
    soilScores: { Loamy: 0.9, "Clay Loam": 0.9, Sandy: 0.7, Silty: 0.65, Clay: 0.4 },
    soilReasons: {
      Loamy: "Deep, well-drained loam supports productive vine root systems.",
      "Clay Loam": "Clay loam offers steady moisture buffer through berry sizing.",
      Sandy: "Sandy loam warms early and prevents salinity accumulation.",
      Silty: "Silt soil acceptable with careful drip irrigation management.",
      Clay: "Heavy clay risks salinity build-up and poor subsoil aeration.",
    },
  },
  {
    cropId: "mango",
    displayName: "Mango",
    category: "Fruit",
    durationDays: 150,
    waterMin: 700,
    waterMax: 900,
    waterRequirement: "Medium (700–900 mm)",
    tempMin: 22,
    tempMax: 40,
    floodTolerant: false,
    droughtTolerant: true,
    soilScores: { Loamy: 0.95, "Clay Loam": 0.85, Silty: 0.8, Clay: 0.5, Sandy: 0.4 },
    soilReasons: {
      Loamy: "Deep alluvial and red loam (minimum 2m depth) permits deep taproot anchorage.",
      "Clay Loam": "Clay loam provides good moisture hold through fruit development.",
      Silty: "Alluvial silts in river basins promote vigorous canopy spread.",
      Clay: "Medium black clay acceptable if no hardpan exists within 2 meters.",
      Sandy: "Sandy soil requires frequent irrigation during juvenile establishment.",
    },
  },
  {
    cropId: "muskmelon",
    displayName: "Muskmelon (Cantaloupe / Kharbooza)",
    category: "Fruit",
    durationDays: 85,
    waterMin: 350,
    waterMax: 450,
    waterRequirement: "Low to Medium (350–450 mm)",
    tempMin: 24,
    tempMax: 40,
    floodTolerant: false,
    droughtTolerant: true,
    soilScores: { Sandy: 0.95, Loamy: 0.8, Silty: 0.55, "Clay Loam": 0.4, Clay: 0.2 },
    soilReasons: {
      Sandy:
        "Warm sandy loam and riverbed soils promote rapid vine warming and high sugar content.",
      Loamy: "Well-drained loam supports vigorous vine foliage and high fruit yield.",
      Silty: "Silt soils require raised beds to keep developing melons off wet ground.",
      "Clay Loam": "Clay loam is heavy and slow to warm up in spring, increasing fungal risk.",
      Clay: "Heavy clay results in fruit belly rot and vine dieback.",
    },
  },
  {
    cropId: "orange",
    displayName: "Orange (Mandarin / Nagpur Santra)",
    category: "Fruit",
    durationDays: 240,
    waterMin: 900,
    waterMax: 1200,
    waterRequirement: "High (900–1200 mm)",
    tempMin: 18,
    tempMax: 35,
    floodTolerant: false,
    droughtTolerant: false,
    soilScores: { Loamy: 0.9, "Clay Loam": 0.8, Silty: 0.7, Clay: 0.5, Sandy: 0.5 },
    soilReasons: {
      Loamy: "Deep, well-drained loam with porous subsoil supports healthy feeder roots.",
      "Clay Loam": "Medium black clay loam vertisols of central India support quality santra.",
      Silty: "Alluvial silt supports vigorous growth provided subsoil drains freely.",
      Clay: "Clay soils require active drainage to avoid collar rot (Phytophthora).",
      Sandy: "Sandy loam acceptable with steady drip irrigation and organic mulching.",
    },
  },
  {
    cropId: "papaya",
    displayName: "Papaya",
    category: "Fruit",
    durationDays: 270,
    waterMin: 1200,
    waterMax: 1500,
    waterRequirement: "High (1200–1500 mm)",
    tempMin: 22,
    tempMax: 38,
    floodTolerant: false,
    droughtTolerant: false,
    soilScores: { Loamy: 0.9, Sandy: 0.75, "Clay Loam": 0.6, Silty: 0.6, Clay: 0.1 },
    soilReasons: {
      Loamy: "Rich, well-drained loam supports rapid upright growth and early fruit set.",
      Sandy:
        "Sandy loam provides rapid drainage, which is the single most critical factor for papaya.",
      "Clay Loam": "Clay loam acceptable on raised beds; standing water is fatal.",
      Silty: "Silt soil requires raised mounds to keep roots free of water saturation.",
      Clay: "Heavy clay causes fatal foot rot and collar rot within 24–48 hours of waterlogging.",
    },
  },
  {
    cropId: "pomegranate",
    displayName: "Pomegranate (Anar)",
    category: "Fruit",
    durationDays: 160,
    waterMin: 500,
    waterMax: 700,
    waterRequirement: "Medium (500–700 mm)",
    tempMin: 20,
    tempMax: 40,
    floodTolerant: false,
    droughtTolerant: true,
    soilScores: { Loamy: 0.9, Sandy: 0.8, "Clay Loam": 0.8, Silty: 0.65, Clay: 0.5 },
    soilReasons: {
      Loamy: "Light, deep, well-drained loamy soils support heavy fruiting and fruit coloration.",
      Sandy: "Sandy loam provides excellent aeration and tolerates dry hot climates.",
      "Clay Loam": "Clay loam supports high fruit size; ensure subsoil drains freely.",
      Silty: "Silt loam acceptable with controlled irrigation cycles.",
      Clay: "Heavy clay requires active drainage; water stagnation encourages bacterial blight.",
    },
  },
  {
    cropId: "watermelon",
    displayName: "Watermelon (Tarbooz)",
    category: "Fruit",
    durationDays: 95,
    waterMin: 400,
    waterMax: 500,
    waterRequirement: "Medium (400–500 mm)",
    tempMin: 24,
    tempMax: 38,
    floodTolerant: false,
    droughtTolerant: true,
    soilScores: { Sandy: 0.95, Loamy: 0.8, Silty: 0.6, "Clay Loam": 0.4, Clay: 0.2 },
    soilReasons: {
      Sandy:
        "Deep sandy loams and riverbeds provide the quick drainage and warm root zone vines need.",
      Loamy: "Rich loam produces high yields and large fruit sizes with good drainage.",
      Silty: "Silt soil requires raised beds to prevent fruit rot in wet furrows.",
      "Clay Loam": "Clay loam is heavy and slow to drain, increasing soil-borne disease.",
      Clay: "Heavy clay leads to poor aeration, vine decay, and fruit cracking.",
    },
  },
];

export interface AgronomicCropAssessment {
  cropId: string;
  displayName: string;
  category: "Cereal" | "Pulse" | "Fruit" | "Fibre & Commercial" | "Plantation";
  durationDays: number;
  waterRequirement: string;
  soilScore: number;
  soilReason: string;
  waterScore: number;
  waterExplanation: string;
  tempScore: number;
  tempExplanation: string;
  preferredMatch: boolean;
  compositeScore: number;
}

/**
 * Evaluates agronomic suitability across all 22 canonical benchmark crops for a given FarmInput.
 * Shared by both pure Rule-Based planning and the Constraint-Aware Hybrid Ranking Engine.
 */
export function evaluateAllAgronomicCrops(input: FarmInput): AgronomicCropAssessment[] {
  if (!input || input.landArea <= 0 || input.water < 0) {
    return [];
  }

  const soilType = input.soilType || "Loamy";
  const waterUnits = Number(input.water) || 0;
  const preferredClean = (input.preferredCrop || "").trim().toLowerCase();

  return CROP_AGRONOMIC_RULES.map((rule) => {
    const guide = getCropCultivationGuide(rule.cropId);
    const soilScore = rule.soilScores[soilType] ?? 0.5;
    const soilReason =
      rule.soilReasons[soilType] || `${soilType} soil evaluated for ${rule.displayName}.`;

    let waterScore = 0.5;
    let waterExplanation = "";
    if (waterUnits >= rule.waterMin && waterUnits <= rule.waterMax * 1.3) {
      waterScore = 1.0;
      waterExplanation = `Water availability (${waterUnits} units) is an optimal match for ${rule.displayName}'s requirement (${rule.waterRequirement}).`;
    } else if (waterUnits < rule.waterMin) {
      const ratio = waterUnits / rule.waterMin;
      waterScore = Math.max(0.1, 0.1 + 0.9 * ratio);
      waterExplanation = `Water availability (${waterUnits} units) is lower than ${rule.displayName}'s standard requirement (${rule.waterRequirement}); supplemental irrigation needed.`;
    } else {
      if (rule.floodTolerant) {
        waterScore = 1.0;
        waterExplanation = `Ample water (${waterUnits} units) supports high water-demanding ${rule.displayName}.`;
      } else {
        const excess = (waterUnits - rule.waterMax) / rule.waterMax;
        if (rule.droughtTolerant) {
          waterScore = Math.max(0.15, 1.0 - excess * 0.7);
          waterExplanation = `Water availability (${waterUnits} units) is high; ${rule.displayName} prefers drier conditions and is vulnerable to root stagnation.`;
        } else {
          waterScore = Math.max(0.4, 1.0 - excess * 0.4);
          waterExplanation = `Water availability (${waterUnits} units) exceeds normal requirements (${rule.waterRequirement}); proper field drainage advised.`;
        }
      }
    }

    let tempScore = 1.0;
    let tempExplanation =
      "Weather conditions were not provided; ranking evaluated on soil and water constraints.";
    const hasWeather = input.weather?.temperature != null;
    if (hasWeather) {
      const temp = input.weather!.temperature!;
      if (temp >= rule.tempMin && temp <= rule.tempMax) {
        tempScore = 1.0;
        tempExplanation = `Current ambient temperature (${temp}°C) is within ${rule.displayName}'s suitable range (${rule.tempMin}–${rule.tempMax}°C).`;
      } else if (temp < rule.tempMin) {
        const diff = rule.tempMin - temp;
        tempScore = Math.max(0.15, 1.0 - diff * 0.12);
        tempExplanation = `Ambient temperature (${temp}°C) is cooler than optimal (${rule.tempMin}–${rule.tempMax}°C).`;
      } else {
        const diff = temp - rule.tempMax;
        tempScore = Math.max(0.15, 1.0 - diff * 0.12);
        tempExplanation = `Ambient temperature (${temp}°C) is warmer than optimal (${rule.tempMin}–${rule.tempMax}°C).`;
      }
    }

    let preferredBoost = 0;
    let preferredMatch = false;
    if (preferredClean) {
      if (
        rule.cropId.includes(preferredClean) ||
        rule.displayName.toLowerCase().includes(preferredClean) ||
        (guide?.displayName || "").toLowerCase().includes(preferredClean)
      ) {
        preferredMatch = true;
        if (soilScore >= 0.5 && waterScore >= 0.35) {
          preferredBoost = 0.25;
        }
      }
    }

    const compositeScore = hasWeather
      ? soilScore * 0.45 + waterScore * 0.4 + tempScore * 0.15 + preferredBoost
      : soilScore * 0.55 + waterScore * 0.45 + preferredBoost;

    return {
      cropId: rule.cropId,
      displayName: rule.displayName,
      category: rule.category,
      durationDays: rule.durationDays,
      waterRequirement: rule.waterRequirement,
      soilScore,
      soilReason,
      waterScore,
      waterExplanation,
      tempScore,
      tempExplanation,
      preferredMatch,
      compositeScore,
    };
  });
}

/**
 * Generates transparent agronomic rule-based crop recommendations for general farm planning.
 * Grounded in documented crop soil, water, climate, and duration requirements.
 * Does NOT require NPK or pH measurements.
 * Explains factors used, missing information, and economic limitations.
 */
export function generateGeneralPlanningRecommendations(input: FarmInput): Recommendation[] {
  const scoredCrops = evaluateAllAgronomicCrops(input);
  if (scoredCrops.length === 0) {
    return [];
  }

  const soilType = input.soilType || "Loamy";
  const waterUnits = Number(input.water) || 0;
  const budget = Number(input.budget) || 0;
  const landArea = Number(input.landArea) || 1;
  const budgetPerAcre = Math.round(budget / Math.max(0.1, landArea));

  // Filter candidates that meet baseline agronomic viability
  const viable = scoredCrops
    .filter((c) => c.soilScore >= 0.35 && c.waterScore >= 0.25 && c.compositeScore >= 0.45)
    .sort((a, b) =>
      b.compositeScore !== a.compositeScore
        ? b.compositeScore - a.compositeScore
        : a.cropId.localeCompare(b.cropId),
    );

  if (viable.length === 0) {
    return [];
  }

  // Select top 3 to 5 candidate crops
  const topCandidates = viable.slice(0, Math.min(5, Math.max(3, viable.length)));

  return topCandidates.map((c, idx) => {
    const isTop = idx === 0;
    const matchPct = Math.min(99, Math.round(c.compositeScore * 100));

    // Data used and missing breakdown
    const dataUsed: string[] = [
      `Soil texture: ${soilType}`,
      `Water availability: ${waterUnits} units`,
      `Land area: ${landArea} acres`,
      `Planned budget: ₹${budget.toLocaleString("en-IN")}`,
    ];
    if (input.weather?.temperature != null) {
      dataUsed.push(`Current temperature: ${input.weather.temperature}°C`);
    }
    if (input.weather?.humidity != null) {
      dataUsed.push(`Current humidity: ${input.weather.humidity}%`);
    }

    const dataMissing: string[] = [
      "Soil laboratory test measurements (Nitrogen, Phosphorus, Potassium, and pH)",
      "Audited local crop cultivation cost per acre",
    ];
    if (input.weather?.temperature == null) {
      dataMissing.push("Seasonal weather and rainfall forecast");
    }

    const matchingFactors: string[] = [c.soilReason, c.waterExplanation, c.tempExplanation];
    if (c.preferredMatch) {
      matchingFactors.push(`Matches your preferred crop request for '${input.preferredCrop}'.`);
    }

    const limitations: string[] = [
      "Official cultivation cost per acre is unverified (economic cost benchmarks are not in the agronomic catalog).",
      `Laboratory NPK/pH not tested (evaluated based on physical soil texture class '${soilType}').`,
    ];
    if (input.weather?.temperature == null) {
      limitations.push("Current weather and seasonal rainfall observations were not provided.");
    }

    const categoryOrientation =
      c.category === "Cereal" || c.category === "Pulse"
        ? "Field crop: Lower upfront working capital typically required compared to perennial orchards."
        : c.category === "Fibre & Commercial"
          ? "Commercial crop: Moderate working capital required for inputs and harvest labor."
          : "Perennial / Plantation: Higher multi-year establishment capital with extended gestation period.";

    const economicNote = `Budget allocation: ₹${budget.toLocaleString("en-IN")} across ${landArea} acres (approx. ₹${budgetPerAcre.toLocaleString("en-IN")}/acre). ${categoryOrientation} Note: Audited official cost benchmarks per acre are not documented in the agronomic catalog; financial feasibility cannot be certified without local input market pricing for seed, fertilizer, and labor.`;

    const rationale = isTop
      ? `Primary farm-plan recommendation: Ranked #1 based on agronomic matching (${matchPct}% compatibility). ${c.soilReason} ${c.waterExplanation} Growth cycle: ${c.durationDays} days.${c.preferredMatch ? ` Matches your preferred crop request ('${input.preferredCrop}').` : ""}`
      : `Alternative candidate (#${idx + 1}): ${c.displayName} (${c.category}) shows ${matchPct}% compatibility with ${soilType} soil and ${waterUnits} units water availability. Growth cycle: ${c.durationDays} days.`;

    return {
      crop: c.displayName,
      canonicalCropId: c.cropId,
      overallRank: idx + 1,
      ruleRank: idx + 1,
      source: "RULE-BASED",
      confidence: matchPct,
      voteSharePct: null, // Never fabricate ML tree votes for rule-based planning
      suitabilityScore: matchPct,
      waterNeed: c.waterRequirement,
      growthDurationDays: c.durationDays,
      expectedYield: null,
      estimatedProfit: null,
      modelName: "AgriSmart Agronomic Rule Engine (ICAR Cultivation Catalog)",
      treeCount: null,
      rationale,
      note: "Agronomic rule-based ranking grounded in documented soil, irrigation, and duration requirements. Does not use laboratory ML inference.",
      matchingFactors,
      limitations,
      economicNote,
      dataUsed,
      dataMissing,
    };
  });
}

/**
 * Main planning simulation function.
 * If verified laboratory ML features are complete, runs genuine Random Forest model.
 * If laboratory features are not provided, runs the rule-based agronomic farm planning engine.
 */
export function generatePlanningSimulation(input: FarmInput): Recommendation[] {
  // If user provided complete ML features in the planning input, run the genuine model
  if (input.mlFeatures && areMlFeaturesComplete(input.mlFeatures)) {
    const mlRecs = generateMlPrediction(input.mlFeatures);
    if (mlRecs && mlRecs.length > 0) {
      return mlRecs;
    }
  }

  // Otherwise, run the general farm planning recommendations
  return generateGeneralPlanningRecommendations(input);
}

// Deprecated alias for backwards compatibility
export const generateRecommendations = generatePlanningSimulation;

const HISTORY_KEY = "agrismart.history";
const AUTH_KEY = "agrismart.user";
const DEMO_PROFILES_KEY = "agrismart.demoProfiles";
const ACTIVE_FARM_KEY = "agrismart.activeFarmId";
const ACTIVE_PLAN_KEY = "agrismart.activePlan";

export interface LinkedSoilReportSummary {
  id: string;
  laboratory: string;
  sampleId: string;
  testDate: string;
  verified: boolean;
  loadedKeys: (keyof MlPredictionFeatures)[];
}

export interface ActivePlanState {
  input: FarmInput;
  labFeatures?: Partial<MlPredictionFeatures> | undefined;
  isDemoProfile?: boolean | undefined;
  linkedSoilReport?: LinkedSoilReportSummary | undefined;
  submittedAt: string;
}

export const ML_FEATURE_META: ReadonlyArray<{
  key: keyof MlPredictionFeatures;
  label: string;
  unit: string;
  min: number;
  max: number;
}> = [
  { key: "N", label: "Nitrogen (N)", unit: "kg/ha", min: 0, max: 300 },
  { key: "P", label: "Phosphorus (P)", unit: "kg/ha", min: 0, max: 300 },
  { key: "K", label: "Potassium (K)", unit: "kg/ha", min: 0, max: 300 },
  { key: "ph", label: "Soil pH", unit: "", min: 0, max: 14 },
  { key: "temperature", label: "Temperature", unit: "°C", min: -20, max: 60 },
  { key: "humidity", label: "Humidity", unit: "%", min: 0, max: 100 },
  { key: "rainfall", label: "Seasonal rainfall", unit: "mm", min: 0, max: 1000 },
];

export function getMissingMlFeatureLabels(
  features: Partial<MlPredictionFeatures> | null | undefined,
): string[] {
  return ML_FEATURE_META.filter((m) => {
    const val = features?.[m.key];
    return typeof val !== "number" || Number.isNaN(val) || !Number.isFinite(val);
  }).map((m) => m.label);
}

export function getOutOfRangeMlFeatureLabels(
  features: Partial<MlPredictionFeatures> | null | undefined,
): string[] {
  if (!features) return [];
  return ML_FEATURE_META.filter((m) => {
    const val = features[m.key];
    return typeof val === "number" && Number.isFinite(val) && (val < m.min || val > m.max);
  }).map((m) => `${m.label} (${m.min}–${m.max}${m.unit ? ` ${m.unit}` : ""})`);
}

export interface ComparedCropItem {
  crop: string;
  canonicalCropId?: string | undefined;
  overallRank?: number | null | undefined;
  source: RecommendationSource;
  guideSlug: string;
  confidencePct: number | null;
  ruleCompatibilityPct?: number | null | undefined;
  mlUncalibratedScorePct?: number | null | undefined;
  ruleRank?: number | null | undefined;
  mlRank?: number | null | undefined;
  agreementState?: CandidateAgreementState | null | undefined;
  hardConstraintTriggered?: boolean | undefined;
  hybridRationale?: string | null | undefined;
  suitability: string;
  soilSuitability: string | null;
  weatherSuitability: string | null;
  waterRequirement: string | null;
  growthDurationDays: number | null;
  complexity: string | null;
}

export function derivePlanComparisonCrops(args: {
  planInput: FarmInput;
  labFeatures?: Partial<MlPredictionFeatures> | undefined;
  mlPrediction?: CropPrediction | null | undefined;
  mlServiceError?: string | null | undefined;
  allowLocalForestFallback?: boolean | undefined;
  isDemoProfile?: boolean | undefined;
  mode: "hybrid" | "rule" | "ml";
}): ComparedCropItem[] {
  const { planInput, labFeatures, isDemoProfile = false, mode } = args;

  if (mode === "hybrid") {
    const hybrid = computeHybridRecommendations({
      planInput,
      mlFeatures: labFeatures,
      mlPrediction: args.mlPrediction,
      mlServiceError: args.mlServiceError,
      allowLocalForestFallback: args.allowLocalForestFallback ?? true,
      localForestPredict: (f) =>
        predictWithLocalForest(f as unknown as Record<string, number>)?.ranked ?? null,
      isDemoProfile,
    });

    return hybrid.rankedCandidates.map((cand) => {
      const rule = cand.ruleAssessment;
      const ml = cand.mlAssessment;
      let suitability = "Compatible";

      if (hybrid.hybridActive) {
        if (cand.agreementState === "strong_agreement" && rule?.rank != null && ml?.rank != null) {
          suitability = `Strong Consensus (Rule #${rule.rank} · ML #${ml.rank})`;
        } else if (
          cand.agreementState === "both_supporting" &&
          rule?.rank != null &&
          ml?.rank != null
        ) {
          suitability = `Dual Support (Rule #${rule.rank} · ML #${ml.rank})`;
        } else if (cand.agreementState === "ml_favored_agronomic_warning" && ml?.rank != null) {
          suitability = `Constraint Warning (ML #${ml.rank})`;
        } else if (cand.agreementState === "rule_favored" && rule?.rank != null) {
          suitability = `Agronomic Match (Rule #${rule.rank})`;
        } else if (ml?.rank != null) {
          suitability = `ML Candidate (ML #${ml.rank})`;
        }
      } else if (rule) {
        suitability =
          rule.compatibilityPct >= 80
            ? "High (Rule-Only)"
            : rule.compatibilityPct >= 60
              ? "Moderate (Rule-Only)"
              : "Compatible (Rule-Only)";
      }

      return {
        crop: cand.crop,
        canonicalCropId: cand.canonicalCropId,
        overallRank: cand.overallRank,
        source: cand.source,
        guideSlug: cand.guideSlug,
        confidencePct: rule?.compatibilityPct ?? ml?.uncalibratedScorePct ?? null,
        ruleCompatibilityPct: rule?.compatibilityPct ?? null,
        mlUncalibratedScorePct: ml?.available ? ml.uncalibratedScorePct : null,
        ruleRank: rule?.rank ?? null,
        mlRank: ml?.available ? ml.rank : null,
        agreementState: cand.agreementState,
        hardConstraintTriggered: cand.hardConstraintTriggered,
        hybridRationale: cand.hybridRationale,
        suitability,
        soilSuitability: rule
          ? `${rule.compatibilityPct}% rule compatibility (${planInput.soilType})`
          : `Physical soil not evaluated`,
        weatherSuitability:
          ml && ml.available && ml.uncalibratedScorePct !== null
            ? `${ml.uncalibratedScorePct}% uncalibrated ML score${isDemoProfile ? " (Demo)" : ""}`
            : hybrid.hybridActive
              ? "<1% uncalibrated ML score"
              : planInput.weather?.temperature != null
                ? `${planInput.weather.temperature}°C ambient (ML unavailable)`
                : null,
        waterRequirement: cand.waterRequirement,
        growthDurationDays: cand.growthDurationDays,
        complexity: cand.category,
      };
    });
  }

  const mapRec = (rec: Recommendation, soilType: SoilType): ComparedCropItem => {
    const guide = getCropCultivationGuide(rec.crop);
    const guideSlug = getCropGuideSlug(rec.crop);
    const isMl = rec.source === "ML MODEL" || rec.source === "DEMO / ILLUSTRATIVE";
    const pct = isMl ? (rec.voteSharePct ?? rec.confidence ?? null) : (rec.confidence ?? null);

    let suitability = "Compatible";
    if (pct !== null) {
      if (isMl) {
        suitability =
          rec.source === "DEMO / ILLUSTRATIVE"
            ? `${pct}% Uncalibrated Score (Demo)`
            : `${pct}% Uncalibrated Model Score`;
      } else {
        suitability = pct >= 80 ? "High" : pct >= 60 ? "Moderate" : "Compatible";
      }
    }

    return {
      crop: rec.crop,
      canonicalCropId: rec.canonicalCropId,
      overallRank: rec.overallRank ?? null,
      source: rec.source,
      guideSlug,
      confidencePct: pct,
      ruleCompatibilityPct: isMl ? null : pct,
      mlUncalibratedScorePct: isMl ? pct : null,
      ruleRank: rec.ruleRank ?? null,
      mlRank: rec.mlRank ?? null,
      suitability,
      soilSuitability: isMl
        ? rec.source === "DEMO / ILLUSTRATIVE"
          ? "Benchmark NPK & pH (Demo)"
          : "Evaluated via lab N, P, K & pH"
        : `Compatible with ${soilType}`,
      weatherSuitability: isMl
        ? "Evaluated via temp, humidity & seasonal rain"
        : planInput.weather?.temperature != null
          ? `${planInput.weather.temperature}°C ambient context`
          : null,
      waterRequirement: rec.waterNeed ?? guide?.waterRequirement ?? null,
      growthDurationDays: rec.growthDurationDays ?? guide?.durationDays ?? null,
      complexity: guide?.category ?? null,
    };
  };

  if (mode === "ml") {
    if (!areMlFeaturesComplete(labFeatures)) return [];
    let raw: Recommendation[] | null = null;
    if (args.mlPrediction && args.mlPrediction.ranked?.length > 0) {
      raw = formatMlPredictionRecommendations(labFeatures, args.mlPrediction.ranked, {
        modelName: args.mlPrediction.model ?? "Random Forest (200 trees)",
        treeCount: args.mlPrediction.treeCount ?? 200,
        isDemoProfile,
      });
    } else if (args.allowLocalForestFallback !== false && !args.mlServiceError) {
      const localRecs = generateMlPrediction(labFeatures);
      raw =
        localRecs && isDemoProfile
          ? localRecs.map((r) => ({ ...r, source: "DEMO / ILLUSTRATIVE" as const }))
          : localRecs;
    }
    if (!raw) return [];
    return raw.map((r) => mapRec(r, planInput.soilType));
  }

  const ruleRecs = generateGeneralPlanningRecommendations(planInput);
  return ruleRecs.map((r) => mapRec(r, planInput.soilType));
}

/**
 * Extracts only verified, numerically valid soil measurements (N, P, K, pH)
 * from a soil report and optional ambient temperature/humidity readings.
 *
 * Strict integrity guarantees:
 * - Never substitutes 0 or synthetic defaults for untested/null parameters.
 * - Never carries over stale nutrient values from previous/demo profiles for untested report fields.
 * - Never treats hourly weather precipitation (rainfallMm) as seasonal cumulative ML rainfall.
 */
export function extractMlFeaturesFromSoilParameters(
  parameters: ReadonlyArray<{
    key: string;
    status: "available" | "not_tested" | "not_available";
    value: number | null;
  }>,
  ambientWeather?: {
    temperatureC?: number | null | undefined;
    humidityPct?: number | null | undefined;
  } | null,
  existingNonDemoFeatures?: Partial<MlPredictionFeatures> | null,
): {
  features: Partial<MlPredictionFeatures>;
  soilKeysLoaded: (keyof MlPredictionFeatures)[];
  weatherKeysLoaded: (keyof MlPredictionFeatures)[];
} {
  const features: Partial<MlPredictionFeatures> = {};
  const soilKeysLoaded: (keyof MlPredictionFeatures)[] = [];
  const weatherKeysLoaded: (keyof MlPredictionFeatures)[] = [];

  const keyMap: Record<string, keyof MlPredictionFeatures> = {
    n: "N",
    nitrogen: "N",
    p: "P",
    phosphorus: "P",
    k: "K",
    potassium: "K",
    ph: "ph",
  };

  for (const param of parameters) {
    const mapped = keyMap[param.key.toLowerCase()];
    if (mapped && param.status === "available" && isValidMlFeatureValue(mapped, param.value)) {
      features[mapped] = param.value;
      if (!soilKeysLoaded.includes(mapped)) {
        soilKeysLoaded.push(mapped);
      }
    }
  }

  // Include legitimate ambient temperature & humidity when valid; otherwise preserve user-entered values
  if (isValidMlFeatureValue("temperature", ambientWeather?.temperatureC)) {
    features.temperature = ambientWeather.temperatureC;
    weatherKeysLoaded.push("temperature");
  } else if (isValidMlFeatureValue("temperature", existingNonDemoFeatures?.temperature)) {
    features.temperature = existingNonDemoFeatures.temperature;
  }

  if (isValidMlFeatureValue("humidity", ambientWeather?.humidityPct)) {
    features.humidity = ambientWeather.humidityPct;
    weatherKeysLoaded.push("humidity");
  } else if (isValidMlFeatureValue("humidity", existingNonDemoFeatures?.humidity)) {
    features.humidity = existingNonDemoFeatures.humidity;
  }

  // Preserve seasonal rainfall ONLY if the user explicitly supplied a valid non-demo value
  if (isValidMlFeatureValue("rainfall", existingNonDemoFeatures?.rainfall)) {
    features.rainfall = existingNonDemoFeatures.rainfall;
  }

  return { features, soilKeysLoaded, weatherKeysLoaded };
}

/**
 * Builds and persists an ActivePlanState incorporating a selected soil report's
 * verified measurements while preserving the farmer's active farm plan settings.
 */
export function buildActivePlanFromSoilReport(args: {
  report: {
    id: string;
    laboratory: string;
    sampleId: string;
    testDate: string;
    verified: boolean;
    parameters: ReadonlyArray<{
      key: string;
      status: "available" | "not_tested" | "not_available";
      value: number | null;
    }>;
  };
  existingPlan?: ActivePlanState | null | undefined;
  fallbackFarm?: {
    name?: string | null | undefined;
    landAreaAcres?: number | null | undefined;
    currentCrop?: string | null | undefined;
  } | null;
  ambientWeather?: {
    temperatureC?: number | null | undefined;
    humidityPct?: number | null | undefined;
    rainfallMm?: number | null | undefined;
  } | null;
}): ActivePlanState {
  const { report, existingPlan, fallbackFarm, ambientWeather } = args;
  const preservedFeatures =
    existingPlan && !existingPlan.isDemoProfile ? existingPlan.labFeatures : null;

  const { features, soilKeysLoaded } = extractMlFeaturesFromSoilParameters(
    report.parameters,
    ambientWeather,
    preservedFeatures,
  );

  const baseInput: FarmInput = existingPlan?.input
    ? {
        ...existingPlan.input,
        ...(ambientWeather
          ? {
              weather: {
                temperature: ambientWeather.temperatureC ?? existingPlan.input.weather?.temperature,
                humidity: ambientWeather.humidityPct ?? existingPlan.input.weather?.humidity,
              },
            }
          : existingPlan.input.weather
            ? {
                weather: {
                  temperature: existingPlan.input.weather.temperature,
                  humidity: existingPlan.input.weather.humidity,
                },
              }
            : {}),
      }
    : {
        name: fallbackFarm?.name || "Active Farm Plan",
        landArea: fallbackFarm?.landAreaAcres || 5,
        water: 600,
        soilType: "Loamy",
        budget: 50000,
        preferredCrop: fallbackFarm?.currentCrop || "",
        notes: "",
        weather: ambientWeather
          ? {
              temperature: ambientWeather.temperatureC,
              humidity: ambientWeather.humidityPct,
            }
          : undefined,
      };

  return {
    input: {
      ...baseInput,
      mlFeatures: Object.keys(features).length > 0 ? features : undefined,
    },
    labFeatures: Object.keys(features).length > 0 ? features : undefined,
    isDemoProfile: false,
    linkedSoilReport: {
      id: report.id,
      laboratory: report.laboratory,
      sampleId: report.sampleId,
      testDate: report.testDate,
      verified: report.verified,
      loadedKeys: soilKeysLoaded,
    },
    submittedAt: new Date().toISOString(),
  };
}

export interface ActivePlanDerivedSummary {
  planInput: FarmInput;
  labFeatures: Partial<MlPredictionFeatures>;
  isDemoProfile: boolean;
  linkedSoilReport: LinkedSoilReportSummary | null;
  ruleRecs: Recommendation[];
  mlComplete: boolean;
  mlRecs: Recommendation[] | null;
  hybridResult: HybridRecommendationResult;
  primaryEngine: "hybrid" | "demo-hybrid" | "ml" | "demo-ml" | "rule";
  primaryRecs: Recommendation[];
  availableMlLabels: string[];
  missingMlLabels: string[];
  outOfRangeMlLabels: string[];
  completenessPct: number;
}

/**
 * Shared active-plan derivation used across `/dashboard`, `/recommendations`, and
 * `/recommendations/compare` so all surfaces show consistent recommendations and
 * missing-input status for the same farm plan.
 *
 * Never substitutes hourly weather precipitation (`rainfallMm`) for seasonal rainfall.
 * Never claims `"hybrid"` when only one source contributed.
 */
export function deriveActivePlanSummary(args: {
  activePlan?: ActivePlanState | null | undefined;
  farm?: {
    name?: string | null | undefined;
    landAreaAcres?: number | null | undefined;
    currentCrop?: string | null | undefined;
  } | null;
  weather?: {
    temperatureC?: number | null | undefined;
    humidityPct?: number | null | undefined;
    rainfallMm?: number | null | undefined;
  } | null;
  soil?: {
    hasReport: boolean;
    parameters: ReadonlyArray<{
      key: string;
      status: "available" | "not_tested" | "not_available";
      value: number | null;
    }>;
  } | null;
  mlPrediction?: CropPrediction | null | undefined;
  mlServiceError?: string | null | undefined;
  allowLocalForestFallback?: boolean | undefined;
  hybridConfig?: Partial<HybridRankingConfig> | undefined;
}): ActivePlanDerivedSummary {
  const { activePlan, farm, weather, soil } = args;

  const planInput: FarmInput = activePlan?.input
    ? {
        ...activePlan.input,
        weather:
          activePlan.input.weather || weather
            ? {
                temperature: activePlan.input.weather?.temperature ?? weather?.temperatureC,
                humidity: activePlan.input.weather?.humidity ?? weather?.humidityPct,
              }
            : undefined,
      }
    : {
        name: farm?.name || "Active Farm Plan",
        landArea: farm?.landAreaAcres || 5,
        water: 600,
        soilType: "Loamy",
        budget: 50000,
        preferredCrop: farm?.currentCrop || "",
        notes: "",
        weather: weather
          ? {
              temperature: weather.temperatureC,
              humidity: weather.humidityPct,
            }
          : undefined,
      };

  const labFeatures: Partial<MlPredictionFeatures> = activePlan
    ? (activePlan.labFeatures ?? {})
    : soil?.hasReport && soil.parameters.length > 0
      ? extractMlFeaturesFromSoilParameters(soil.parameters, weather ?? null, null).features
      : {};

  const isDemoProfile = Boolean(activePlan?.isDemoProfile);
  const linkedSoilReport = !isDemoProfile ? (activePlan?.linkedSoilReport ?? null) : null;

  const ruleRecs = generateGeneralPlanningRecommendations(planInput);
  const mlComplete = areMlFeaturesComplete(labFeatures);

  let mlRecs: Recommendation[] | null = null;
  if (mlComplete) {
    if (args.mlPrediction && args.mlPrediction.ranked?.length > 0) {
      mlRecs = formatMlPredictionRecommendations(labFeatures, args.mlPrediction.ranked, {
        modelName: args.mlPrediction.model ?? "Random Forest (200 trees)",
        treeCount: args.mlPrediction.treeCount ?? 200,
        isDemoProfile,
      });
    } else if (args.allowLocalForestFallback !== false && !args.mlServiceError) {
      const rawMl = generateMlPrediction(labFeatures);
      mlRecs = rawMl
        ? isDemoProfile
          ? rawMl.map((r) => ({
              ...r,
              source: "DEMO / ILLUSTRATIVE" as const,
              note: "Sample benchmark profile for illustration. Scores are uncalibrated Random Forest class score averages on benchmark data, not verified field measurements.",
            }))
          : rawMl
        : null;
    }
  }

  const hybridResult = computeHybridRecommendations({
    planInput,
    mlFeatures: labFeatures,
    mlPrediction: args.mlPrediction,
    mlServiceError: args.mlServiceError,
    allowLocalForestFallback: args.allowLocalForestFallback ?? true,
    localForestPredict: (f) =>
      predictWithLocalForest(f as unknown as Record<string, number>)?.ranked ?? null,
    isDemoProfile,
    config: args.hybridConfig,
  });

  const primaryEngine: "hybrid" | "demo-hybrid" | "ml" | "demo-ml" | "rule" =
    hybridResult.hybridActive
      ? isDemoProfile
        ? "demo-hybrid"
        : "hybrid"
      : hybridResult.mode === "ml-only"
        ? isDemoProfile
          ? "demo-ml"
          : "ml"
        : "rule";

  const primaryRecs =
    hybridResult.recommendations.length > 0 ? hybridResult.recommendations : ruleRecs;

  const availableMlLabels = ML_FEATURE_META.filter((m) =>
    isValidMlFeatureValue(m.key, labFeatures[m.key]),
  ).map((m) => `${m.label}: ${labFeatures[m.key]}${m.unit ? ` ${m.unit}` : ""}`);
  const missingMlLabels = getMissingMlFeatureLabels(labFeatures);
  const outOfRangeMlLabels = getOutOfRangeMlFeatureLabels(labFeatures);
  const completenessPct = Math.round((availableMlLabels.length / ML_FEATURE_META.length) * 100);

  return {
    planInput,
    labFeatures,
    isDemoProfile,
    linkedSoilReport,
    ruleRecs,
    mlComplete,
    mlRecs,
    hybridResult,
    primaryEngine,
    primaryRecs,
    availableMlLabels,
    missingMlLabels,
    outOfRangeMlLabels,
    completenessPct,
  };
}

function sanitizeActivePlanWeather(plan: ActivePlanState): ActivePlanState {
  if (!plan.input?.weather) return plan;
  return {
    ...plan,
    input: {
      ...plan.input,
      weather: {
        temperature: plan.input.weather.temperature,
        humidity: plan.input.weather.humidity,
      },
    },
  };
}

export function saveActivePlan(plan: ActivePlanState): void {
  if (typeof window === "undefined") return;
  const clean = sanitizeActivePlanWeather(plan);
  window.localStorage.setItem(ACTIVE_PLAN_KEY, JSON.stringify(clean));
  window.dispatchEvent(new Event("agrismart:activePlan"));
}

export function loadActivePlan(): ActivePlanState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_PLAN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActivePlanState;
    return parsed && typeof parsed === "object" ? sanitizeActivePlanWeather(parsed) : null;
  } catch {
    return null;
  }
}

export function clearActivePlan(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACTIVE_PLAN_KEY);
  window.dispatchEvent(new Event("agrismart:activePlan"));
}

export type AuthSessionMode = "backend" | "demo";

export interface UserSession {
  id?: string | undefined;
  email: string;
  fullName?: string | undefined;
  phoneNumber?: string | null | undefined;
  authMode?: AuthSessionMode | undefined;
}

export interface DemoProfileRecord {
  email: string;
  fullName: string;
  phoneNumber?: string | null | undefined;
}

/**
 * True only when the session represents a real backend user record (UUID)
 * and not an unauthenticated local demo preview session.
 */
export function isBackendUserSession(user: UserSession | null | undefined): boolean {
  if (!user || !user.id) return false;
  if (user.authMode === "demo") return false;
  if (user.id.startsWith("demo-")) return false;
  return true;
}

export function saveDemoProfile(profile: DemoProfileRecord): void {
  if (typeof window === "undefined") return;
  const cleanEmail = profile.email.trim().toLowerCase();
  if (!cleanEmail) return;
  try {
    const current = JSON.parse(
      window.localStorage.getItem(DEMO_PROFILES_KEY) ?? "[]",
    ) as DemoProfileRecord[];
    const filtered = current.filter((p) => p.email.toLowerCase() !== cleanEmail);
    const next: DemoProfileRecord[] = [
      {
        email: profile.email.trim(),
        fullName: profile.fullName.trim() || "Demo Farmer",
        phoneNumber: profile.phoneNumber ?? null,
      },
      ...filtered,
    ].slice(0, 20);
    window.localStorage.setItem(DEMO_PROFILES_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors in restricted browsing contexts
  }
}

export function findDemoProfile(email: string): DemoProfileRecord | null {
  if (typeof window === "undefined") return null;
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return null;
  try {
    const current = JSON.parse(
      window.localStorage.getItem(DEMO_PROFILES_KEY) ?? "[]",
    ) as DemoProfileRecord[];
    return current.find((p) => p.email.toLowerCase() === cleanEmail) ?? null;
  } catch {
    return null;
  }
}

export function getUserOwnerKey(user?: UserSession | null | undefined): string | null {
  if (!user) return null;
  if (user.id && user.id.trim().length > 0) return `id:${user.id.trim()}`;
  if (user.email && user.email.trim().length > 0) {
    return `email:${user.email.trim().toLowerCase()}`;
  }
  return null;
}

function doesUserOwnHistoryEntry(
  entry: HistoryEntry,
  user: UserSession | null | undefined,
): boolean {
  if (!entry.ownerKey || entry.ownerKey.trim().length === 0) {
    return true;
  }
  if (!user) return false;
  const candidateKeys = new Set<string>();
  if (user.id && user.id.trim().length > 0) {
    candidateKeys.add(user.id.trim());
    candidateKeys.add(`id:${user.id.trim()}`);
  }
  if (user.email && user.email.trim().length > 0) {
    const cleanEmail = user.email.trim().toLowerCase();
    candidateKeys.add(cleanEmail);
    candidateKeys.add(`email:${cleanEmail}`);
  }
  return candidateKeys.has(entry.ownerKey);
}

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveHistoryEntry(
  entry: HistoryEntry,
  currentUser?: UserSession | null | undefined,
) {
  if (typeof window === "undefined") return;
  const resolvedUser = currentUser !== undefined ? currentUser : loadUser();
  const ownerKey = entry.ownerKey !== undefined ? entry.ownerKey : getUserOwnerKey(resolvedUser);
  const enriched: HistoryEntry = {
    ...entry,
    ...(ownerKey ? { ownerKey } : {}),
  };
  const next = [enriched, ...loadHistory()].slice(0, 50);
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("agrismart:history"));
}

export interface DeleteHistoryResult {
  ok: boolean;
  error?: string | undefined;
  remaining: HistoryEntry[];
}

/**
 * Deletes a single history record by ID while preserving all remaining records
 * in their exact existing order. Verifies record existence, ownership (when
 * `ownerKey` is recorded on the entry), and storage write completion before
 * reporting success or dispatching UI sync events.
 */
export function deleteHistoryRecord(
  id: string,
  currentUser?: UserSession | null | undefined,
): DeleteHistoryResult {
  if (typeof window === "undefined") {
    return {
      ok: false,
      error: "Browser history storage is unavailable in this environment.",
      remaining: [],
    };
  }
  const cleanId = typeof id === "string" ? id.trim() : "";
  if (!cleanId) {
    return {
      ok: false,
      error: "Invalid history record identifier.",
      remaining: loadHistory(),
    };
  }

  let current: HistoryEntry[];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      return {
        ok: false,
        error: "Stored history records could not be parsed safely.",
        remaining: [],
      };
    }
    current = parsed as HistoryEntry[];
  } catch {
    return {
      ok: false,
      error: "Failed to read history records from local storage.",
      remaining: [],
    };
  }

  const target = current.find((e) => e.id === cleanId);
  if (!target) {
    return {
      ok: false,
      error: "History record was not found or has already been deleted.",
      remaining: current,
    };
  }

  const resolvedUser = currentUser !== undefined ? currentUser : loadUser();
  if (!doesUserOwnHistoryEntry(target, resolvedUser)) {
    return {
      ok: false,
      error: "Cannot delete this history record because it belongs to a different user session.",
      remaining: current,
    };
  }

  const next = current.filter((e) => e.id !== cleanId);

  try {
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error && err.message
          ? `Could not update local storage: ${err.message}`
          : "Could not save updated history to local storage.",
      remaining: current,
    };
  }

  window.dispatchEvent(new Event("agrismart:history"));
  return { ok: true, remaining: next };
}

export function deleteHistoryEntry(id: string): boolean {
  return deleteHistoryRecord(id).ok;
}

export function clearAllHistory(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(HISTORY_KEY);
  window.dispatchEvent(new Event("agrismart:history"));
}

export function loadUser(): UserSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = JSON.parse(window.localStorage.getItem(AUTH_KEY) ?? "null") as UserSession | null;
    if (!raw || typeof raw !== "object" || !raw.email) return null;
    // Sanitize legacy stored objects so no extraneous fields (e.g. password) are ever retained
    const sanitized: UserSession = {
      email: raw.email,
      ...(raw.id && !raw.id.startsWith("demo-") ? { id: raw.id } : {}),
      ...(raw.fullName ? { fullName: raw.fullName } : {}),
      ...(raw.phoneNumber !== undefined ? { phoneNumber: raw.phoneNumber } : {}),
      authMode: raw.authMode ?? (raw.id && !raw.id.startsWith("demo-") ? "backend" : "demo"),
    };
    return sanitized;
  } catch {
    return null;
  }
}

export function setUser(user: UserSession | null) {
  if (typeof window === "undefined") return;
  if (user) {
    // Explicitly persist ONLY safe profile/session metadata — never passwords
    const safeSession: UserSession = {
      email: user.email.trim(),
      ...(user.id && user.authMode !== "demo" && !user.id.startsWith("demo-")
        ? { id: user.id }
        : {}),
      ...(user.fullName ? { fullName: user.fullName.trim() } : {}),
      ...(user.phoneNumber !== undefined ? { phoneNumber: user.phoneNumber } : {}),
      authMode: user.authMode ?? (user.id && !user.id.startsWith("demo-") ? "backend" : "demo"),
    };
    window.localStorage.setItem(AUTH_KEY, JSON.stringify(safeSession));
  } else {
    window.localStorage.removeItem(AUTH_KEY);
  }
  window.dispatchEvent(new Event("agrismart:auth"));
}

export function getActiveFarmId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_FARM_KEY);
}

export function setActiveFarmId(farmId: string | null) {
  if (typeof window === "undefined") return;
  if (farmId) {
    window.localStorage.setItem(ACTIVE_FARM_KEY, farmId);
  } else {
    window.localStorage.removeItem(ACTIVE_FARM_KEY);
  }
  window.dispatchEvent(new Event("agrismart:activeFarm"));
}

import { ALL_ML_CROPS, getCropCultivationGuide, getCropGuideSlug } from "@/data/crop-cultivation";
import type { CropPrediction } from "@/services/types";
import {
  areMlFeaturesComplete,
  evaluateAllAgronomicCrops,
  getMissingMlFeatureLabels,
  getOutOfRangeMlFeatureLabels,
  isValidMlFeatureValue,
  ML_FEATURE_META,
  type AgronomicCropAssessment,
  type FarmInput,
  type MlPredictionFeatures,
  type Recommendation,
  type RecommendationSource,
  type SoilType,
} from "./agri";

/**
 * Canonical crop resolution:
 * Resolves any crop identifier, common alias, or display name (e.g. "Rice (Paddy)", "rice",
 * "paddy", "Pigeonpea (Red Gram / Arhar / Tur)") to one of the 22 canonical benchmark IDs.
 */
export function resolveCanonicalCropId(cropNameOrId: string): string | null {
  if (!cropNameOrId || typeof cropNameOrId !== "string") return null;
  const guide = getCropCultivationGuide(cropNameOrId);
  if (guide && ALL_ML_CROPS.includes(guide.crop)) {
    return guide.crop;
  }
  const clean = cropNameOrId.trim().toLowerCase();
  if (ALL_ML_CROPS.includes(clean)) {
    return clean;
  }
  return null;
}

export function getCanonicalCropDisplayName(canonicalId: string, fallback?: string): string {
  const guide = getCropCultivationGuide(canonicalId);
  if (guide?.displayName) return guide.displayName;
  if (fallback && fallback.trim().length > 0) return fallback.trim();
  return canonicalId.charAt(0).toUpperCase() + canonicalId.slice(1);
}

/**
 * Configurable parameters for Constraint-Aware Reciprocal Rank Fusion (CA-RRF).
 *
 * Why ordinal Reciprocal Rank Fusion instead of linear score averaging?
 * - Rule-based suitability (`compositeScore`, displayed as 0–99% agronomic compatibility)
 *   is a deterministic weighted heuristic over soil texture, water availability, and ambient
 *   temperature.
 * - Random Forest ML scores (`probability` in [0, 1], displayed as 0–100% uncalibrated model
 *   score) are mean terminal-leaf class distributions across 200 trees on a 22-class benchmark
 *   dataset. They have NOT undergone Platt or isotonic probability calibration.
 * - Averaging these two incompatible numerical scales would conflate heuristic compatibility
 *   with uncalibrated tree-ensemble concentration and produce a misleading synthetic percentage.
 * - Ordinal Reciprocal Rank Fusion combines each candidate's rank position `r` (`1 / (k + r)`)
 *   from each active source, while enforcing hard physical soil/water constraints explicitly so
 *   severely unsuitable crops (e.g., flooded paddy on sandy soil or dryland mothbean on heavy
 *   clay) are demoted below agronomically viable candidates with a transparent warning.
 */
export interface HybridRankingConfig {
  /** RRF smoothing constant k > 0 (standard default: 10 for 22-crop candidate sets). */
  rrfK: number;
  /** Relative ordinal weight assigned to the Rule-Based agronomic rank (default: 0.45). */
  ruleWeight: number;
  /** Relative ordinal weight assigned to the ML Random Forest rank (default: 0.55). */
  mlWeight: number;
  /** Minimum soil texture compatibility before a hard soil constraint is flagged (default: 0.35). */
  minViableSoilScore: number;
  /** Minimum water compatibility before a hard water constraint is flagged (default: 0.25). */
  minViableWaterScore: number;
  /** Minimum composite agronomic score before a candidate is considered rule-viable (default: 0.45). */
  minViableCompositeScore: number;
  /** Minimum positive uncalibrated ML score to include an ML candidate (default: 0.01). */
  minMlCandidateScore: number;
  /** Maximum number of ranked recommendations returned (default: 5). */
  maxResults: number;
}

export const DEFAULT_HYBRID_RANKING_CONFIG: Readonly<HybridRankingConfig> = {
  rrfK: 10,
  ruleWeight: 0.45,
  mlWeight: 0.55,
  minViableSoilScore: 0.35,
  minViableWaterScore: 0.25,
  minViableCompositeScore: 0.45,
  minMlCandidateScore: 0.01,
  maxResults: 5,
};

export type HybridEngineMode = "hybrid" | "demo-hybrid" | "rule-only" | "ml-only" | "none";

export type MlSourceStatus =
  | "active"
  | "demo_active"
  | "missing_inputs"
  | "invalid_inputs"
  | "service_error"
  | "not_requested";

export type CandidateAgreementState =
  | "strong_agreement"
  | "both_supporting"
  | "rule_favored"
  | "ml_favored_agronomic_warning"
  | "ml_favored_untested_rules"
  | "rule_only"
  | "ml_only";

export interface CandidateRuleAssessment {
  available: boolean;
  viable: boolean;
  rank: number | null;
  compatibilityPct: number;
  soilScore: number;
  waterScore: number;
  tempScore: number;
  soilReason: string;
  waterExplanation: string;
  tempExplanation: string;
  hardConstraints: string[];
}

export interface CandidateMlAssessment {
  available: boolean;
  rank: number | null;
  uncalibratedScore: number | null;
  uncalibratedScorePct: number | null;
  runtime: "fastapi" | "exported-forest" | "local-forest" | null;
  isDemo: boolean;
}

export interface HybridCropCandidate {
  overallRank: number;
  canonicalCropId: string;
  crop: string;
  guideSlug: string;
  source: RecommendationSource;
  /** Ordinal CA-RRF fusion index normalized to [0, 1] against theoretical top-1 consensus. */
  fusionIndex: number;
  hardConstraintTriggered: boolean;
  agreementState: CandidateAgreementState;
  ruleAssessment: CandidateRuleAssessment | null;
  mlAssessment: CandidateMlAssessment | null;
  hybridRationale: string;
  whyThisCrop: string;
  waterRequirement: string | null;
  growthDurationDays: number | null;
  category: string | null;
  matchingFactors: string[];
  limitations: string[];
  economicNote: string | null;
}

export interface HybridRecommendationResult {
  mode: HybridEngineMode;
  hybridActive: boolean;
  sourcesUsed: Array<"RULE-BASED" | "ML MODEL" | "DEMO / ILLUSTRATIVE">;
  mlStatus: MlSourceStatus;
  mlStatusMessage: string;
  mlRuntime: "fastapi" | "exported-forest" | "local-forest" | null;
  isDemoProfile: boolean;
  configUsed: HybridRankingConfig;
  methodologyName: string;
  methodologySummary: string;
  methodologyLimitations: string[];
  rankedCandidates: HybridCropCandidate[];
  recommendations: Recommendation[];
  informationUsed: string[];
  informationNeeded: string[];
  missingMlLabels: string[];
  outOfRangeMlLabels: string[];
  completenessPct: number;
}

export interface RawMlCandidateInput {
  crop: string;
  probability: number;
}

function normalizeConfig(overrides?: Partial<HybridRankingConfig>): HybridRankingConfig {
  const raw = { ...DEFAULT_HYBRID_RANKING_CONFIG, ...(overrides ?? {}) };
  const rrfK =
    Number.isFinite(raw.rrfK) && raw.rrfK > 0 ? raw.rrfK : DEFAULT_HYBRID_RANKING_CONFIG.rrfK;
  const ruleWeight =
    Number.isFinite(raw.ruleWeight) && raw.ruleWeight >= 0
      ? raw.ruleWeight
      : DEFAULT_HYBRID_RANKING_CONFIG.ruleWeight;
  const mlWeight =
    Number.isFinite(raw.mlWeight) && raw.mlWeight >= 0
      ? raw.mlWeight
      : DEFAULT_HYBRID_RANKING_CONFIG.mlWeight;
  const weightSum = ruleWeight + mlWeight;
  return {
    ...raw,
    rrfK,
    ruleWeight: weightSum > 0 ? ruleWeight / weightSum : 0.45,
    mlWeight: weightSum > 0 ? mlWeight / weightSum : 0.55,
    maxResults: Math.max(1, Math.min(22, Math.floor(raw.maxResults || 5))),
  };
}

/**
 * Deduplicates ML crop candidates by canonical crop ID, keeping the highest valid finite
 * uncalibrated score in [0, 1] when duplicate aliases (e.g. "rice" and "Rice (Paddy)") appear,
 * and sorts deterministically by descending score then ascending canonical crop ID.
 */
export function normalizeMlCandidates(
  rawCandidates: ReadonlyArray<RawMlCandidateInput> | null | undefined,
  minScore: number,
): Array<{ canonicalId: string; probability: number; rank: number }> {
  if (!rawCandidates || rawCandidates.length === 0) return [];

  const deduped = new Map<string, number>();
  for (const item of rawCandidates) {
    if (!item || typeof item.crop !== "string") continue;
    if (typeof item.probability !== "number" || !Number.isFinite(item.probability)) continue;
    if (item.probability < minScore || item.probability <= 0 || item.probability > 1) continue;
    const canonicalId = resolveCanonicalCropId(item.crop);
    if (!canonicalId) continue;
    const existing = deduped.get(canonicalId);
    if (existing === undefined || item.probability > existing) {
      deduped.set(canonicalId, item.probability);
    }
  }

  const sorted = Array.from(deduped.entries())
    .map(([canonicalId, probability]) => ({ canonicalId, probability }))
    .sort((a, b) =>
      b.probability !== a.probability
        ? b.probability - a.probability
        : a.canonicalId.localeCompare(b.canonicalId),
    );

  return sorted.map((entry, idx) => ({
    ...entry,
    rank: idx + 1,
  }));
}

function buildHardConstraints(
  assessment: AgronomicCropAssessment,
  soilType: SoilType,
  waterUnits: number,
  cfg: HybridRankingConfig,
): string[] {
  const constraints: string[] = [];
  if (assessment.soilScore < cfg.minViableSoilScore) {
    constraints.push(
      `Hard soil constraint: ${assessment.displayName} has low physical soil compatibility (${Math.round(
        assessment.soilScore * 100,
      )}%) on ${soilType} soil. ${assessment.soilReason}`,
    );
  }
  if (assessment.waterScore < cfg.minViableWaterScore) {
    constraints.push(
      `Hard water constraint: Planned water (${waterUnits} units) is severely mismatched with ${assessment.displayName}'s requirement (${assessment.waterRequirement}).`,
    );
  }
  return constraints;
}

/**
 * Evaluates the hybrid crop recommendation ranking from:
 * 1) Farm plan inputs (`planInput`) evaluated by the Agronomic Rule Engine across all 22 crops.
 * 2) Verified 7-feature ML inputs (`mlFeatures`) and either live `/api/predict` output
 *    (`mlPrediction`) or local Random Forest fallback when requested, with explicit status
 *    tracking when ML inputs are missing, out of range, or when `/api/predict` fails.
 *
 * Guarantees:
 * - Never fabricates missing soil or seasonal rainfall measurements.
 * - Never claims `"HYBRID"` unless BOTH Rule-Based and ML sources genuinely contributed.
 * - Never averages Rule compatibility % with uncalibrated ML score %.
 */
export function computeHybridRecommendations(args: {
  planInput?: FarmInput | null | undefined;
  mlFeatures?: Partial<MlPredictionFeatures> | null | undefined;
  mlPrediction?: CropPrediction | null | undefined;
  mlServiceError?: string | null | undefined;
  allowLocalForestFallback?: boolean | undefined;
  localForestPredict?:
    ((features: MlPredictionFeatures) => RawMlCandidateInput[] | null) | undefined;
  isDemoProfile?: boolean | undefined;
  config?: Partial<HybridRankingConfig> | undefined;
}): HybridRecommendationResult {
  const cfg = normalizeConfig(args.config);
  const isDemoProfile = Boolean(args.isDemoProfile);
  const planInput = args.planInput ?? null;
  const mlFeatures = args.mlFeatures ?? planInput?.mlFeatures ?? null;

  const missingMlLabels = getMissingMlFeatureLabels(mlFeatures);
  const outOfRangeMlLabels = getOutOfRangeMlFeatureLabels(mlFeatures);
  const validFeatureMeta = ML_FEATURE_META.filter((m) =>
    isValidMlFeatureValue(m.key, mlFeatures?.[m.key]),
  );
  const completenessPct = Math.round((validFeatureMeta.length / ML_FEATURE_META.length) * 100);
  const mlInputsValid = areMlFeaturesComplete(mlFeatures);

  // 1. Evaluate Rule-Based Suitability across all 22 canonical crops
  const allRuleAssessments = planInput ? evaluateAllAgronomicCrops(planInput) : [];
  const ruleMap = new Map<string, AgronomicCropAssessment>();
  for (const r of allRuleAssessments) {
    ruleMap.set(r.cropId, r);
  }

  // Assign ordinal ranks among agronomically viable rule candidates
  const viableRuleSorted = allRuleAssessments
    .filter(
      (c) =>
        c.soilScore >= cfg.minViableSoilScore &&
        c.waterScore >= cfg.minViableWaterScore &&
        c.compositeScore >= cfg.minViableCompositeScore,
    )
    .sort((a, b) =>
      b.compositeScore !== a.compositeScore
        ? b.compositeScore - a.compositeScore
        : a.cropId.localeCompare(b.cropId),
    );
  const ruleRankByCrop = new Map<string, number>();
  viableRuleSorted.forEach((c, idx) => {
    ruleRankByCrop.set(c.cropId, idx + 1);
  });

  // 2. Resolve ML Source Status and Normalized Candidates
  let mlStatus: MlSourceStatus = "not_requested";
  let mlStatusMessage =
    "Laboratory soil and seasonal rainfall inputs have not been provided yet; showing Rule-Based agronomic recommendations.";
  let mlRuntime: "fastapi" | "exported-forest" | "local-forest" | null = null;
  let normalizedMl: Array<{ canonicalId: string; probability: number; rank: number }> = [];

  if (outOfRangeMlLabels.length > 0) {
    mlStatus = "invalid_inputs";
    mlStatusMessage = `ML predictions unavailable: out-of-range values (${outOfRangeMlLabels.join(", ")}). Showing Rule-Based recommendations only.`;
  } else if (!mlInputsValid) {
    mlStatus = "missing_inputs";
    mlStatusMessage =
      missingMlLabels.length === ML_FEATURE_META.length
        ? "ML predictions unavailable: all 7 verified soil & seasonal climate inputs are missing. Showing Rule-Based recommendations only."
        : `ML predictions unavailable: missing ${missingMlLabels.join(", ")}. Hourly precipitation is never substituted for seasonal rainfall. Showing Rule-Based recommendations only.`;
  } else if (args.mlServiceError && !args.mlPrediction) {
    if (args.allowLocalForestFallback && args.localForestPredict) {
      const fallbackRaw = args.localForestPredict(mlFeatures);
      normalizedMl = normalizeMlCandidates(fallbackRaw, cfg.minMlCandidateScore);
      if (normalizedMl.length > 0) {
        mlRuntime = "local-forest";
        mlStatus = isDemoProfile ? "demo_active" : "active";
        mlStatusMessage = `Prediction API reported "${args.mlServiceError}"; evaluated locally against the identical exported 200-tree Random Forest artifact.`;
      } else {
        mlStatus = "service_error";
        mlStatusMessage = `ML prediction service failed (${args.mlServiceError}). Showing Rule-Based recommendations only.`;
      }
    } else {
      mlStatus = "service_error";
      mlStatusMessage = `ML prediction service failed (${args.mlServiceError}). Showing Rule-Based recommendations only.`;
    }
  } else if (args.mlPrediction) {
    normalizedMl = normalizeMlCandidates(args.mlPrediction.ranked, cfg.minMlCandidateScore);
    if (normalizedMl.length > 0) {
      mlRuntime = args.mlPrediction.runtime;
      mlStatus = isDemoProfile ? "demo_active" : "active";
      mlStatusMessage = isDemoProfile
        ? "Sample benchmark profile active (illustrative demo inputs — not verified field measurements)."
        : `Random Forest ML predictions active via ${args.mlPrediction.runtime === "fastapi" ? "FastAPI scikit-learn service" : "/api/predict exported 200-tree forest"}.`;
    } else {
      mlStatus = "service_error";
      mlStatusMessage =
        "ML prediction service returned no valid ranked candidates. Showing Rule-Based recommendations only.";
    }
  } else if (args.allowLocalForestFallback !== false && args.localForestPredict) {
    const localRaw = args.localForestPredict(mlFeatures);
    normalizedMl = normalizeMlCandidates(localRaw, cfg.minMlCandidateScore);
    if (normalizedMl.length > 0) {
      mlRuntime = "local-forest";
      mlStatus = isDemoProfile ? "demo_active" : "active";
      mlStatusMessage = isDemoProfile
        ? "Sample benchmark profile active (illustrative demo inputs — not verified field measurements)."
        : "Random Forest ML predictions active (200-tree exported ensemble).";
    } else {
      mlStatus = "service_error";
      mlStatusMessage = "ML model evaluation returned no valid candidates.";
    }
  } else {
    mlStatus = "service_error";
    mlStatusMessage =
      "ML prediction response is pending or unavailable. Showing Rule-Based recommendations only.";
  }

  const mlByCrop = new Map<string, { probability: number; rank: number }>();
  for (const item of normalizedMl) {
    mlByCrop.set(item.canonicalId, { probability: item.probability, rank: item.rank });
  }

  const hasRuleContribution = viableRuleSorted.length > 0;
  const hasMlContribution = normalizedMl.length > 0;
  const hybridActive = hasRuleContribution && hasMlContribution;

  const mode: HybridEngineMode = hybridActive
    ? isDemoProfile
      ? "demo-hybrid"
      : "hybrid"
    : hasRuleContribution
      ? "rule-only"
      : hasMlContribution
        ? "ml-only"
        : "none";

  const sourcesUsed: Array<"RULE-BASED" | "ML MODEL" | "DEMO / ILLUSTRATIVE"> = [];
  if (hasRuleContribution) sourcesUsed.push("RULE-BASED");
  if (hasMlContribution) {
    sourcesUsed.push(isDemoProfile ? "DEMO / ILLUSTRATIVE" : "ML MODEL");
  }

  // 3. Collect candidate union by canonical crop ID (top viable rule candidates + valid ML candidates)
  const candidateIds = new Set<string>();
  for (const r of viableRuleSorted.slice(0, Math.max(cfg.maxResults, 6))) {
    candidateIds.add(r.cropId);
  }
  for (const m of normalizedMl) {
    candidateIds.add(m.canonicalId);
  }

  const soilType: SoilType = planInput?.soilType ?? "Loamy";
  const waterUnits = Number(planInput?.water ?? 0);
  const landArea = Number(planInput?.landArea ?? 0);
  const budget = Number(planInput?.budget ?? 0);
  const budgetPerAcre = landArea > 0 ? Math.round(budget / Math.max(0.1, landArea)) : 0;

  // Theoretical maximum RRF score when ranked #1 in all active sources
  const maxPossibleRrf = hybridActive
    ? (cfg.ruleWeight + cfg.mlWeight) / (cfg.rrfK + 1)
    : hasRuleContribution
      ? cfg.ruleWeight / (cfg.rrfK + 1)
      : cfg.mlWeight / (cfg.rrfK + 1);

  type ScoredCandidateInternal = {
    canonicalId: string;
    displayName: string;
    guideSlug: string;
    rawRrf: number;
    fusionIndex: number;
    hardConstraintTriggered: boolean;
    agreementState: CandidateAgreementState;
    ruleAssessment: CandidateRuleAssessment | null;
    mlAssessment: CandidateMlAssessment | null;
    ruleRaw: AgronomicCropAssessment | undefined;
  };

  const scoredInternal: ScoredCandidateInternal[] = [];

  for (const canonicalId of candidateIds) {
    const ruleRaw = ruleMap.get(canonicalId);
    const ruleRank = ruleRankByCrop.get(canonicalId) ?? null;
    const mlEntry = mlByCrop.get(canonicalId) ?? null;
    const displayName = getCanonicalCropDisplayName(canonicalId, ruleRaw?.displayName);
    const guideSlug = getCropGuideSlug(canonicalId);

    let hardConstraints: string[] = [];
    let ruleViable = false;
    let compatibilityPct = 0;

    if (ruleRaw && planInput) {
      hardConstraints = buildHardConstraints(ruleRaw, soilType, waterUnits, cfg);
      ruleViable = ruleRank !== null && hardConstraints.length === 0;
      compatibilityPct = Math.min(99, Math.round(ruleRaw.compositeScore * 100));
    }

    const hardConstraintTriggered = hardConstraints.length > 0;

    const ruleAssessment: CandidateRuleAssessment | null =
      ruleRaw && planInput
        ? {
            available: true,
            viable: ruleViable,
            rank: ruleRank,
            compatibilityPct,
            soilScore: ruleRaw.soilScore,
            waterScore: ruleRaw.waterScore,
            tempScore: ruleRaw.tempScore,
            soilReason: ruleRaw.soilReason,
            waterExplanation: ruleRaw.waterExplanation,
            tempExplanation: ruleRaw.tempExplanation,
            hardConstraints,
          }
        : null;

    const mlAssessment: CandidateMlAssessment | null = hasMlContribution
      ? {
          available: mlEntry !== null,
          rank: mlEntry?.rank ?? null,
          uncalibratedScore: mlEntry?.probability ?? null,
          uncalibratedScorePct: mlEntry !== null ? Math.round(mlEntry.probability * 100) : null,
          runtime: mlRuntime,
          isDemo: isDemoProfile,
        }
      : null;

    // Ordinal RRF calculation (never averages compatibilityPct and uncalibratedScorePct)
    let rawRrf = 0;
    if (hybridActive) {
      if (ruleRank !== null && !hardConstraintTriggered) {
        rawRrf += cfg.ruleWeight / (cfg.rrfK + ruleRank);
      }
      if (mlEntry !== null) {
        rawRrf += cfg.mlWeight / (cfg.rrfK + mlEntry.rank);
      }
    } else if (hasRuleContribution && ruleRank !== null) {
      rawRrf = cfg.ruleWeight / (cfg.rrfK + ruleRank);
    } else if (hasMlContribution && mlEntry !== null) {
      rawRrf = cfg.mlWeight / (cfg.rrfK + mlEntry.rank);
    }

    const fusionIndex =
      maxPossibleRrf > 0 ? Math.min(1, Number((rawRrf / maxPossibleRrf).toFixed(4))) : 0;

    let agreementState: CandidateAgreementState;
    if (!hybridActive) {
      agreementState = hasRuleContribution ? "rule_only" : "ml_only";
    } else if (hardConstraintTriggered && mlEntry !== null) {
      agreementState = "ml_favored_agronomic_warning";
    } else if (ruleRank !== null && mlEntry !== null) {
      if (ruleRank <= 2 && mlEntry.rank <= 2) {
        agreementState = "strong_agreement";
      } else {
        agreementState = "both_supporting";
      }
    } else if (ruleRank !== null && mlEntry === null) {
      agreementState = "rule_favored";
    } else {
      agreementState = "ml_favored_untested_rules";
    }

    scoredInternal.push({
      canonicalId,
      displayName,
      guideSlug,
      rawRrf,
      fusionIndex,
      hardConstraintTriggered,
      agreementState,
      ruleAssessment,
      mlAssessment,
      ruleRaw,
    });
  }

  // Deterministic tie-breaking:
  // 1) Non-hard-constrained candidates always rank above hard-constrained candidates
  // 2) Higher ordinal RRF score (`rawRrf`)
  // 3) Supported by BOTH sources before single-source candidates
  // 4) Better Rule-Based compatibility score (when available)
  // 5) Higher ML uncalibrated score (when available)
  // 6) Ascending canonical crop ID
  scoredInternal.sort((a, b) => {
    if (a.hardConstraintTriggered !== b.hardConstraintTriggered) {
      return a.hardConstraintTriggered ? 1 : -1;
    }
    const rrfDiff = b.rawRrf - a.rawRrf;
    if (Math.abs(rrfDiff) > 1e-12) return rrfDiff;

    const aBoth = a.ruleAssessment?.viable && a.mlAssessment?.available ? 1 : 0;
    const bBoth = b.ruleAssessment?.viable && b.mlAssessment?.available ? 1 : 0;
    if (bBoth !== aBoth) return bBoth - aBoth;

    const aRuleComp = a.ruleRaw?.compositeScore ?? -1;
    const bRuleComp = b.ruleRaw?.compositeScore ?? -1;
    if (Math.abs(bRuleComp - aRuleComp) > 1e-9) return bRuleComp - aRuleComp;

    const aMlScore = a.mlAssessment?.uncalibratedScore ?? -1;
    const bMlScore = b.mlAssessment?.uncalibratedScore ?? -1;
    if (Math.abs(bMlScore - aMlScore) > 1e-9) return bMlScore - aMlScore;

    return a.canonicalId.localeCompare(b.canonicalId);
  });

  const topSliced = scoredInternal.slice(0, cfg.maxResults);

  // Build information used & information still needed
  const informationUsed: string[] = [];
  const informationNeeded: string[] = [];

  if (planInput && hasRuleContribution) {
    informationUsed.push(`Soil texture (${soilType})`);
    informationUsed.push(`Water availability (${waterUnits} units)`);
    informationUsed.push(`Land area (${landArea} acres)`);
    informationUsed.push(`Planned budget (₹${budget.toLocaleString("en-IN")})`);
    if (planInput.preferredCrop?.trim()) {
      informationUsed.push(`Preferred crop (${planInput.preferredCrop.trim()})`);
    }
    if (planInput.weather?.temperature != null) {
      informationUsed.push(`Ambient temperature (${planInput.weather.temperature}°C)`);
    }
    if (planInput.weather?.humidity != null) {
      informationUsed.push(`Ambient humidity (${planInput.weather.humidity}%)`);
    }
  }

  for (const m of validFeatureMeta) {
    const val = mlFeatures?.[m.key];
    const tag = isDemoProfile ? " [demo benchmark]" : "";
    informationUsed.push(`${m.label} (${val}${m.unit ? ` ${m.unit}` : ""})${tag}`);
  }

  for (const missing of missingMlLabels) {
    informationNeeded.push(`${missing} (required for Random Forest ML inference)`);
  }
  for (const invalid of outOfRangeMlLabels) {
    informationNeeded.push(`Valid ${invalid} (current value is out of range)`);
  }
  if (!planInput || planInput.landArea <= 0) {
    informationNeeded.push(
      "Farm soil texture, land area, and water availability for agronomic checks",
    );
  }
  informationNeeded.push("Audited local cultivation cost per acre (not in benchmark catalog)");

  // Map final ranked candidates + backwards-compatible `Recommendation[]`
  const rankedCandidates: HybridCropCandidate[] = [];
  const recommendations: Recommendation[] = [];

  topSliced.forEach((item, idx) => {
    const overallRank = idx + 1;
    const guide = getCropCultivationGuide(item.canonicalId);
    const rule = item.ruleAssessment;
    const ml = item.mlAssessment;

    let candidateSource: RecommendationSource;
    if (hybridActive) {
      candidateSource = isDemoProfile ? "DEMO / ILLUSTRATIVE" : "HYBRID";
    } else if (hasRuleContribution) {
      candidateSource = "RULE-BASED";
    } else {
      candidateSource = isDemoProfile ? "DEMO / ILLUSTRATIVE" : "ML MODEL";
    }

    // Build transparent hybrid ranking explanation
    let hybridRationale = "";
    if (hybridActive) {
      if (item.agreementState === "strong_agreement" && rule && ml?.rank != null) {
        hybridRationale = `Strong cross-engine consensus (Overall #${overallRank}): Ranked #${rule.rank} by Agronomic Rules (${rule.compatibilityPct}% soil/water compatibility on ${soilType} soil) and #${ml.rank} by the 200-tree Random Forest (${ml.uncalibratedScorePct}% uncalibrated model score).`;
      } else if (item.agreementState === "both_supporting" && rule && ml?.rank != null) {
        hybridRationale = `Supported by both engines (Overall #${overallRank}): Agronomic Rules rank #${rule.rank} (${rule.compatibilityPct}% compatibility) combined via Reciprocal Rank Fusion with Random Forest rank #${ml.rank} (${ml.uncalibratedScorePct}% uncalibrated model score).`;
      } else if (
        item.agreementState === "ml_favored_agronomic_warning" &&
        rule &&
        ml?.rank != null
      ) {
        hybridRationale = `Source disagreement — hard agronomic constraint demoted this crop (Overall #${overallRank}): Random Forest ranked ${item.displayName} #${ml.rank} (${ml.uncalibratedScorePct}% uncalibrated score) based on NPK/climate, but field constraints flagged: ${rule.hardConstraints.join(" ")}`;
      } else if (item.agreementState === "rule_favored" && rule) {
        hybridRationale = `Agronomic-only candidate (Overall #${overallRank}): Ranked #${rule.rank} (${rule.compatibilityPct}% compatibility) for ${soilType} soil and ${waterUnits} water units, while receiving <1% uncalibrated score from the Random Forest on current lab chemistry.`;
      } else if (ml?.rank != null) {
        hybridRationale = `ML-favored candidate (Overall #${overallRank}): Ranked #${ml.rank} by Random Forest (${ml.uncalibratedScorePct}% uncalibrated score), while scoring below the baseline agronomic viability threshold (${rule?.compatibilityPct ?? 0}% rule compatibility) for ${soilType} soil and ${waterUnits} water units.`;
      }
    } else if (hasRuleContribution && rule) {
      hybridRationale = `Rule-Based ranking (#${overallRank}): ${rule.compatibilityPct}% agronomic compatibility for ${soilType} soil and ${waterUnits} water units. ML ranking did not contribute (${mlStatusMessage})`;
    } else if (hasMlContribution && ml?.rank != null) {
      hybridRationale = `ML-only ranking (#${overallRank}): Ranked #${ml.rank} by the 200-tree Random Forest (${ml.uncalibratedScorePct}% uncalibrated score).`;
    }

    const ruleDetail = rule
      ? `${rule.soilReason} ${rule.waterExplanation}`
      : "Physical soil texture and water plan were not evaluated.";
    const mlDetail =
      ml && ml.available && ml.uncalibratedScorePct !== null
        ? `Random Forest assigned a ${ml.uncalibratedScorePct}% uncalibrated ensemble score${isDemoProfile ? " (on demo benchmark inputs)" : ""}.`
        : "Random Forest ML score unavailable for this candidate.";

    const whyThisCrop = `${hybridRationale} ${ruleDetail} ${mlDetail}`;

    const matchingFactors: string[] = [];
    if (rule) {
      matchingFactors.push(rule.soilReason, rule.waterExplanation, rule.tempExplanation);
      if (item.ruleRaw?.preferredMatch && planInput?.preferredCrop) {
        matchingFactors.push(
          `Matches your preferred crop selection ('${planInput.preferredCrop}').`,
        );
      }
    }
    if (ml && ml.available && ml.rank !== null && ml.uncalibratedScorePct !== null) {
      matchingFactors.push(
        `Random Forest rank #${ml.rank} (${ml.uncalibratedScorePct}% uncalibrated class score average across 200 decision trees).`,
      );
    }

    const category = item.ruleRaw?.category ?? guide?.category ?? null;
    const categoryOrientation =
      category === "Cereal" || category === "Pulse"
        ? "Field crop: Lower upfront working capital typically required compared to perennial orchards."
        : category === "Fibre & Commercial"
          ? "Commercial crop: Moderate working capital required for inputs and harvest labor."
          : "Perennial / Plantation: Higher multi-year establishment capital with extended gestation period.";

    const economicNote =
      planInput && landArea > 0
        ? `Budget allocation: ₹${budget.toLocaleString("en-IN")} across ${landArea} acres (approx. ₹${budgetPerAcre.toLocaleString("en-IN")}/acre). ${categoryOrientation} Audited local cultivation cost per acre is not in the benchmark catalog.`
        : "Cultivation cost and profit are not modeled by the benchmark dataset.";

    const limitations: string[] = [];
    if (rule?.hardConstraints.length) {
      limitations.push(...rule.hardConstraints);
    }
    if (hasMlContribution) {
      limitations.push(
        "ML scores are uncalibrated Random Forest class score averages on a 2,200-sample benchmark dataset, not calibrated field probabilities.",
      );
    } else {
      limitations.push(
        "Laboratory NPK, pH, or seasonal rainfall were incomplete or invalid, so ML predictions did not contribute.",
      );
    }
    limitations.push("Official local cultivation cost per acre is not verified in the catalog.");

    const waterRequirement = item.ruleRaw?.waterRequirement ?? guide?.waterRequirement ?? null;
    const growthDurationDays = item.ruleRaw?.durationDays ?? guide?.durationDays ?? null;

    rankedCandidates.push({
      overallRank,
      canonicalCropId: item.canonicalId,
      crop: item.displayName,
      guideSlug: item.guideSlug,
      source: candidateSource,
      fusionIndex: item.fusionIndex,
      hardConstraintTriggered: item.hardConstraintTriggered,
      agreementState: item.agreementState,
      ruleAssessment: rule,
      mlAssessment: ml,
      hybridRationale,
      whyThisCrop,
      waterRequirement,
      growthDurationDays,
      category,
      matchingFactors,
      limitations,
      economicNote,
    });

    recommendations.push({
      crop: item.displayName,
      canonicalCropId: item.canonicalId,
      overallRank,
      source: candidateSource,
      confidence: rule ? rule.compatibilityPct : (ml?.uncalibratedScorePct ?? null),
      suitabilityScore: rule ? rule.compatibilityPct : null,
      voteSharePct: ml?.available ? ml.uncalibratedScorePct : null,
      modelScore: ml?.available ? ml.uncalibratedScore : null,
      fusionIndex: hybridActive ? item.fusionIndex : null,
      agreementState: item.agreementState,
      hardConstraintTriggered: item.hardConstraintTriggered,
      ruleRank: rule?.rank ?? null,
      mlRank: ml?.rank ?? null,
      hybridRationale,
      waterNeed: waterRequirement,
      growthDurationDays,
      expectedYield: null,
      estimatedProfit: null,
      modelName: hybridActive
        ? "Constraint-Aware Hybrid Ranking (Agronomic Rules + 200-Tree Random Forest)"
        : hasRuleContribution
          ? "AgriSmart Agronomic Rule Engine"
          : "Random Forest (200 trees)",
      treeCount: hasMlContribution ? 200 : null,
      rationale: whyThisCrop,
      note: hybridActive
        ? isDemoProfile
          ? "Demo hybrid ranking: combines agronomic rules with illustrative benchmark ML scores via ordinal Reciprocal Rank Fusion (scores are never averaged)."
          : "Hybrid ranking combines ordinal Agronomic Rule rank and uncalibrated Random Forest rank via Constraint-Aware Reciprocal Rank Fusion (incompatible score scales are never averaged)."
        : hasRuleContribution
          ? "Rule-Based agronomic ranking only — ML inputs were incomplete, invalid, or unavailable."
          : "Uncalibrated Random Forest class score average on benchmark data.",
      matchingFactors,
      limitations,
      economicNote,
      dataUsed: informationUsed,
      dataMissing: informationNeeded,
    });
  });

  return {
    mode,
    hybridActive,
    sourcesUsed,
    mlStatus,
    mlStatusMessage,
    mlRuntime,
    isDemoProfile,
    configUsed: cfg,
    methodologyName: "Constraint-Aware Reciprocal Rank Fusion (CA-RRF)",
    methodologySummary:
      "Matches candidates by canonical crop ID and ranks them using weighted Reciprocal Rank Fusion: w_rule / (k + r_rule) + w_ml / (k + r_ml) with k=10, w_rule=0.45, w_ml=0.55. Hard physical soil or irrigation incompatibilities demote conflicted candidates below viable options instead of silently averaging incompatible percentages.",
    methodologyLimitations: [
      "Rule compatibility (%) and Random Forest uncalibrated scores (%) measure different phenomena on different scales and are deliberately never averaged.",
      "Random Forest scores are uncalibrated ensemble leaf averages trained on a 2,200-row benchmark dataset without physical soil texture, land area, or economic cost features.",
      "When physical soil texture or water availability is unknown, rule constraints cannot filter ML predictions; when any of the 7 ML features is missing or out of range, only Rule-Based suitability is reported.",
    ],
    rankedCandidates,
    recommendations,
    informationUsed,
    informationNeeded,
    missingMlLabels,
    outOfRangeMlLabels,
    completenessPct,
  };
}

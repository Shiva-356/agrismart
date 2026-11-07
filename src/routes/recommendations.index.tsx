import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  CloudSun,
  Cpu,
  Droplets,
  FlaskConical,
  Gauge,
  Info,
  Layers,
  Leaf,
  MapPin,
  MinusCircle,
  RotateCcw,
  Save,
  Sparkles,
  Sprout,
  TestTubes,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { DataSourceBadge } from "@/components/common/DataSourceBadge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { RecommendationCard } from "@/components/agri/RecommendationCard";
import { ExplanationPanel } from "@/components/agri/ExplanationPanel";
import { MetricValue } from "@/components/agri/value";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  farmsService,
  historyService,
  soilReportsService,
  soilService,
  weatherService,
} from "@/services";
import type { CropRecommendation, Farm, SoilReport, SoilStatus, Weather } from "@/services/types";
import { getCropGuideSlug } from "@/data/crop-cultivation";
import { useMlPrediction } from "@/hooks/use-ml-prediction";
import { useT } from "@/i18n";
import {
  DEFAULT_HYBRID_RANKING_CONFIG,
  ML_FEATURE_META,
  SOIL_TYPES,
  areMlFeaturesComplete,
  buildActivePlanFromSoilReport,
  computeHybridRecommendations,
  extractMlFeaturesFromSoilParameters,
  formatMlPredictionRecommendations,
  generateGeneralPlanningRecommendations,
  generateMlPrediction,
  getMissingMlFeatureLabels,
  getOutOfRangeMlFeatureLabels,
  isValidMlFeatureValue,
  loadActivePlan,
  saveActivePlan,
  type ActivePlanState,
  type FarmInput,
  type HybridCropCandidate,
  type LinkedSoilReportSummary,
  type MlPredictionFeatures,
  type SoilType,
} from "@/lib/agri";
import { predictWithLocalForest } from "@/lib/ml/forest";

export interface RecommendationsSearch {
  soilReportId?: string | undefined;
}

export const Route = createFileRoute("/recommendations/")({
  validateSearch: (search: Record<string, unknown>): RecommendationsSearch => {
    const raw = search["soilReportId"];
    return {
      soilReportId: typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Your Crop Recommendations — AgriSmart" },
      {
        name: "description",
        content:
          "Compare agronomic Rule-Based guidance and genuine Machine Learning predictions for your farm plan in one place.",
      },
      { property: "og:title", content: "Your Crop Recommendations — AgriSmart" },
      {
        property: "og:description",
        content: "Both Rule-Based agronomic matching and genuine Random Forest model predictions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "/recommendations" }],
  }),
  component: RecommendationsPage,
});

function AvailabilityRow({
  label,
  available,
  detail,
  icon: Icon,
}: {
  label: string;
  available: boolean;
  detail: string;
  icon: typeof Leaf;
}) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-border/70 bg-card px-3 py-2.5">
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      <StatusBadge
        label={available ? "Available" : "Not available"}
        tone={available ? "success" : "muted"}
        icon={available ? CheckCircle2 : MinusCircle}
      />
    </li>
  );
}

function DataAvailability({
  farm,
  weather,
  soil,
  linkedReport,
}: {
  farm: Farm | null | undefined;
  weather: Weather | undefined;
  soil: SoilStatus | undefined;
  linkedReport?: LinkedSoilReportSummary | null | undefined;
}) {
  const hasWeather =
    Boolean(weather) &&
    (weather?.temperatureC !== null ||
      weather?.humidityPct !== null ||
      weather?.rainfallMm !== null);
  const hasSoil = Boolean(linkedReport || soil?.hasReport);
  const testedCount = linkedReport
    ? linkedReport.loadedKeys.length
    : (soil?.parameters.filter((p) => p.status === "available").length ?? 0);
  const weatherModeLabel = weather?.isLive ? "Live API observation" : "Estimated / demo reading";

  return (
    <section className="card-surface p-5" aria-labelledby="availability-title">
      <h2
        id="availability-title"
        className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
      >
        Verified Data Status
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Summary of real-world measurements currently linked to your active farm profile.
      </p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        <AvailabilityRow
          label="Farm profile"
          icon={MapPin}
          available={Boolean(farm)}
          detail={farm ? `${farm.name} · ${farm.location}` : "Profile not loaded"}
        />
        <AvailabilityRow
          label="Weather readings"
          icon={CloudSun}
          available={hasWeather}
          detail={
            hasWeather
              ? `${weather?.temperatureC ?? "--"}°C · ${weather?.humidityPct ?? "--"}% humidity (${weatherModeLabel})`
              : "No current weather readings"
          }
        />
        <AvailabilityRow
          label="Soil test report"
          icon={TestTubes}
          available={hasSoil}
          detail={
            linkedReport
              ? `${linkedReport.laboratory} (${linkedReport.sampleId || linkedReport.testDate})`
              : hasSoil
                ? `${testedCount} laboratory parameters tested`
                : "No verified soil report linked"
          }
        />
        <AvailabilityRow
          label="Soil nutrients & pH"
          icon={Sprout}
          available={testedCount > 0}
          detail={
            testedCount > 0
              ? `${testedCount} chemical indicator${testedCount === 1 ? "" : "s"} available (${linkedReport ? linkedReport.loadedKeys.join(", ") : "latest report"})`
              : "Required for ML inference; not needed for Rule-Based planning"
          }
        />
      </ul>
    </section>
  );
}

function RecommendationsPage() {
  const t = useT();
  const { soilReportId } = Route.useSearch();

  const farmQ = useQuery({ queryKey: ["farm"], queryFn: () => farmsService.getActiveFarm() });
  const farmId = farmQ.data?.data?.id;

  const weatherQ = useQuery({
    queryKey: ["weather", farmId],
    queryFn: () => weatherService.getCurrent(farmId as string),
    enabled: Boolean(farmId),
  });
  const soilQ = useQuery({
    queryKey: ["soil-status", farmId],
    queryFn: () => soilService.getStatus(farmId as string),
    enabled: Boolean(farmId),
  });
  const selectedReportQ = useQuery({
    queryKey: ["soil-report", soilReportId],
    queryFn: () => soilReportsService.byId(soilReportId as string),
    enabled: Boolean(soilReportId),
  });

  // Synchronize active submitted plan from localStorage
  const [activePlan, setActivePlanState] = useState<ActivePlanState | null>(() => loadActivePlan());

  useEffect(() => {
    const sync = () => setActivePlanState(loadActivePlan());
    window.addEventListener("agrismart:activePlan", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("agrismart:activePlan", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Effective farm plan inputs
  const currentPlanInput: FarmInput = useMemo(() => {
    if (activePlan?.input) {
      return activePlan.input;
    }
    const f = farmQ.data?.data;
    const w = weatherQ.data?.data;
    return {
      name: f?.name || "Active Farm Plan",
      landArea: f?.landAreaAcres || 5,
      water: 600,
      soilType: "Loamy",
      budget: 50000,
      preferredCrop: f?.currentCrop || "",
      notes: "",
      weather: w
        ? {
            temperature: w.temperatureC,
            humidity: w.humidityPct,
          }
        : undefined,
    };
  }, [activePlan, farmQ.data, weatherQ.data]);

  // Local laboratory features state for ML model
  // Note: Hourly precipitation (weather.rainfallMm) is NEVER substituted for seasonal ML rainfall.
  const [labFeatures, setLabFeatures] = useState<Partial<MlPredictionFeatures>>(() => {
    if (activePlan?.labFeatures && Object.keys(activePlan.labFeatures).length > 0) {
      return activePlan.labFeatures;
    }
    const soilParams = soilQ.data?.data?.parameters;
    if (soilParams && soilParams.length > 0) {
      return extractMlFeaturesFromSoilParameters(soilParams, weatherQ.data?.data, null).features;
    }
    return {};
  });

  const [isDemoProfile, setIsDemoProfile] = useState<boolean>(
    () => activePlan?.isDemoProfile ?? false,
  );
  const [showLabInputs, setShowLabInputs] = useState(false);
  const [showPlanInputs, setShowPlanInputs] = useState(false);

  // Track manual lab edits so async report/weather arrival never clobbers user typing
  const userEditedLabRef = useRef(false);
  const appliedReportSignatureRef = useRef<string | null>(null);
  const asyncDefaultHydratedRef = useRef(false);

  // Sync state if activePlan updates externally
  useEffect(() => {
    if (activePlan?.labFeatures) {
      setLabFeatures(activePlan.labFeatures);
    } else if (activePlan && !activePlan.labFeatures) {
      setLabFeatures({});
    }
    if (activePlan?.isDemoProfile !== undefined) {
      setIsDemoProfile(activePlan.isDemoProfile);
    }
  }, [activePlan]);

  // Async hydration for explicit `?soilReportId=<id>` navigation / deep-link
  useEffect(() => {
    const fetchedReport: SoilReport | null | undefined = selectedReportQ.data?.data;
    if (!soilReportId || !fetchedReport || userEditedLabRef.current) return;

    const weatherReady = Boolean(weatherQ.data?.data);
    const signature = `${fetchedReport.id}:${weatherReady ? "with-weather" : "no-weather"}`;
    if (appliedReportSignatureRef.current === signature) return;
    appliedReportSignatureRef.current = signature;

    const nextPlan = buildActivePlanFromSoilReport({
      report: fetchedReport,
      existingPlan: loadActivePlan(),
      fallbackFarm: farmQ.data?.data ?? null,
      ambientWeather: weatherQ.data?.data ?? null,
    });
    saveActivePlan(nextPlan);
  }, [soilReportId, selectedReportQ.data, farmQ.data, weatherQ.data]);

  // Async hydration when visiting /recommendations directly without an existing activePlan
  useEffect(() => {
    if (soilReportId || activePlan || userEditedLabRef.current || asyncDefaultHydratedRef.current) {
      return;
    }
    const soilParams = soilQ.data?.data?.parameters;
    if (!soilQ.data?.data?.hasReport || !soilParams || soilParams.length === 0) {
      return;
    }
    const extracted = extractMlFeaturesFromSoilParameters(
      soilParams,
      weatherQ.data?.data ?? null,
      null,
    );
    if (Object.keys(extracted.features).length > 0) {
      asyncDefaultHydratedRef.current = true;
      setLabFeatures(extracted.features);
      setIsDemoProfile(false);
    }
  }, [soilReportId, activePlan, soilQ.data, weatherQ.data]);

  const linkedSoilReport = activePlan?.linkedSoilReport ?? null;

  const updateLabField = (key: keyof MlPredictionFeatures, val: string) => {
    userEditedLabRef.current = true;
    setIsDemoProfile(false);
    const next: Partial<MlPredictionFeatures> = { ...labFeatures };
    if (val.trim() === "") {
      delete next[key];
    } else {
      const parsed = Number(val);
      if (Number.isFinite(parsed)) {
        next[key] = parsed;
      } else {
        delete next[key];
      }
    }
    setLabFeatures(next);
    saveActivePlan({
      input: {
        ...currentPlanInput,
        mlFeatures: Object.keys(next).length > 0 ? next : undefined,
      },
      labFeatures: Object.keys(next).length > 0 ? next : undefined,
      isDemoProfile: false,
      linkedSoilReport: linkedSoilReport ?? undefined,
      submittedAt: new Date().toISOString(),
    });
  };

  const handleLoadAmbientWeatherIntoLab = () => {
    const w = weatherQ.data?.data;
    if (!w || (w.temperatureC == null && w.humidityPct == null)) {
      toast.error("Ambient temperature and humidity are not currently available.");
      return;
    }
    userEditedLabRef.current = true;
    setIsDemoProfile(false);
    const next: Partial<MlPredictionFeatures> = { ...labFeatures };
    if (typeof w.temperatureC === "number" && Number.isFinite(w.temperatureC)) {
      next.temperature = w.temperatureC;
    }
    if (typeof w.humidityPct === "number" && Number.isFinite(w.humidityPct)) {
      next.humidity = w.humidityPct;
    }
    // Deliberately do NOT copy w.rainfallMm (hourly precipitation) into next.rainfall (seasonal rainfall)
    setLabFeatures(next);
    saveActivePlan({
      input: {
        ...currentPlanInput,
        mlFeatures: Object.keys(next).length > 0 ? next : undefined,
      },
      labFeatures: Object.keys(next).length > 0 ? next : undefined,
      isDemoProfile: false,
      linkedSoilReport: linkedSoilReport ?? undefined,
      submittedAt: new Date().toISOString(),
    });
    toast.info(
      w.isLive
        ? "Loaded live ambient temperature & humidity. Enter seasonal rainfall separately."
        : "Loaded estimated ambient temperature & humidity (demo/fallback). Enter seasonal rainfall separately.",
    );
  };

  const handleLoadDemoProfile = () => {
    userEditedLabRef.current = true;
    const demo: MlPredictionFeatures = {
      N: 90,
      P: 42,
      K: 43,
      temperature: 21,
      humidity: 82,
      ph: 6.5,
      rainfall: 202,
    };
    setLabFeatures(demo);
    setIsDemoProfile(true);
    saveActivePlan({
      input: currentPlanInput,
      labFeatures: demo,
      isDemoProfile: true,
      linkedSoilReport: undefined,
      submittedAt: new Date().toISOString(),
    });
    toast.info("Sample benchmark training profile loaded for demonstration.");
  };

  const handleClearLab = () => {
    userEditedLabRef.current = true;
    setLabFeatures({});
    setIsDemoProfile(false);
    saveActivePlan({
      input: {
        ...currentPlanInput,
        mlFeatures: undefined,
      },
      labFeatures: undefined,
      isDemoProfile: false,
      linkedSoilReport: undefined,
      submittedAt: new Date().toISOString(),
    });
    toast.info("Laboratory parameters cleared.");
  };

  const handleUpdatePlanInput = <K extends keyof FarmInput>(key: K, value: FarmInput[K]) => {
    const updated = { ...currentPlanInput, [key]: value };
    saveActivePlan({
      input: updated,
      labFeatures: Object.keys(labFeatures).length > 0 ? labFeatures : undefined,
      isDemoProfile,
      linkedSoilReport: linkedSoilReport ?? undefined,
      submittedAt: new Date().toISOString(),
    });
  };

  const [weightPreset, setWeightPreset] = useState<"balanced" | "agronomic" | "ml">("balanced");

  const hybridWeightConfig = useMemo(() => {
    if (weightPreset === "agronomic") {
      return { ...DEFAULT_HYBRID_RANKING_CONFIG, ruleWeight: 0.65, mlWeight: 0.35 };
    }
    if (weightPreset === "ml") {
      return { ...DEFAULT_HYBRID_RANKING_CONFIG, ruleWeight: 0.35, mlWeight: 0.65 };
    }
    return DEFAULT_HYBRID_RANKING_CONFIG;
  }, [weightPreset]);

  // Connect real POST /api/predict service
  const { mlPrediction, mlServiceError, mlLoading, allowLocalForestFallback, refetchMl } =
    useMlPrediction(labFeatures);

  // 1. RULE-BASED RECOMMENDATIONS
  const ruleRecs = useMemo(() => {
    return generateGeneralPlanningRecommendations(currentPlanInput);
  }, [currentPlanInput]);

  // 2. ML-BASED RECOMMENDATIONS (via /api/predict when available, or local exported forest when loading)
  const mlComplete = areMlFeaturesComplete(labFeatures);
  const mlRecs = useMemo(() => {
    if (!mlComplete) return null;
    if (mlPrediction && mlPrediction.ranked?.length > 0) {
      return formatMlPredictionRecommendations(labFeatures, mlPrediction.ranked, {
        modelName: mlPrediction.model ?? "Random Forest (200 trees)",
        treeCount: mlPrediction.treeCount ?? 200,
        isDemoProfile,
      });
    }
    if (!allowLocalForestFallback || mlServiceError) return null;
    const raw = generateMlPrediction(labFeatures);
    if (!raw) return null;
    if (isDemoProfile) {
      return raw.map((r) => ({
        ...r,
        source: "DEMO / ILLUSTRATIVE" as const,
        note: "Sample benchmark profile for illustration. Scores are uncalibrated Random Forest class score averages on benchmark data, not verified field measurements.",
      }));
    }
    return raw;
  }, [
    labFeatures,
    mlComplete,
    mlPrediction,
    allowLocalForestFallback,
    mlServiceError,
    isDemoProfile,
  ]);

  // 3. HYBRID RECOMMENDATIONS (Constraint-Aware Reciprocal Rank Fusion)
  const hybridResult = useMemo(
    () =>
      computeHybridRecommendations({
        planInput: currentPlanInput,
        mlFeatures: labFeatures,
        mlPrediction,
        mlServiceError,
        allowLocalForestFallback,
        localForestPredict: (f) =>
          predictWithLocalForest(f as unknown as Record<string, number>)?.ranked ?? null,
        isDemoProfile,
        config: hybridWeightConfig,
      }),
    [
      currentPlanInput,
      labFeatures,
      mlPrediction,
      mlServiceError,
      allowLocalForestFallback,
      isDemoProfile,
      hybridWeightConfig,
    ],
  );

  const topHybridCandidate = hybridResult.rankedCandidates[0] ?? null;
  const topRuleRec = ruleRecs[0];
  const topMlRec = mlRecs?.[0];

  const mapHybridCandidateToCard = (cand: HybridCropCandidate): CropRecommendation => {
    const rule = cand.ruleAssessment;
    const ml = cand.mlAssessment;
    let suitability = "Agronomically compatible";
    if (hybridResult.hybridActive) {
      if (cand.agreementState === "strong_agreement" && rule?.rank != null && ml?.rank != null) {
        suitability = `Strong Consensus · Rule #${rule.rank} & ML #${ml.rank}`;
      } else if (
        cand.agreementState === "both_supporting" &&
        rule?.rank != null &&
        ml?.rank != null
      ) {
        suitability = `Supported by Both Engines · Rule #${rule.rank} & ML #${ml.rank}`;
      } else if (cand.agreementState === "ml_favored_agronomic_warning" && ml?.rank != null) {
        suitability = `Source Disagreement · ML #${ml.rank} (Soil/Water Constraint)`;
      } else if (cand.agreementState === "rule_favored" && rule?.rank != null) {
        suitability = `Rule-Favored · Agronomic Rank #${rule.rank}`;
      } else if (ml?.rank != null) {
        suitability = `ML-Favored · Random Forest Rank #${ml.rank}`;
      }
    } else if (rule) {
      suitability = `${rule.compatibilityPct}% Agronomic Compatibility (Rule-Based Only)`;
    }

    return {
      crop: cand.crop,
      canonicalCropId: cand.canonicalCropId,
      overallRank: cand.overallRank,
      source: cand.source,
      confidencePct: rule?.compatibilityPct ?? ml?.uncalibratedScorePct ?? null,
      ruleCompatibilityPct: rule?.compatibilityPct ?? null,
      mlUncalibratedScorePct: ml?.available ? ml.uncalibratedScorePct : null,
      hybridRationale: cand.hybridRationale,
      agreementState: cand.agreementState,
      hardConstraintTriggered: cand.hardConstraintTriggered,
      suitability,
      waterRequirement: cand.waterRequirement,
      growthDurationDays: cand.growthDurationDays,
      complexity: cand.category ?? "Field Crop",
      weatherSuitability:
        ml && ml.available
          ? ml.runtime === "fastapi"
            ? "FastAPI 200-tree RF"
            : "200-tree Random Forest"
          : currentPlanInput.weather?.temperature != null
            ? `${currentPlanInput.weather.temperature}°C ambient`
            : null,
      soilSuitability: rule
        ? `${currentPlanInput.soilType} (${Math.round(rule.soilScore * 100)}% soil match)`
        : null,
    };
  };

  // Missing & out-of-range ML parameters lists
  const missingMlKeys = useMemo(() => getMissingMlFeatureLabels(labFeatures), [labFeatures]);
  const outOfRangeMlKeys = useMemo(() => getOutOfRangeMlFeatureLabels(labFeatures), [labFeatures]);
  const availableMlItems = useMemo(
    () => ML_FEATURE_META.filter((m) => isValidMlFeatureValue(m.key, labFeatures[m.key])),
    [labFeatures],
  );

  const isLoading = farmQ.isPending || soilQ.isPending;
  const activeDataSource = isDemoProfile
    ? ("demo" as const)
    : mlPrediction?.runtime === "fastapi"
      ? ("api" as const)
      : ("artifact" as const);

  return (
    <div className="space-y-8 pb-8">
      <PageHeader
        eyebrow="Decision Support"
        title="Your Crop Recommendations"
        description="Constraint-Aware Hybrid Ranking combining Agronomic Rule suitability with genuine 200-tree Random Forest ML predictions — plus full individual engine breakdowns."
        icon={Leaf}
        actions={
          <Button asChild size="sm" variant="outline">
            <Link to="/recommendations/compare">
              Compare crops
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        }
      />

      {soilReportId && selectedReportQ.isPending ? (
        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4 text-xs text-muted-foreground">
          Loading verified soil measurements from selected report…
        </div>
      ) : null}

      {soilReportId &&
      !selectedReportQ.isPending &&
      (selectedReportQ.isError || !selectedReportQ.data?.data) ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-200">
          The requested soil report (<code className="font-mono">{soilReportId}</code>) could not be
          found. Showing your active farm plan without new soil report overrides.
        </div>
      ) : null}

      {linkedSoilReport && !isDemoProfile ? (
        <section
          className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.04] p-5"
          aria-labelledby="linked-soil-report-heading"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  label={linkedSoilReport.verified ? "Soil Report Applied" : "Unverified Report"}
                  tone="success"
                  icon={BadgeCheck}
                />
                <h2
                  id="linked-soil-report-heading"
                  className="text-sm font-semibold text-foreground"
                >
                  {linkedSoilReport.laboratory}
                </h2>
              </div>
              <p className="text-xs text-muted-foreground">
                Sample ID:{" "}
                <span className="font-medium text-foreground">
                  {linkedSoilReport.sampleId || "—"}
                </span>{" "}
                · Tested on{" "}
                <span className="font-medium text-foreground">{linkedSoilReport.testDate}</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {missingMlKeys.length > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setShowLabInputs(true)}
                >
                  <FlaskConical className="size-3.5" />
                  Supply Remaining {missingMlKeys.length} ML Input
                  {missingMlKeys.length === 1 ? "" : "s"}
                </Button>
              ) : null}
              <Button asChild size="sm" variant="ghost">
                <Link to="/soil-reports">Change report</Link>
              </Button>
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 text-xs">
            <div className="rounded-xl border border-border/70 bg-card p-3">
              <p className="font-semibold text-foreground">
                Available ML Inputs ({availableMlItems.length}/7):
              </p>
              {availableMlItems.length > 0 ? (
                <p className="mt-1 text-muted-foreground">
                  {availableMlItems
                    .map((m) => `${m.label}: ${labFeatures[m.key]}${m.unit ? ` ${m.unit}` : ""}`)
                    .join(" · ")}
                </p>
              ) : (
                <p className="mt-1 text-muted-foreground">
                  No tested N, P, K, or pH values were present on this report.
                </p>
              )}
            </div>
            <div className="rounded-xl border border-border/70 bg-card p-3">
              <p className="font-semibold text-foreground">
                Still Missing for Random Forest ({missingMlKeys.length}/7):
              </p>
              <p className="mt-1 text-muted-foreground">
                {missingMlKeys.length > 0
                  ? `${missingMlKeys.join(", ")} (never substituted with zeros; Rule-Based guidance remains active below).`
                  : "All 7 features verified — Random Forest predictions are active below."}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      {isLoading ? (
        <LoadingSkeleton variant="card" count={2} />
      ) : (
        <DataAvailability
          farm={farmQ.data?.data}
          weather={weatherQ.data?.data}
          soil={soilQ.data?.data}
          linkedReport={linkedSoilReport}
        />
      )}

      {/* Submitted Farm Plan Overview Card */}
      <section className="card-surface p-5 sm:p-6" aria-labelledby="plan-overview-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-primary">
                Active Farm Plan
              </span>
              <h2 id="plan-overview-title" className="text-base font-semibold text-foreground">
                Plan Inputs: {currentPlanInput.name || "Untitled Farm"}
              </h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Both recommendation engines below evaluate this exact farm configuration.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowPlanInputs((v) => !v)}
            >
              {showPlanInputs ? "Hide Plan Settings" : "Adjust Farm Plan Inputs"}
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard">Edit on Dashboard</Link>
            </Button>
          </div>
        </div>

        {/* Collapsible inline farm plan editor */}
        {showPlanInputs ? (
          <div className="mt-4 rounded-xl border border-border bg-muted/20 p-4 space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="plan-name" className="text-xs">
                  Farm / Farmer Name
                </Label>
                <Input
                  id="plan-name"
                  value={currentPlanInput.name}
                  onChange={(e) => handleUpdatePlanInput("name", e.target.value)}
                  placeholder="e.g. Ramesh Patel"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plan-soil" className="text-xs">
                  Soil Type
                </Label>
                <Select
                  value={currentPlanInput.soilType}
                  onValueChange={(v) => handleUpdatePlanInput("soilType", v as SoilType)}
                >
                  <SelectTrigger id="plan-soil">
                    <SelectValue placeholder="Select soil type" />
                  </SelectTrigger>
                  <SelectContent>
                    {SOIL_TYPES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {t.soilTypes?.[s] ?? s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plan-land" className="text-xs">
                  Land Area (acres)
                </Label>
                <Input
                  id="plan-land"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={currentPlanInput.landArea}
                  onChange={(e) => handleUpdatePlanInput("landArea", Number(e.target.value))}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="plan-water" className="text-xs">
                  Water Available (units)
                </Label>
                <Input
                  id="plan-water"
                  type="number"
                  min="0"
                  value={currentPlanInput.water}
                  onChange={(e) => handleUpdatePlanInput("water", Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plan-budget" className="text-xs">
                  Budget (₹)
                </Label>
                <Input
                  id="plan-budget"
                  type="number"
                  min="0"
                  value={currentPlanInput.budget}
                  onChange={(e) => handleUpdatePlanInput("budget", Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plan-crop" className="text-xs">
                  Preferred Crop (Optional)
                </Label>
                <Input
                  id="plan-crop"
                  value={currentPlanInput.preferredCrop}
                  onChange={(e) => handleUpdatePlanInput("preferredCrop", e.target.value)}
                  placeholder="e.g. Maize, Cotton"
                />
              </div>
            </div>
          </div>
        ) : (
          <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-xl border border-border/70 bg-card p-2.5">
              <dt className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Soil Type
              </dt>
              <dd className="mt-1 text-sm font-semibold text-foreground">
                {currentPlanInput.soilType}
              </dd>
            </div>
            <div className="rounded-xl border border-border/70 bg-card p-2.5">
              <dt className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Land Area
              </dt>
              <dd className="mt-1 text-sm font-semibold text-foreground">
                {currentPlanInput.landArea} acres
              </dd>
            </div>
            <div className="rounded-xl border border-border/70 bg-card p-2.5">
              <dt className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Water
              </dt>
              <dd className="mt-1 text-sm font-semibold text-foreground">
                {currentPlanInput.water} units
              </dd>
            </div>
            <div className="rounded-xl border border-border/70 bg-card p-2.5">
              <dt className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Budget
              </dt>
              <dd className="mt-1 text-sm font-semibold text-foreground">
                ₹{currentPlanInput.budget.toLocaleString("en-IN")}
              </dd>
            </div>
            <div className="rounded-xl border border-border/70 bg-card p-2.5">
              <dt className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Preferred Crop
              </dt>
              <dd className="mt-1 truncate text-sm font-semibold text-foreground">
                {currentPlanInput.preferredCrop || "None"}
              </dd>
            </div>
            <div className="rounded-xl border border-border/70 bg-card p-2.5">
              <dt className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                Weather Station
              </dt>
              <dd className="mt-1 truncate text-sm font-semibold text-foreground">
                {weatherQ.data?.data?.temperatureC != null
                  ? `${weatherQ.data.data.temperatureC}°C`
                  : "Unavailable"}
              </dd>
            </div>
          </dl>
        )}
      </section>

      {/* ========================================================================= */}
      {/* PRIMARY SECTION: HYBRID CROP RECOMMENDATIONS (CA-RRF)                     */}
      {/* ========================================================================= */}
      <section
        className="space-y-5 rounded-2xl border border-primary/30 bg-card p-5 shadow-sm sm:p-6"
        aria-labelledby="hybrid-ranking-heading"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/60 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-md border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${
                  hybridResult.hybridActive
                    ? isDemoProfile
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                      : "border-primary/30 bg-primary/10 text-primary"
                    : "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                }`}
              >
                {hybridResult.hybridActive
                  ? isDemoProfile
                    ? "[DEMO HYBRID — ILLUSTRATIVE]"
                    : "[HYBRID: RULE-BASED + ML]"
                  : "[SINGLE-SOURCE: RULE-BASED ONLY — ML UNAVAILABLE]"}
              </span>
              <span className="text-xs text-muted-foreground">
                Sources used: {hybridResult.sourcesUsed.join(" + ") || "None"}
                {mlLoading ? " · Querying /api/predict…" : ""}
              </span>
            </div>
            <h2
              id="hybrid-ranking-heading"
              className="text-lg font-semibold tracking-tight text-foreground sm:text-xl"
            >
              {hybridResult.hybridActive
                ? "Unified Hybrid Crop Recommendations"
                : "Active Farm Plan Ranking (Rule-Based Only — ML Inputs Incomplete)"}
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {hybridResult.hybridActive
                ? "Combines physical soil & irrigation rules with 200-tree Random Forest predictions via Constraint-Aware Reciprocal Rank Fusion (CA-RRF). Incompatible percentage scales are never averaged."
                : "Required ML features are incomplete, invalid, or unavailable — AgriSmart never fabricates missing inputs or claims a hybrid result when only one engine contributed."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hybridResult.hybridActive ? (
              <Select
                value={weightPreset}
                onValueChange={(v) => setWeightPreset(v as "balanced" | "agronomic" | "ml")}
              >
                <SelectTrigger
                  aria-label="Hybrid ranking weight preset"
                  className="h-8 w-[215px] text-xs"
                >
                  <SelectValue placeholder="Ranking weight preset" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="balanced" className="text-xs">
                    Balanced (45% Rule / 55% ML)
                  </SelectItem>
                  <SelectItem value="agronomic" className="text-xs">
                    Agronomic Priority (65% / 35%)
                  </SelectItem>
                  <SelectItem value="ml" className="text-xs">
                    ML Priority (35% Rule / 65% ML)
                  </SelectItem>
                </SelectContent>
              </Select>
            ) : null}

            {hybridResult.recommendations.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  historyService.save({
                    id: crypto.randomUUID(),
                    createdAt: new Date().toISOString(),
                    input: {
                      ...currentPlanInput,
                      mlFeatures: mlComplete ? labFeatures : undefined,
                    },
                    recommendations: hybridResult.recommendations,
                    hybridMode: hybridResult.mode,
                    sourcesUsed: hybridResult.sourcesUsed,
                    featuresUsed: mlComplete ? labFeatures : undefined,
                    disclaimer: hybridResult.hybridActive
                      ? isDemoProfile
                        ? "Demo hybrid ranking: combines agronomic rules with illustrative benchmark ML scores via ordinal Reciprocal Rank Fusion."
                        : "Hybrid ranking combines agronomic rules with uncalibrated 200-tree Random Forest scores via ordinal Reciprocal Rank Fusion."
                      : "Rule-Based agronomic ranking only — ML inputs were incomplete, invalid, or unavailable.",
                  });
                  toast.success(
                    hybridResult.hybridActive
                      ? "Saved Hybrid recommendations to history"
                      : "Saved Rule-Based recommendations to history",
                  );
                }}
              >
                <Save className="size-4" />
                {hybridResult.hybridActive ? "Save Hybrid Plan" : "Save Active Plan"}
              </Button>
            ) : null}
          </div>
        </div>

        {/* Explicit Demo / Error / Missing-Input Status Indicators */}
        {isDemoProfile && hybridResult.hybridActive ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-300">
            <span className="font-semibold">DEMO / ILLUSTRATIVE BENCHMARK PROFILE:</span> ML ranks
            and uncalibrated scores in this hybrid view are derived from sample benchmark training
            inputs, not verified field measurements.
          </div>
        ) : null}

        {mlServiceError ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-xs text-destructive">
            <div>
              <span className="font-semibold">ML prediction API error:</span> {mlServiceError}.
              Displaying Rule-Based agronomic suitability separately below.
            </div>
            <Button size="sm" variant="outline" onClick={refetchMl}>
              Retry /api/predict
            </Button>
          </div>
        ) : !hybridResult.hybridActive ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-500/25 bg-blue-500/5 p-3.5 text-xs text-muted-foreground">
            <div>
              <span className="font-semibold text-foreground">ML Predictions Unavailable: </span>
              {hybridResult.mlStatusMessage}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setShowLabInputs(true)}
              >
                <FlaskConical className="size-3.5" />
                Supply ML Inputs
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={handleLoadDemoProfile}>
                <Sparkles className="size-3.5" />
                Load Demo Profile
              </Button>
            </div>
          </div>
        ) : null}

        {!topHybridCandidate ? (
          <EmptyState
            icon={Sprout}
            title="No candidate crops matched your active plan"
            description="Adjust soil texture or water availability in your active farm plan to evaluate suitable crops."
          />
        ) : (
          <>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
              <RecommendationCard
                recommendation={mapHybridCandidateToCard(topHybridCandidate)}
                source={activeDataSource}
                fetchedAt={activePlan?.submittedAt}
                variant="primary"
                footer={
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link to="/cultivation/$crop" params={{ crop: topHybridCandidate.guideSlug }}>
                        <Sprout aria-hidden="true" className="size-4" />
                        How to cultivate
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/recommendations/compare">Compare ranked crops</Link>
                    </Button>
                  </div>
                }
              />

              <ExplanationPanel
                result={{
                  top: mapHybridCandidateToCard(topHybridCandidate),
                  alternatives: hybridResult.rankedCandidates
                    .slice(1)
                    .map(mapHybridCandidateToCard),
                  mode: hybridResult.mode,
                  sourcesUsed: hybridResult.sourcesUsed,
                  mlStatus: hybridResult.mlStatus,
                  mlStatusMessage: hybridResult.mlStatusMessage,
                  dataCompletenessPct: hybridResult.completenessPct,
                  reliability: isDemoProfile
                    ? "Low"
                    : hybridResult.hybridActive
                      ? "High"
                      : "Moderate",
                  explanation: topHybridCandidate.whyThisCrop,
                  factors: [],
                  dataUsed: hybridResult.informationUsed,
                  dataMissing: hybridResult.informationNeeded,
                }}
                source={activeDataSource}
                fetchedAt={activePlan?.submittedAt}
                showChart={false}
              />
            </div>

            {/* Full Ranked Candidates Breakdown (#2..#N) */}
            {hybridResult.rankedCandidates.length > 1 ? (
              <div className="space-y-3 pt-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Ranked Candidates (#2 – #{hybridResult.rankedCandidates.length})
                  </h3>
                  <Button asChild size="sm" variant="ghost">
                    <Link to="/recommendations/compare">
                      Side-by-side comparison <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {hybridResult.rankedCandidates.slice(1).map((cand) => (
                    <RecommendationCard
                      key={cand.canonicalCropId}
                      recommendation={mapHybridCandidateToCard(cand)}
                      source={activeDataSource}
                      fetchedAt={activePlan?.submittedAt}
                      variant="compact"
                      footer={
                        <Button asChild size="sm" variant="outline">
                          <Link to="/cultivation/$crop" params={{ crop: cand.guideSlug }}>
                            Cultivation guide
                          </Link>
                        </Button>
                      }
                    />
                  ))}
                </div>
              </div>
            ) : null}

            {/* Documented Hybrid Methodology & Limitations */}
            <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-xs text-muted-foreground space-y-1.5">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <Info className="size-3.5 text-primary shrink-0" />
                {hybridResult.methodologyName}
              </p>
              <p className="leading-relaxed">{hybridResult.methodologySummary}</p>
              <ul className="list-disc pl-5 space-y-0.5 text-[11px]">
                {hybridResult.methodologyLimitations.map((lim) => (
                  <li key={lim}>{lim}</li>
                ))}
              </ul>
            </div>
          </>
        )}
      </section>

      {/* ========================================================================= */}
      {/* SECTION A: RULE-BASED RECOMMENDATIONS                                    */}
      {/* ========================================================================= */}
      <section
        className="space-y-5 rounded-2xl border border-blue-500/25 bg-blue-500/[0.015] p-5 sm:p-6"
        aria-labelledby="rule-based-heading"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-blue-500/10 border border-blue-500/20 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-blue-700 dark:text-blue-300">
                [RULE-BASED]
              </span>
              <h2
                id="rule-based-heading"
                className="text-lg font-semibold tracking-tight text-foreground"
              >
                A. Individual Engine: Rule-Based Suitability
              </h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Evaluated independently by agronomic matching using documented soil texture,
              irrigation needs, and crop duration.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                historyService.save({
                  id: crypto.randomUUID(),
                  createdAt: new Date().toISOString(),
                  input: currentPlanInput,
                  recommendations: ruleRecs,
                  hybridMode: "rule-only",
                  sourcesUsed: ["RULE-BASED"],
                  disclaimer:
                    "Agronomic rule-based matching using documented soil and water requirements. Laboratory NPK/pH not tested.",
                });
                toast.success("Saved Rule-Based recommendations to history");
              }}
            >
              <Save className="size-4" /> Save Rule Plan
            </Button>
          </div>
        </div>

        {!topRuleRec ? (
          <EmptyState
            icon={Sprout}
            title="No rule-based candidates found"
            description="No crops matched the combination of soil texture and water availability. Try adjusting water or selecting a different soil type."
          />
        ) : (
          <>
            {/* Primary Recommended Crop Card */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">
                Top Agronomic Match
              </p>
              <RecommendationCard
                recommendation={{
                  crop: topRuleRec.crop,
                  confidencePct: topRuleRec.confidence ?? null,
                  suitability: `${topRuleRec.confidence}% Agronomic Compatibility`,
                  waterRequirement: topRuleRec.waterNeed ?? null,
                  growthDurationDays: topRuleRec.growthDurationDays ?? null,
                  complexity: "Rule-Based",
                  weatherSuitability: null,
                  soilSuitability: `Suitable for ${currentPlanInput.soilType} soil`,
                }}
                source="artifact"
                variant="primary"
                scoreLabelPrefix="Agronomic match"
                footer={
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link
                        to="/cultivation/$crop"
                        params={{ crop: getCropGuideSlug(topRuleRec.crop) }}
                      >
                        <Sprout aria-hidden="true" className="size-4" />
                        How to cultivate
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/recommendations/compare">Compare crops</Link>
                    </Button>
                  </div>
                }
              />
            </div>

            {/* Why This Crop? Explanation & Matching Factors */}
            <div className="card-surface p-5 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Why this crop was selected
              </h3>
              <p className="text-sm leading-relaxed text-foreground">{topRuleRec.rationale}</p>

              {topRuleRec.matchingFactors && topRuleRec.matchingFactors.length > 0 ? (
                <div className="pt-2">
                  <p className="text-xs font-semibold text-muted-foreground">Matching Factors:</p>
                  <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                    {topRuleRec.matchingFactors.map((f, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="size-3.5 text-primary mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            {/* Information Used vs Still Needed */}
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="card-surface p-5">
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Information used for this recommendation
                </h3>
                {topRuleRec.dataUsed && topRuleRec.dataUsed.length > 0 ? (
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {topRuleRec.dataUsed.map((d) => (
                      <li key={d}>
                        <StatusBadge label={d} tone="success" icon={CheckCircle2} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">Not available.</p>
                )}
              </div>

              <div className="card-surface p-5">
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Information still needed
                </h3>
                {topRuleRec.dataMissing && topRuleRec.dataMissing.length > 0 ? (
                  <>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {topRuleRec.dataMissing.map((d) => (
                        <li key={d}>
                          <StatusBadge label={d} tone="warning" icon={MinusCircle} />
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Laboratory testing will provide exact chemical NPK values for ML predictions.
                    </p>
                    <Button asChild size="sm" variant="outline" className="mt-3">
                      <Link to="/soil-testing">Find a Testing Centre</Link>
                    </Button>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">Nothing reported as missing.</p>
                )}
              </div>
            </div>

            {/* Economic & Budget Limitation Note */}
            {topRuleRec.economicNote ? (
              <div className="rounded-xl border border-border/70 bg-card p-4 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">Economic & Budget Evaluation:</p>
                <p className="mt-1 leading-relaxed">{topRuleRec.economicNote}</p>
                {topRuleRec.limitations && topRuleRec.limitations.length > 0 ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground/80">
                      Documented limitations:{" "}
                    </span>
                    {topRuleRec.limitations.join(" • ")}
                  </p>
                ) : null}
              </div>
            ) : null}

            {/* Alternative Suitable Crops */}
            {ruleRecs.length > 1 ? (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold tracking-tight text-foreground">
                    Other Suitable Crops (Rule-Based Alternatives)
                  </h3>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/recommendations/compare">
                      Compare crops
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {ruleRecs.slice(1).map((alt) => (
                    <RecommendationCard
                      key={alt.crop}
                      recommendation={{
                        crop: alt.crop,
                        confidencePct: alt.confidence ?? null,
                        suitability: `${alt.confidence}% Match`,
                        waterRequirement: alt.waterNeed ?? null,
                        growthDurationDays: alt.growthDurationDays ?? null,
                        complexity: "Rule-Based",
                        weatherSuitability: null,
                        soilSuitability: `Compatible with ${currentPlanInput.soilType}`,
                      }}
                      source="artifact"
                      variant="compact"
                      scoreLabelPrefix="Agronomic match"
                      footer={
                        <Button asChild size="sm" variant="outline">
                          <Link
                            to="/cultivation/$crop"
                            params={{ crop: getCropGuideSlug(alt.crop) }}
                          >
                            Cultivation guide
                          </Link>
                        </Button>
                      }
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>

      {/* ========================================================================= */}
      {/* SECTION B: ML-BASED CROP PREDICTIONS                                     */}
      {/* ========================================================================= */}
      <section
        className="space-y-5 rounded-2xl border border-primary/25 bg-primary/[0.015] p-5 sm:p-6"
        aria-labelledby="ml-based-heading"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide border ${
                  isDemoProfile
                    ? "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300"
                    : "bg-primary/10 border-primary/20 text-primary"
                }`}
              >
                {isDemoProfile ? "[DEMO / ILLUSTRATIVE]" : "[ML MODEL]"}
              </span>
              <h2
                id="ml-based-heading"
                className="text-lg font-semibold tracking-tight text-foreground"
              >
                B. ML-Based Crop Predictions
              </h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Evaluated by genuine Random Forest ensemble (200 decision trees) trained on benchmark
              dataset.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowLabInputs((v) => !v)}
            >
              <FlaskConical className="size-3.5" />
              {showLabInputs ? "Hide Measurement Form" : "Enter / Edit Lab Values"}
            </Button>
            <Button
              type="button"
              variant={isDemoProfile ? "secondary" : "outline"}
              size="sm"
              onClick={handleLoadDemoProfile}
            >
              <Sparkles className="size-3.5" />
              Load Sample Benchmark Profile (Demo)
            </Button>
            {mlComplete && mlRecs && mlRecs.length > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  historyService.save({
                    id: crypto.randomUUID(),
                    createdAt: new Date().toISOString(),
                    input: currentPlanInput,
                    recommendations: mlRecs,
                    hybridMode: "ml-only",
                    sourcesUsed: [isDemoProfile ? "DEMO / ILLUSTRATIVE" : "ML MODEL"],
                    featuresUsed: labFeatures,
                    disclaimer: isDemoProfile
                      ? "Sample benchmark profile: uncalibrated Random Forest class score average on benchmark data. Not a calibrated probability or field yield guarantee."
                      : "Uncalibrated Random Forest class score average on benchmark data. Not a calibrated probability or field yield guarantee.",
                  });
                  toast.success("Saved ML predictions to history");
                }}
              >
                <Save className="size-4" /> Save ML Plan
              </Button>
            ) : null}
          </div>
        </div>

        {/* Collapsible Laboratory Values Input Form */}
        {showLabInputs ? (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <FlaskConical className="size-3.5" />
                Verified Laboratory & Weather Measurements
              </h3>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={handleLoadAmbientWeatherIntoLab}
                >
                  <CloudSun className="size-3" /> Use Ambient Temp & Humidity
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={handleClearLab}
                >
                  <RotateCcw className="size-3" /> Clear Values
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter your verified soil laboratory numbers and seasonal climate parameters below. All
              7 are required for genuine Random Forest inference. Hourly weather precipitation is
              never substituted for seasonal rainfall.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div className="space-y-1">
                <Label htmlFor="rec-n" className="text-xs">
                  Nitrogen (kg/ha)
                </Label>
                <Input
                  id="rec-n"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="e.g. 90"
                  value={labFeatures.N ?? ""}
                  onChange={(e) => updateLabField("N", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rec-p" className="text-xs">
                  Phosphorus (kg/ha)
                </Label>
                <Input
                  id="rec-p"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="e.g. 42"
                  value={labFeatures.P ?? ""}
                  onChange={(e) => updateLabField("P", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rec-k" className="text-xs">
                  Potassium (kg/ha)
                </Label>
                <Input
                  id="rec-k"
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="e.g. 43"
                  value={labFeatures.K ?? ""}
                  onChange={(e) => updateLabField("K", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rec-ph" className="text-xs">
                  Soil pH
                </Label>
                <Input
                  id="rec-ph"
                  type="number"
                  step="0.1"
                  min="0"
                  max="14"
                  placeholder="e.g. 6.5"
                  value={labFeatures.ph ?? ""}
                  onChange={(e) => updateLabField("ph", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rec-temp" className="text-xs">
                  Temperature (°C)
                </Label>
                <Input
                  id="rec-temp"
                  type="number"
                  step="0.1"
                  placeholder="e.g. 21"
                  value={labFeatures.temperature ?? ""}
                  onChange={(e) => updateLabField("temperature", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rec-hum" className="text-xs">
                  Humidity (%)
                </Label>
                <Input
                  id="rec-hum"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder="e.g. 82"
                  value={labFeatures.humidity ?? ""}
                  onChange={(e) => updateLabField("humidity", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rec-rain" className="text-xs">
                  Seasonal Rainfall (mm)
                </Label>
                <Input
                  id="rec-rain"
                  type="number"
                  step="0.1"
                  min="0"
                  max="1000"
                  placeholder="e.g. 202"
                  value={labFeatures.rainfall ?? ""}
                  onChange={(e) => updateLabField("rainfall", e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="w-full text-xs"
                  onClick={() => {
                    if (areMlFeaturesComplete(labFeatures)) {
                      toast.success("All 7 parameters valid. Predictions updated!");
                    } else if (outOfRangeMlKeys.length > 0) {
                      toast.error(`Out of valid range: ${outOfRangeMlKeys.join(", ")}`);
                    } else {
                      toast.error(`Missing: ${missingMlKeys.join(", ")}`);
                    }
                  }}
                >
                  Apply Values
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Demo Profile Active Banner */}
        {isDemoProfile && mlComplete ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-300">
            <span className="font-semibold">DEMO / ILLUSTRATIVE PREDICTIONS:</span> Evaluated using
            sample benchmark values (N=90, P=42, K=43, pH=6.5, Temp=21°C, Humidity=82%, Rain=202mm).
            These values illustrate model execution and do not represent verified field
            measurements.
          </div>
        ) : null}

        {/* Informative Missing Features State OR Active ML Predictions */}
        {!mlComplete || !mlRecs || !topMlRec ? (
          <div className="card-surface p-6">
            <div className="flex items-start gap-3">
              <TriangleAlert className="size-5 shrink-0 text-amber-500 mt-0.5" />
              <div className="space-y-3">
                <h3 className="text-base font-semibold text-foreground">
                  Machine Learning Predictions Pending Laboratory Measurements
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  The genuine 200-tree Random Forest model requires all 7 verified parameters
                  (Nitrogen, Phosphorus, Potassium, Soil pH, Temperature, Humidity, and Rainfall).
                  No values are fabricated. The Rule-Based recommendations in Section A above remain
                  fully active and suited to your farm plan.
                </p>

                {/* Status checklist of the 7 features */}
                <div className="rounded-xl border border-border/80 bg-background/70 p-3.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Required ML Parameters Checklist:
                  </p>
                  <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    {ML_FEATURE_META.map((item) => {
                      const val = labFeatures[item.key];
                      const isPresent = typeof val === "number" && Number.isFinite(val);
                      const isValid = isValidMlFeatureValue(item.key, val);
                      return (
                        <div
                          key={item.key}
                          className={`rounded-lg border px-2.5 py-1.5 flex items-center justify-between gap-1.5 ${
                            isValid
                              ? "border-primary/20 bg-primary/5 text-foreground"
                              : isPresent
                                ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                                : "border-border/70 bg-muted/30 text-muted-foreground"
                          }`}
                        >
                          <span className="truncate">{item.label}</span>
                          <span className="font-semibold shrink-0">
                            {isValid
                              ? `${val}${item.unit ? ` ${item.unit}` : ""}`
                              : isPresent
                                ? `${val} (range ${item.min}–${item.max})`
                                : "Missing"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    className="gap-1.5"
                    onClick={handleLoadDemoProfile}
                  >
                    <Sparkles className="size-3.5" />
                    Load Sample Benchmark Profile (Demo)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowLabInputs(true)}
                  >
                    <FlaskConical className="size-3.5" />
                    Enter Laboratory Measurements
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <Link to="/soil-testing">Find a Testing Centre</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Primary Predicted Crop Card */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-3">
                Top Model Prediction (Highest Uncalibrated Ensemble Score)
              </p>
              <RecommendationCard
                recommendation={{
                  crop: topMlRec.crop,
                  confidencePct: topMlRec.voteSharePct ?? null,
                  suitability: `${topMlRec.voteSharePct}% Uncalibrated Model Score`,
                  waterRequirement: topMlRec.waterNeed ?? null,
                  growthDurationDays: topMlRec.growthDurationDays ?? null,
                  complexity: topMlRec.modelName || "Random Forest (200 trees)",
                  weatherSuitability: null,
                  soilSuitability: null,
                }}
                source={isDemoProfile ? "demo" : "artifact"}
                variant="primary"
                scoreLabelPrefix={
                  isDemoProfile ? "Demo uncalibrated score" : "Uncalibrated model score"
                }
                footer={
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link
                        to="/cultivation/$crop"
                        params={{ crop: getCropGuideSlug(topMlRec.crop) }}
                      >
                        <Sprout aria-hidden="true" className="size-4" />
                        How to cultivate
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setShowLabInputs((v) => !v)}
                    >
                      Adjust ML Features
                    </Button>
                  </div>
                }
              />
            </div>

            {/* ML Rationale & Technical Explanation */}
            <div className="card-surface p-5 space-y-3">
              <div className="flex items-center gap-2">
                <BadgeCheck className="size-4 text-primary" />
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Ensemble Decision Tree Analysis
                </h3>
              </div>
              <p className="text-sm leading-relaxed text-foreground">{topMlRec.rationale}</p>
              <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">Statistical Note: </span>
                {topMlRec.voteSharePct}% is an uncalibrated Random Forest model score (the mean of
                terminal-leaf class distributions across all 200 decision trees) for {topMlRec.crop}
                . Probability calibration has not been performed; these scores reflect relative
                ensemble agreement on the benchmark dataset, not calibrated real-world probabilities
                or guaranteed field yield.
              </div>
            </div>

            {/* Features Snapshot */}
            <div className="card-surface p-5">
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Environmental & Chemical Features Evaluated
              </h3>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
                <div className="rounded-lg bg-secondary/50 p-2">
                  <span className="text-muted-foreground">N:</span>{" "}
                  <span className="font-semibold text-foreground">{labFeatures.N} kg/ha</span>
                </div>
                <div className="rounded-lg bg-secondary/50 p-2">
                  <span className="text-muted-foreground">P:</span>{" "}
                  <span className="font-semibold text-foreground">{labFeatures.P} kg/ha</span>
                </div>
                <div className="rounded-lg bg-secondary/50 p-2">
                  <span className="text-muted-foreground">K:</span>{" "}
                  <span className="font-semibold text-foreground">{labFeatures.K} kg/ha</span>
                </div>
                <div className="rounded-lg bg-secondary/50 p-2">
                  <span className="text-muted-foreground">pH:</span>{" "}
                  <span className="font-semibold text-foreground">{labFeatures.ph}</span>
                </div>
                <div className="rounded-lg bg-secondary/50 p-2">
                  <span className="text-muted-foreground">Temp:</span>{" "}
                  <span className="font-semibold text-foreground">{labFeatures.temperature}°C</span>
                </div>
                <div className="rounded-lg bg-secondary/50 p-2">
                  <span className="text-muted-foreground">Humidity:</span>{" "}
                  <span className="font-semibold text-foreground">{labFeatures.humidity}%</span>
                </div>
                <div className="rounded-lg bg-secondary/50 p-2">
                  <span className="text-muted-foreground">Seasonal Rain:</span>{" "}
                  <span className="font-semibold text-foreground">{labFeatures.rainfall} mm</span>
                </div>
              </div>
            </div>

            {/* Alternative Predicted Crops */}
            {mlRecs.length > 1 ? (
              <div className="space-y-3 pt-2">
                <h3 className="text-base font-semibold tracking-tight text-foreground">
                  Alternative Model Candidates (By Uncalibrated Model Score)
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {mlRecs.slice(1).map((alt) => (
                    <RecommendationCard
                      key={alt.crop}
                      recommendation={{
                        crop: alt.crop,
                        confidencePct: alt.voteSharePct ?? null,
                        suitability: `${alt.voteSharePct}% Uncalibrated Model Score`,
                        waterRequirement: alt.waterNeed ?? null,
                        growthDurationDays: alt.growthDurationDays ?? null,
                        complexity: alt.modelName || "Random Forest",
                        weatherSuitability: null,
                        soilSuitability: null,
                      }}
                      source={isDemoProfile ? "demo" : "artifact"}
                      variant="compact"
                      scoreLabelPrefix={
                        isDemoProfile ? "Demo uncalibrated score" : "Uncalibrated model score"
                      }
                      footer={
                        <Button asChild size="sm" variant="outline">
                          <Link
                            to="/cultivation/$crop"
                            params={{ crop: getCropGuideSlug(alt.crop) }}
                          >
                            Cultivation guide
                          </Link>
                        </Button>
                      }
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>

      {/* Weather Readings Context */}
      <section className="card-surface p-5" aria-label="Weather context">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Ambient Weather Context
          </h2>
          {weatherQ.data ? (
            <DataSourceBadge source={weatherQ.data.source} fetchedAt={weatherQ.data.fetchedAt} />
          ) : null}
        </div>
        {weatherQ.isError || !weatherQ.data ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Weather station readings unavailable.
          </p>
        ) : (
          <>
            <dl className="mt-3 grid gap-3 sm:grid-cols-3">
              {[
                { label: "Temperature", value: weatherQ.data.data.temperatureC, unit: "°C" },
                { label: "Humidity", value: weatherQ.data.data.humidityPct, unit: "%" },
                { label: "Current Rain (1h)", value: weatherQ.data.data.rainfallMm, unit: "mm" },
              ].map((w) => (
                <div key={w.label} className="rounded-xl border border-border/70 px-3 py-2">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {w.label}
                  </dt>
                  <dd className="mt-1 text-sm font-semibold">
                    <MetricValue value={w.value} unit={w.unit} />
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-2.5 text-xs text-muted-foreground">
              Current 1-hour precipitation is displayed for ambient context only and is never
              substituted for seasonal crop rainfall in ML predictions.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

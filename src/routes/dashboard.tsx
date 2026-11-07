import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  CloudSun,
  Coins,
  Compass,
  Droplets,
  FileCheck2,
  FlaskConical,
  Info,
  MapPin,
  Plus,
  RotateCcw,
  Ruler,
  Save,
  Sparkles,
  Sprout,
  Sunrise,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { DataSourceBadge } from "@/components/common/DataSourceBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { WeatherCard } from "@/components/agri/WeatherCard";
import { SoilStatusCard } from "@/components/agri/SoilStatusCard";
import { RecommendationCard } from "@/components/agri/RecommendationCard";
import { ExplanationPanel } from "@/components/agri/ExplanationPanel";
import { MetricValue } from "@/components/agri/value";
import { CreateFarmDialog } from "@/components/agri/CreateFarmDialog";
import {
  farmsService,
  historyService,
  predictionService,
  soilService,
  weatherService,
} from "@/services";
import type { CropRecommendation, RecommendationResult, Weather } from "@/services/types";
import { getCropGuideSlug } from "@/data/crop-cultivation";
import { useAgriUser } from "@/hooks/use-agri-user";
import { useMlPrediction } from "@/hooks/use-ml-prediction";
import { useT } from "@/i18n";
import {
  SOIL_TYPES,
  computeHybridRecommendations,
  deriveActivePlanSummary,
  generatePlanningSimulation,
  areMlFeaturesComplete,
  getMissingMlFeatureLabels,
  getOutOfRangeMlFeatureLabels,
  loadActivePlan,
  saveActivePlan,
  setActiveFarmId,
  type ActivePlanState,
  type FarmInput,
  type HybridCropCandidate,
  type Recommendation,
  type SoilType,
  type MlPredictionFeatures,
} from "@/lib/agri";
import { predictWithLocalForest } from "@/lib/ml/forest";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Farm Dashboard — AgriSmart Decision Support" },
      {
        name: "description",
        content:
          "Your farm at a glance: weather, soil information status, explainable AI crop recommendation and the next recommended step.",
      },
      { property: "og:title", content: "Farm Dashboard — AgriSmart Decision Support" },
      {
        property: "og:description",
        content:
          "Weather, soil status, explainable crop recommendation and your next recommended action.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: ({ error, reset }) => (
    <div className="mx-auto w-full max-w-4xl px-4 py-12">
      <ErrorState
        title="Dashboard failed to load"
        description={
          error?.message && /dynamically imported module|failed to fetch/i.test(error.message)
            ? "A newer module version is available or network connectivity was temporarily interrupted. Reloading will refresh the dashboard."
            : (error?.message ?? "An error occurred while loading your dashboard.")
        }
        onRetry={() => {
          if (
            error?.message &&
            /dynamically imported module|failed to fetch/i.test(error.message)
          ) {
            window.location.reload();
          } else {
            reset();
          }
        }}
      />
    </div>
  ),
  component: Dashboard,
});

const EMPTY: FarmInput = {
  name: "",
  landArea: 5,
  water: 600,
  soilType: "Loamy",
  budget: 50000,
  preferredCrop: "",
  notes: "",
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function Dashboard() {
  const queryClient = useQueryClient();
  const user = useAgriUser();
  const farmQ = useQuery({ queryKey: ["farm"], queryFn: () => farmsService.current() });
  const farmId = farmQ.data?.data?.id;

  const farmsListQ = useQuery({
    queryKey: ["farms", user?.id],
    queryFn: () => farmsService.list(user?.id),
    enabled: Boolean(user?.id),
  });
  const userFarms = farmsListQ.data?.data ?? [];

  const weatherQ = useQuery({
    queryKey: ["weather", farmId],
    queryFn: () => weatherService.getCurrent(farmId),
  });
  const soilQ = useQuery({
    queryKey: ["soil", "status", farmId],
    queryFn: () => soilService.getStatus(farmId as string),
    enabled: Boolean(farmId),
  });

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

  const farm = farmQ.data?.data;
  const soil = soilQ.data?.data;
  const hasReport = Boolean(activePlan?.linkedSoilReport || soil?.hasReport);

  const prelimSummary = useMemo(
    () =>
      deriveActivePlanSummary({
        activePlan,
        farm: farm ?? null,
        weather: weatherQ.data?.data ?? null,
        soil: soil ?? null,
      }),
    [activePlan, farm, weatherQ.data, soil],
  );

  const { mlPrediction, mlServiceError, mlLoading, allowLocalForestFallback, refetchMl } =
    useMlPrediction(prelimSummary.labFeatures);

  const planSummary = useMemo(
    () =>
      deriveActivePlanSummary({
        activePlan,
        farm: farm ?? null,
        weather: weatherQ.data?.data ?? null,
        soil: soil ?? null,
        mlPrediction,
        mlServiceError,
        allowLocalForestFallback,
      }),
    [activePlan, farm, weatherQ.data, soil, mlPrediction, mlServiceError, allowLocalForestFallback],
  );

  const hybrid = planSummary.hybridResult;
  const topCandidate = hybrid.rankedCandidates[0] ?? null;
  const topPrimary = planSummary.primaryRecs[0] ?? null;
  const isHybridActive =
    planSummary.primaryEngine === "hybrid" || planSummary.primaryEngine === "demo-hybrid";
  const isDemoActive =
    planSummary.primaryEngine === "demo-hybrid" || planSummary.primaryEngine === "demo-ml";
  const recDataSource = isDemoActive
    ? ("demo" as const)
    : mlPrediction?.runtime === "fastapi"
      ? ("api" as const)
      : ("artifact" as const);
  const recScorePrefix = isDemoActive
    ? "Demo score"
    : isHybridActive
      ? "Rule compatibility"
      : "Agronomic match";

  const dashboardRecView: RecommendationResult | null = useMemo(() => {
    if (!topCandidate) return null;

    const mapCandidateToCard = (cand: HybridCropCandidate): CropRecommendation => {
      const rule = cand.ruleAssessment;
      const ml = cand.mlAssessment;
      let suitability = "Agronomically compatible";

      if (hybrid.hybridActive) {
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
            : planSummary.planInput.weather?.temperature != null
              ? `${planSummary.planInput.weather.temperature}°C ambient`
              : null,
        soilSuitability: rule
          ? `${planSummary.planInput.soilType} (${Math.round(rule.soilScore * 100)}% soil match)`
          : null,
      };
    };

    return {
      top: mapCandidateToCard(topCandidate),
      alternatives: hybrid.rankedCandidates.slice(1).map(mapCandidateToCard),
      mode: hybrid.mode,
      sourcesUsed: hybrid.sourcesUsed,
      mlStatus: hybrid.mlStatus,
      mlStatusMessage: hybrid.mlStatusMessage,
      dataCompletenessPct: planSummary.completenessPct,
      reliability: isDemoActive ? "Low" : hybrid.hybridActive ? "High" : "Moderate",
      explanation: topCandidate.whyThisCrop,
      factors: [],
      dataUsed: hybrid.informationUsed,
      dataMissing: hybrid.informationNeeded,
    };
  }, [topCandidate, hybrid, isDemoActive, planSummary]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6 lg:pt-10">
      {/* 1 — Welcome / farm overview */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card px-5 py-6 shadow-sm sm:px-7 sm:py-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 size-52 rounded-full bg-accent/25 blur-2xl"
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <Sunrise aria-hidden="true" className="size-3.5" />
              Your farm today
            </p>
            <h1
              suppressHydrationWarning
              className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl"
            >
              {farm ? `${greeting()}, ${farm.ownerName}` : `${greeting()}, farmer`}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Let's make a smarter decision for your farm today.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {userFarms.length > 1 ? (
              <Select
                value={farmId ?? ""}
                onValueChange={(selectedId) => {
                  setActiveFarmId(selectedId);
                  void queryClient.invalidateQueries({ queryKey: ["farm"] });
                }}
              >
                <SelectTrigger aria-label="Switch active farm" className="h-9 w-[170px] text-xs">
                  <SelectValue placeholder="Switch farm" />
                </SelectTrigger>
                <SelectContent>
                  {userFarms.map((f) => (
                    <SelectItem key={f.id} value={f.id} className="text-xs">
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <CreateFarmDialog
              trigger={
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Plus className="size-3.5" />
                  Add Farm
                </Button>
              }
            />
            {farmQ.data ? (
              <DataSourceBadge
                source={farmQ.data.source}
                fetchedAt={farmQ.data.fetchedAt}
                className="shrink-0"
              />
            ) : null}
          </div>
        </div>

        {farmQ.isPending ? (
          <LoadingSkeleton variant="text" lines={2} className="relative mt-6" />
        ) : farmQ.isError ? (
          <ErrorState
            className="relative mt-6"
            title="Farm details unavailable"
            description="We couldn't load your farm profile."
            onRetry={() => void farmQ.refetch()}
          />
        ) : !farm ? (
          <div className="relative mt-6 rounded-xl border border-dashed border-border bg-muted/20 p-6 text-center">
            <Sprout className="mx-auto size-10 text-muted-foreground/60" />
            <h3 className="mt-3 text-base font-medium text-foreground">No farms registered yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Register your farm details to get tailored soil insights and AI crop recommendations.
            </p>
            <div className="mt-4 flex justify-center">
              <CreateFarmDialog
                trigger={
                  <Button size="sm" className="gap-1.5">
                    <Plus className="size-4" />
                    Register Your Farm
                  </Button>
                }
              />
            </div>
          </div>
        ) : (
          <dl className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Fact icon={Sprout} label="Farm" value={farm.name} />
            <Fact icon={MapPin} label="Location" value={farm.location} />
            <Fact icon={Ruler} label="Land area" value={farm.landAreaAcres} unit="acres" />
            <Fact icon={Compass} label="Current crop" value={farm.currentCrop} />
          </dl>
        )}
      </section>

      {/* 2 & 3 — Weather + soil status */}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {weatherQ.isPending ? (
          <LoadingSkeleton lines={4} />
        ) : weatherQ.isError || !weatherQ.data ? (
          <ErrorState
            title="Weather information is currently unavailable"
            description="No weather values are shown until live data can be fetched."
            onRetry={() => void weatherQ.refetch()}
          />
        ) : (
          <WeatherCard
            weather={weatherQ.data.data}
            source={weatherQ.data.source}
            fetchedAt={weatherQ.data.fetchedAt}
            onWeatherUpdated={(updated, src) => {
              queryClient.setQueryData(["weather", farmId], {
                data: updated,
                source: src,
                fetchedAt: updated.observedAt,
              });
            }}
          />
        )}

        {soilQ.isPending ? (
          <LoadingSkeleton lines={5} />
        ) : soilQ.isError || !soilQ.data ? (
          <ErrorState
            title="Soil information unavailable"
            description="We couldn't reach your soil records."
            onRetry={() => void soilQ.refetch()}
          />
        ) : (
          <SoilStatusCard
            status={soilQ.data.data}
            source={soilQ.data.source}
            fetchedAt={soilQ.data.fetchedAt}
            action={
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm">
                  <Link to="/soil-testing">
                    <FlaskConical className="size-4" /> Find soil testing
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/soil-testing">
                    <FileCheck2 className="size-4" /> I have a soil report
                  </Link>
                </Button>
              </div>
            }
          />
        )}
      </div>

      {/* 5 — Soil testing CTA band */}
      {!soilQ.isPending && !hasReport ? (
        <section className="mt-6 overflow-hidden rounded-2xl border border-primary/25 bg-accent/25 p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Don't know your NPK or soil pH?
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                Get your soil tested
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                That's okay — you don't need to know these technical values yourself. AgriSmart
                connects you to nearby testing centres; the laboratory does the testing.
              </p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-3">
                {[
                  "Know your soil better",
                  "Get tested NPK and pH information",
                  "Use the report for better recommendations",
                ].map((point) => (
                  <li key={point} className="flex items-start gap-2 text-sm text-foreground">
                    <CheckCircle2
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-primary"
                    />
                    <span className="min-w-0">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
            <Button asChild size="lg" className="w-full lg:w-auto">
              <Link to="/soil-testing">
                Find soil testing <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </section>
      ) : null}

      {/* 6 & 7 — Recommendation + always-visible explanation (synced with Active Farm Plan) */}
      <section className="mt-8" aria-labelledby="ai-rec-title">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-md border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${
                  isDemoActive
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                    : isHybridActive
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-blue-500/25 bg-blue-500/10 text-blue-700 dark:text-blue-300"
                }`}
              >
                {isDemoActive
                  ? "[DEMO HYBRID — ILLUSTRATIVE]"
                  : isHybridActive
                    ? "[HYBRID: RULE-BASED + ML]"
                    : "[RULE-BASED ONLY — ML UNAVAILABLE]"}
              </span>
              <span className="text-xs text-muted-foreground">
                Active Plan: {planSummary.planInput.name || "Active Farm Plan"} ·{" "}
                {planSummary.planInput.soilType} soil · {planSummary.planInput.water} water units
                {mlLoading ? " · Refreshing /api/predict…" : ""}
              </span>
            </div>
            <h2 id="ai-rec-title" className="mt-2 text-xl font-semibold tracking-tight sm:text-2xl">
              Crop recommendation for your active farm plan
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Synced across Dashboard, Recommendations, and Compare Crops —{" "}
              {isHybridActive
                ? "combining Agronomic Rule suitability and 200-tree Random Forest rankings via Constraint-Aware Reciprocal Rank Fusion."
                : "showing Rule-Based agronomic suitability separately because required ML inputs are incomplete, out of range, or unavailable."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/recommendations">
                Hybrid & engine details <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link to="/recommendations/compare">Compare crops</Link>
            </Button>
          </div>
        </div>

        {isDemoActive ? (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-300">
            <span className="font-semibold">DEMO / ILLUSTRATIVE BENCHMARK PROFILE:</span> ML scores
            in this ranking come from sample benchmark inputs loaded into your active plan, not
            verified field or laboratory measurements.
          </div>
        ) : null}

        {mlServiceError ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-xs text-destructive">
            <div>
              <span className="font-semibold">ML prediction service unavailable:</span>{" "}
              {mlServiceError}. Showing Rule-Based agronomic recommendations only without claiming a
              hybrid result.
            </div>
            <Button size="sm" variant="outline" onClick={refetchMl}>
              Retry ML service
            </Button>
          </div>
        ) : !isHybridActive ? (
          <div className="mt-4 rounded-xl border border-blue-500/25 bg-blue-500/5 p-3.5 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Single-source Rule-Based mode:</span>{" "}
            {hybrid.mlStatusMessage}
          </div>
        ) : null}

        {!activePlan && farmQ.isPending ? (
          <LoadingSkeleton className="mt-5" lines={5} />
        ) : !dashboardRecView || !topPrimary ? (
          <EmptyState
            className="mt-5"
            icon={Sprout}
            title="No candidate crops matched your active plan"
            description="Adjust soil texture or water availability in your active farm plan to evaluate suitable crops."
            action={
              <Button asChild size="sm">
                <Link to="/recommendations">Adjust Active Farm Plan</Link>
              </Button>
            }
          />
        ) : (
          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <RecommendationCard
              recommendation={dashboardRecView.top}
              source={recDataSource}
              fetchedAt={activePlan?.submittedAt}
              scoreLabelPrefix={recScorePrefix}
              className="lg:row-span-2"
              footer={
                <div className="space-y-4">
                  <dl className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-secondary/60 p-3">
                      <dt className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                        ML feature readiness
                      </dt>
                      <dd className="mt-1 text-sm font-semibold">
                        <MetricValue
                          value={`${planSummary.availableMlLabels.length}/7 (${dashboardRecView.dataCompletenessPct ?? 0}%)`}
                        />
                      </dd>
                    </div>
                    <div className="rounded-xl bg-secondary/60 p-3">
                      <dt className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                        Active method
                      </dt>
                      <dd className="mt-1 text-sm font-semibold">
                        <MetricValue
                          value={
                            isDemoActive
                              ? "Demo Hybrid (CA-RRF)"
                              : isHybridActive
                                ? "Hybrid (CA-RRF)"
                                : "Rule-Based Only"
                          }
                        />
                      </dd>
                    </div>
                  </dl>
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link
                      to="/cultivation/$crop"
                      params={{ crop: getCropGuideSlug(dashboardRecView.top.crop) }}
                    >
                      View cultivation guide <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              }
            />

            <ExplanationPanel
              result={dashboardRecView}
              source={recDataSource}
              fetchedAt={activePlan?.submittedAt}
            />

            {/* 8 & 9 — data used / still needed */}
            <div className="card-surface p-5">
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Data used for this recommendation
              </h3>
              {dashboardRecView.dataUsed.length ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {dashboardRecView.dataUsed.map((d) => (
                    <li
                      key={d}
                      className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-foreground"
                    >
                      <CheckCircle2 aria-hidden="true" className="size-3.5 shrink-0 text-primary" />
                      <span className="min-w-0">{d}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">Not available.</p>
              )}

              <h3 className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Information still needed for Random Forest ML
              </h3>
              {dashboardRecView.dataMissing.length ? (
                <>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {dashboardRecView.dataMissing.map((d) => (
                      <li
                        key={d}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground"
                      >
                        <TriangleAlert aria-hidden="true" className="size-3.5 shrink-0" />
                        <span className="min-w-0">{d}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    Hourly weather precipitation is never substituted for cumulative seasonal
                    rainfall. Supply missing laboratory or seasonal rainfall measurements on the
                    Recommendations page to unlock Random Forest predictions.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link to="/recommendations">Supply ML inputs</Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/soil-testing">
                        <FlaskConical className="size-4" /> Get soil tested
                      </Link>
                    </Button>
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  All 7 required ML features are present and within valid bounds.
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 10 — Alternatives */}
      {dashboardRecView && dashboardRecView.alternatives.length > 0 ? (
        <section className="mt-8" aria-labelledby="alt-crops-title">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <h2 id="alt-crops-title" className="min-w-0 text-lg font-semibold tracking-tight">
              Other crops that suit your active plan
            </h2>
            <Button asChild size="sm" variant="ghost" className="shrink-0">
              <Link to="/recommendations/compare">
                Compare crops <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {dashboardRecView.alternatives.map((alt, i) => (
              <RecommendationCard
                key={alt.crop}
                recommendation={alt}
                variant="compact"
                source={recDataSource}
                fetchedAt={activePlan?.submittedAt}
                scoreLabelPrefix={recScorePrefix}
                footer={
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Alternative #{i + 1}
                  </p>
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* 11 — Next action */}
      <section className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Recommended next step
        </p>
        {!hasReport ? (
          <>
            <p className="mt-2 text-lg font-semibold tracking-tight">
              Get your soil tested to improve your crop recommendation.
            </p>
            <Button asChild className="mt-4">
              <Link to="/soil-testing">
                Find soil testing <ArrowRight className="size-4" />
              </Link>
            </Button>
          </>
        ) : dashboardRecView ? (
          <>
            <p className="mt-2 text-lg font-semibold tracking-tight">
              Ready to learn how to grow {dashboardRecView.top.crop}?
            </p>
            <Button asChild className="mt-4">
              <Link
                to="/cultivation/$crop"
                params={{ crop: getCropGuideSlug(dashboardRecView.top.crop) }}
              >
                View cultivation guide <ArrowRight className="size-4" />
              </Link>
            </Button>
          </>
        ) : (
          <>
            <p className="mt-2 text-lg font-semibold tracking-tight">
              Your soil information is ready.
            </p>
            <Button asChild className="mt-4">
              <Link to="/recommendations">
                View recommendations <ArrowRight className="size-4" />
              </Link>
            </Button>
          </>
        )}
      </section>

      <PlanningPanel currentWeather={weatherQ.data?.data} defaultFarmName={farm?.name} />
    </div>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
  unit,
}: {
  icon: typeof Sprout;
  label: string;
  value: string | number | null;
  unit?: string;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border/70 bg-background/60 p-3">
      <dt className="flex items-center gap-1.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </dt>
      <dd className="mt-1 truncate text-sm font-semibold">
        <MetricValue value={value} unit={unit ?? null} />
      </dd>
    </div>
  );
}

/**
 * Existing offline planning tool — preserved so History keeps working.
 * No NPK / pH inputs are required anywhere here.
 */
/**
 * Planning and crop recommendation testing panel.
 * - General Farm Plan: Agronomic rule-based matching using soil texture, water availability,
 *   land area, budget, duration, and optional ambient weather. Does not require NPK or pH.
 * - Laboratory & Weather (ML): Genuine Random Forest predictions when all 7 verified parameters
 *   (N, P, K, pH, Temperature, Humidity, Rainfall) are provided. Does NOT use fake defaults.
 */
function PlanningPanel({
  currentWeather,
  defaultFarmName,
}: {
  currentWeather?: Weather | undefined;
  defaultFarmName?: string | undefined;
}) {
  const t = useT();
  const [form, setForm] = useState<FarmInput>(() => {
    const saved = loadActivePlan();
    if (saved?.input) return saved.input;
    return { ...EMPTY, name: defaultFarmName ?? "" };
  });
  const [useLabFeatures, setUseLabFeatures] = useState<boolean>(() => {
    const saved = loadActivePlan();
    return Boolean(saved?.labFeatures && areMlFeaturesComplete(saved.labFeatures));
  });
  const [isDemoProfile, setIsDemoProfile] = useState<boolean>(
    () => loadActivePlan()?.isDemoProfile ?? false,
  );
  const [labFeatures, setLabFeatures] = useState<Partial<MlPredictionFeatures>>(
    () => loadActivePlan()?.labFeatures ?? {},
  );
  const [results, setResults] = useState<Recommendation[] | null>(null);
  const [missingFeaturesNotice, setMissingFeaturesNotice] = useState<string | null>(null);

  useEffect(() => {
    const syncFromPlan = () => {
      const saved = loadActivePlan();
      if (!saved) return;
      setForm(saved.input);
      setLabFeatures(saved.labFeatures ?? {});
      setIsDemoProfile(Boolean(saved.isDemoProfile));
    };
    window.addEventListener("agrismart:activePlan", syncFromPlan);
    window.addEventListener("storage", syncFromPlan);
    return () => {
      window.removeEventListener("agrismart:activePlan", syncFromPlan);
      window.removeEventListener("storage", syncFromPlan);
    };
  }, []);

  useEffect(() => {
    if (defaultFarmName && !form.name && !loadActivePlan()?.input?.name) {
      setForm((prev) => (prev.name ? prev : { ...prev, name: defaultFarmName }));
    }
  }, [defaultFarmName, form.name]);

  const update = <K extends keyof FarmInput>(key: K, value: FarmInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const updateLab = (key: keyof MlPredictionFeatures, val: string) => {
    setIsDemoProfile(false);
    setLabFeatures((prev) => {
      const next: Partial<MlPredictionFeatures> = { ...prev };
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
      return next;
    });
  };

  const loadBenchmarkDemoProfile = () => {
    setLabFeatures({
      N: 90,
      P: 42,
      K: 43,
      temperature: 21,
      humidity: 82,
      ph: 6.5,
      rainfall: 202,
    });
    setIsDemoProfile(true);
    setMissingFeaturesNotice(null);
    toast.info("Sample benchmark training profile loaded for testing.");
  };

  const loadCurrentWeatherIntoLab = () => {
    if (!currentWeather || currentWeather.temperatureC == null) {
      toast.error("Current weather temperature is not available from the weather service.");
      return;
    }
    setLabFeatures((prev) => {
      const next: Partial<MlPredictionFeatures> = { ...prev };
      if (currentWeather.temperatureC != null) {
        next.temperature = currentWeather.temperatureC;
      }
      if (currentWeather.humidityPct != null) {
        next.humidity = currentWeather.humidityPct;
      }
      // Deliberately never copy currentWeather.rainfallMm (1-hour station rain) into next.rainfall
      return next;
    });
    toast.success(
      "Loaded ambient temperature & humidity from weather station. Enter seasonal rainfall separately.",
    );
  };

  const clearLabFields = () => {
    setLabFeatures({});
    setIsDemoProfile(false);
    setResults(null);
    setMissingFeaturesNotice(null);
  };

  const [isSubmittingMl, setIsSubmittingMl] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMissingFeaturesNotice(null);

    if (!form.landArea || form.landArea <= 0) {
      toast.error("Please enter a valid land area in acres.");
      return;
    }
    if (form.water < 0) {
      toast.error("Please enter a valid water availability number.");
      return;
    }

    if (useLabFeatures) {
      if (!areMlFeaturesComplete(labFeatures)) {
        setResults(null);
        const missingLabels = getMissingMlFeatureLabels(labFeatures);
        const outOfRangeLabels = getOutOfRangeMlFeatureLabels(labFeatures);
        const parts: string[] = [];
        if (missingLabels.length > 0) parts.push(`missing ${missingLabels.join(", ")}`);
        if (outOfRangeLabels.length > 0)
          parts.push(`out of valid range: ${outOfRangeLabels.join(", ")}`);

        setMissingFeaturesNotice(
          `Laboratory soil & seasonal data invalid (${parts.join("; ")}). Genuine Random Forest inference requires all 7 verified parameters within valid bounds. Enter valid measurements, load a sample profile for demo evaluation, switch to 'General Farm Plan', or book a soil test.`,
        );
        toast.error(
          outOfRangeLabels.length > 0
            ? "One or more laboratory features are outside valid bounds."
            : "Incomplete laboratory features for ML recommendation.",
        );
        return;
      }

      setIsSubmittingMl(true);
      try {
        let livePred = null;
        let serviceErr: string | null = null;
        try {
          livePred = await predictionService.predict(labFeatures);
        } catch (err) {
          serviceErr = err instanceof Error ? err.message : "Prediction API failed";
        }

        const nextPlanInput: FarmInput = {
          ...form,
          mlFeatures: labFeatures,
          weather: currentWeather
            ? {
                temperature: currentWeather.temperatureC,
                humidity: currentWeather.humidityPct,
              }
            : undefined,
        };

        const hybridOut = computeHybridRecommendations({
          planInput: nextPlanInput,
          mlFeatures: labFeatures,
          mlPrediction: livePred,
          mlServiceError: serviceErr,
          allowLocalForestFallback: serviceErr === null,
          localForestPredict: (f) =>
            predictWithLocalForest(f as unknown as Record<string, number>)?.ranked ?? null,
          isDemoProfile,
        });

        saveActivePlan({
          input: nextPlanInput,
          labFeatures,
          isDemoProfile,
          linkedSoilReport: isDemoProfile ? undefined : loadActivePlan()?.linkedSoilReport,
          submittedAt: new Date().toISOString(),
        });

        setResults(hybridOut.recommendations);
        if (serviceErr) {
          toast.warning(
            `ML prediction service failed (${serviceErr}); showing Rule-Based agronomic recommendations only.`,
          );
        } else {
          toast.success(
            `Hybrid recommendations updated (#1: ${hybridOut.recommendations[0]?.crop ?? "Top match"})`,
          );
        }
      } finally {
        setIsSubmittingMl(false);
      }
    } else {
      // General Farm Plan path (Rule-Based only)
      const planInput: FarmInput = {
        ...form,
        mlFeatures: undefined,
        weather: currentWeather
          ? {
              temperature: currentWeather.temperatureC,
              humidity: currentWeather.humidityPct,
            }
          : undefined,
      };

      const preds = generatePlanningSimulation(planInput);
      if (!preds || preds.length === 0) {
        setResults(null);
        setMissingFeaturesNotice(
          `No crop in the agronomic catalog met the requirements for ${form.soilType} soil and ${form.water} units water. Try adjusting water availability or testing a different soil type.`,
        );
        toast.info("No candidate crops found for these constraints.");
        return;
      }

      const existingPlan = loadActivePlan();
      const preservedLab =
        Object.keys(labFeatures).length > 0 ? labFeatures : existingPlan?.labFeatures;
      saveActivePlan({
        input: planInput,
        labFeatures:
          preservedLab && Object.keys(preservedLab).length > 0 ? preservedLab : undefined,
        isDemoProfile:
          Object.keys(labFeatures).length > 0 ? isDemoProfile : existingPlan?.isDemoProfile,
        linkedSoilReport: existingPlan?.linkedSoilReport,
        submittedAt: new Date().toISOString(),
      });
      setResults(preds);
      toast.success(`Generated ${preds.length} agronomic farm-planning recommendations`);
    }
  };

  return (
    <section className="mt-10 border-t border-border/70 pt-8" aria-labelledby="planning-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="planning-title" className="text-lg font-semibold tracking-tight">
            Plan a season & test crop recommendations
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Plan your upcoming season using your soil type and irrigation capacity, or run the
            genuine Random Forest model with verified laboratory test measurements.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={!useLabFeatures ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setUseLabFeatures(false);
              setResults(null);
              setMissingFeaturesNotice(null);
            }}
          >
            General Farm Plan
          </Button>
          <Button
            type="button"
            variant={useLabFeatures ? "default" : "outline"}
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setUseLabFeatures(true);
              setResults(null);
              setMissingFeaturesNotice(null);
            }}
          >
            <Sparkles className="size-3.5" />
            Laboratory & Weather (ML)
          </Button>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,440px)_1fr]">
        <form className="card-surface h-fit space-y-4 p-5" onSubmit={handleGenerate}>
          <div className="space-y-2">
            <Label htmlFor="name">Farm / Farmer Name</Label>
            <Input
              id="name"
              required
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Ramesh Patel"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="land">Land area (acres)</Label>
              <Input
                id="land"
                type="number"
                min={0.1}
                step={0.1}
                value={form.landArea}
                onChange={(e) => update("landArea", Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="soil">Soil type</Label>
              <Select
                value={form.soilType}
                onValueChange={(v) => update("soilType", v as SoilType)}
              >
                <SelectTrigger id="soil">
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
          </div>

          {useLabFeatures ? (
            <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
                  <FlaskConical className="size-3.5" />
                  Verified Laboratory & Weather Measurements
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                The 200-tree Random Forest evaluates these 7 specific features. Default values are
                not assumed; enter verified measurements or load a demo profile.
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={loadBenchmarkDemoProfile}
                >
                  <Sparkles className="size-3" />
                  Load Sample Benchmark Profile (Demo)
                </Button>
                {currentWeather && currentWeather.temperatureC != null ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={loadCurrentWeatherIntoLab}
                  >
                    <CloudSun className="size-3" />
                    Use Current Weather ({currentWeather.temperatureC}°C)
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1 text-muted-foreground"
                  onClick={clearLabFields}
                >
                  <RotateCcw className="size-3" />
                  Clear
                </Button>
              </div>

              {isDemoProfile ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
                  <span className="font-semibold">Illustrative Demo Profile Loaded:</span> These
                  values are from benchmark training samples and do not represent your field.
                </div>
              ) : null}

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="ml-n" className="text-xs">
                    N (kg/ha)
                  </Label>
                  <Input
                    id="ml-n"
                    type="number"
                    step="0.1"
                    min="0"
                    max="300"
                    placeholder="e.g. 90"
                    value={labFeatures.N ?? ""}
                    onChange={(e) => updateLab("N", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ml-p" className="text-xs">
                    P (kg/ha)
                  </Label>
                  <Input
                    id="ml-p"
                    type="number"
                    step="0.1"
                    min="0"
                    max="300"
                    placeholder="e.g. 42"
                    value={labFeatures.P ?? ""}
                    onChange={(e) => updateLab("P", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ml-k" className="text-xs">
                    K (kg/ha)
                  </Label>
                  <Input
                    id="ml-k"
                    type="number"
                    step="0.1"
                    min="0"
                    max="300"
                    placeholder="e.g. 43"
                    value={labFeatures.K ?? ""}
                    onChange={(e) => updateLab("K", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="ml-ph" className="text-xs">
                    Soil pH
                  </Label>
                  <Input
                    id="ml-ph"
                    type="number"
                    step="0.1"
                    min="0"
                    max="14"
                    placeholder="e.g. 6.5"
                    value={labFeatures.ph ?? ""}
                    onChange={(e) => updateLab("ph", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ml-temp" className="text-xs">
                    Temperature (°C)
                  </Label>
                  <Input
                    id="ml-temp"
                    type="number"
                    step="0.1"
                    placeholder="e.g. 25"
                    value={labFeatures.temperature ?? ""}
                    onChange={(e) => updateLab("temperature", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="ml-hum" className="text-xs">
                    Humidity (%)
                  </Label>
                  <Input
                    id="ml-hum"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    placeholder="e.g. 75"
                    value={labFeatures.humidity ?? ""}
                    onChange={(e) => updateLab("humidity", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ml-rain" className="text-xs">
                    Seasonal Rainfall (mm)
                  </Label>
                  <Input
                    id="ml-rain"
                    type="number"
                    step="0.1"
                    min="0"
                    max="1000"
                    placeholder="e.g. 150"
                    value={labFeatures.rainfall ?? ""}
                    onChange={(e) => updateLab("rainfall", e.target.value)}
                  />
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground italic">
                * Note: Current weather provides ambient temperature and humidity only; it is not a
                substitute for seasonal cumulative rainfall or laboratory soil chemistry.
              </p>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="water">Water available (units)</Label>
              <Input
                id="water"
                type="number"
                min={0}
                value={form.water}
                onChange={(e) => update("water", Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="budget">Budget (₹)</Label>
              <Input
                id="budget"
                type="number"
                min={0}
                value={form.budget}
                onChange={(e) => update("budget", Number(e.target.value))}
              />
            </div>
          </div>

          {!useLabFeatures ? (
            <div className="rounded-lg border border-border/80 bg-muted/40 p-3 text-xs text-muted-foreground space-y-1.5">
              <div className="flex items-start gap-2">
                <Info className="size-4 shrink-0 text-muted-foreground mt-0.5" />
                <span>
                  <strong>General Farm Plan:</strong> Evaluates candidate crops against documented
                  soil texture, irrigation requirements, and duration. Laboratory NPK and pH values
                  are not required.
                </span>
              </div>
              {currentWeather && currentWeather.temperatureC != null ? (
                <div className="text-[11px] text-muted-foreground pl-6">
                  Weather station detected: {currentWeather.temperatureC}°C,{" "}
                  {currentWeather.humidityPct ?? "--"}% humidity.
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="crop">Preferred crop (Optional)</Label>
            <Input
              id="crop"
              value={form.preferredCrop}
              onChange={(e) => update("preferredCrop", e.target.value)}
              placeholder="e.g. Maize, Cotton, Rice, Pigeonpea"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={2}
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Past crops, canal access, regional observations…"
            />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmittingMl}>
            {isSubmittingMl
              ? "Evaluating Rule + ML Hybrid Ranking…"
              : useLabFeatures
                ? isDemoProfile
                  ? "Execute Hybrid Ranking on Sample Profile"
                  : "Execute Hybrid (Rule + ML) Recommendation"
                : "Generate Rule-Based Farm Plan"}
          </Button>
        </form>

        <div className="space-y-4">
          {missingFeaturesNotice ? (
            <div className="card-surface p-6">
              <div className="flex items-start gap-3">
                <TriangleAlert className="size-5 shrink-0 text-amber-500 mt-0.5" />
                <div className="space-y-3">
                  <h3 className="text-base font-semibold">
                    {useLabFeatures ? "Laboratory Soil Data Incomplete" : "Information Notice"}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {missingFeaturesNotice}
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button asChild size="sm">
                      <Link to="/soil-testing">Find a Testing Centre</Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setUseLabFeatures(false);
                        setMissingFeaturesNotice(null);
                      }}
                    >
                      Switch to General Farm Plan
                    </Button>
                    {useLabFeatures ? (
                      <Button size="sm" variant="secondary" onClick={loadBenchmarkDemoProfile}>
                        Load Sample Benchmark Profile
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : !results ? (
            <EmptyState
              icon={Sprout}
              title="No recommendations generated yet"
              description="Fill in your farm parameters and click 'Generate Rule-Based Farm Plan' or include verified Laboratory & Weather measurements for Hybrid (Rule + ML) ranking."
            />
          ) : (
            <>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <div>
                  <h3 className="min-w-0 truncate text-base font-semibold">
                    {results[0]?.source === "HYBRID"
                      ? "Hybrid (Rule + ML) Recommendations"
                      : results[0]?.source === "DEMO / ILLUSTRATIVE"
                        ? "Demo Hybrid Recommendations"
                        : "Rule-Based Farm Plan Recommendations"}{" "}
                    for {form.name || "your farm"}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {results[0]?.source === "HYBRID" || results[0]?.source === "DEMO / ILLUSTRATIVE"
                      ? "Ranked via Constraint-Aware Reciprocal Rank Fusion (Agronomic Rules + 200-tree Random Forest; incompatible score scales are never averaged)."
                      : "Ranked by agronomic suitability using documented soil, water, and duration requirements."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => {
                      const savedInput: FarmInput = {
                        ...form,
                        mlFeatures: useLabFeatures ? labFeatures : undefined,
                        weather: currentWeather
                          ? {
                              temperature: currentWeather.temperatureC,
                              humidity: currentWeather.humidityPct,
                            }
                          : undefined,
                      };
                      const hasHybrid = results.some(
                        (r) => r.source === "HYBRID" || r.source === "DEMO / ILLUSTRATIVE",
                      );
                      historyService.save({
                        id: crypto.randomUUID(),
                        createdAt: new Date().toISOString(),
                        input: savedInput,
                        recommendations: results,
                        hybridMode: hasHybrid
                          ? isDemoProfile
                            ? "demo-hybrid"
                            : "hybrid"
                          : "rule-only",
                        sourcesUsed: hasHybrid
                          ? ["RULE-BASED", isDemoProfile ? "DEMO / ILLUSTRATIVE" : "ML MODEL"]
                          : ["RULE-BASED"],
                        featuresUsed:
                          useLabFeatures && areMlFeaturesComplete(labFeatures)
                            ? labFeatures
                            : undefined,
                        disclaimer: hasHybrid
                          ? isDemoProfile
                            ? "Demo hybrid ranking: combines agronomic rules with illustrative benchmark ML scores via ordinal Reciprocal Rank Fusion."
                            : "Hybrid ranking combines agronomic rules with uncalibrated 200-tree Random Forest scores via ordinal Reciprocal Rank Fusion."
                          : "Agronomic rule-based matching using documented soil and water requirements. Laboratory NPK/pH not tested.",
                      });
                      toast.success("Saved recommendations to history");
                    }}
                  >
                    <Save className="size-4" /> Save
                  </Button>
                  <Button asChild size="sm" variant="default" className="gap-1.5 shrink-0">
                    <Link to="/recommendations">
                      View Details
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>

              {results.map((r, idx) => (
                <article key={`${r.crop}-${idx}`} className="card-surface p-5">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {r.overallRank != null ? (
                      <span className="inline-flex size-7 items-center justify-center rounded-lg bg-primary/10 font-mono text-xs font-bold text-primary">
                        #{r.overallRank}
                      </span>
                    ) : null}
                    <h4 className="text-lg font-semibold">{r.crop}</h4>
                    <span
                      className={`rounded-md px-2.5 py-0.5 text-[11px] font-semibold tracking-wide border ${
                        r.source === "HYBRID" || r.source === "ML MODEL"
                          ? "bg-primary/10 border-primary/20 text-primary"
                          : r.source === "DEMO / ILLUSTRATIVE"
                            ? "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300"
                            : "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300"
                      }`}
                    >
                      [{r.source}]
                    </span>
                    <div className="ml-auto flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {r.suitabilityScore != null ? (
                        <span className="inline-flex items-center gap-1">
                          <BadgeCheck className="size-3.5 text-blue-600 dark:text-blue-400" />
                          Rule: {r.suitabilityScore}%
                        </span>
                      ) : null}
                      {r.voteSharePct != null ? (
                        <span className="inline-flex items-center gap-1">
                          <BadgeCheck className="size-3.5 text-primary" />
                          ML: {r.voteSharePct}% uncalibrated
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {r.rationale}
                  </p>

                  {r.matchingFactors && r.matchingFactors.length > 0 ? (
                    <div className="mt-3 space-y-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Matching Factors:
                      </p>
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        {r.matchingFactors.map((factor, fIdx) => (
                          <li key={fIdx} className="flex items-start gap-1.5">
                            <CheckCircle2 className="size-3.5 text-primary mt-0.5 shrink-0" />
                            <span>{factor}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {r.waterNeed ? (
                      <Stat
                        icon={<Droplets className="size-4" />}
                        label="Water requirement (Catalog)"
                        value={r.waterNeed}
                      />
                    ) : null}
                    {r.growthDurationDays ? (
                      <Stat
                        icon={<Sprout className="size-4" />}
                        label="Duration (Catalog)"
                        value={`${r.growthDurationDays} days`}
                      />
                    ) : null}
                  </div>

                  {r.economicNote ? (
                    <div className="mt-3 rounded-xl border border-border/70 bg-secondary/40 p-3 text-xs text-muted-foreground">
                      <p className="font-semibold text-foreground">Economic & Budget Evaluation:</p>
                      <p className="mt-1 leading-relaxed">{r.economicNote}</p>
                    </div>
                  ) : null}

                  {r.limitations && r.limitations.length > 0 ? (
                    <div className="mt-2 text-[11px] text-muted-foreground">
                      <span className="font-semibold text-foreground/80">
                        Documented limitations:{" "}
                      </span>
                      {r.limitations.join(" • ")}
                    </div>
                  ) : null}

                  {r.note ? (
                    <p className="mt-2 text-xs italic text-muted-foreground">* {r.note}</p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link to="/cultivation/$crop" params={{ crop: getCropGuideSlug(r.crop) }}>
                        View Cultivation Guide
                      </Link>
                    </Button>
                  </div>
                </article>
              ))}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-secondary p-3">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        <span className="truncate">{label}</span>
      </dt>
      <dd className="mt-1 text-sm font-semibold">{value}</dd>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Columns3,
  Cpu,
  Layers,
  Leaf,
  Sparkles,
  Star,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { StatusBadge } from "@/components/common/StatusBadge";
import { MetricValue } from "@/components/agri/value";
import { Button } from "@/components/ui/button";
import { useMlPrediction } from "@/hooks/use-ml-prediction";
import {
  areMlFeaturesComplete,
  derivePlanComparisonCrops,
  extractMlFeaturesFromSoilParameters,
  getMissingMlFeatureLabels,
  getOutOfRangeMlFeatureLabels,
  loadActivePlan,
  type ActivePlanState,
  type ComparedCropItem,
  type FarmInput,
  type MlPredictionFeatures,
} from "@/lib/agri";
import { farmsService, soilService, weatherService } from "@/services";

export const Route = createFileRoute("/recommendations/compare")({
  head: () => ({
    meta: [
      { title: "Compare Crops — AgriSmart" },
      {
        name: "description",
        content:
          "Compare the crops suggested for your active farm plan side by side before you decide.",
      },
      { property: "og:title", content: "Compare Crops — AgriSmart" },
      {
        property: "og:description",
        content:
          "Suitability, water need, duration and score for every crop in your active farm plan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "/recommendations/compare" }],
  }),
  component: ComparePage,
});

function getComparisonRows(mode: "hybrid" | "rule" | "ml"): {
  label: string;
  get: (c: ComparedCropItem) => { value: number | string | null; unit?: string };
}[] {
  if (mode === "hybrid") {
    return [
      {
        label: "Overall rank",
        get: (c) => ({ value: c.overallRank != null ? `#${c.overallRank}` : null }),
      },
      { label: "Engine consensus", get: (c) => ({ value: c.suitability ?? null }) },
      {
        label: "Rule-Based compatibility",
        get: (c) => ({ value: c.ruleCompatibilityPct ?? null, unit: "%" }),
      },
      {
        label: "ML uncalibrated score",
        get: (c) => ({ value: c.mlUncalibratedScorePct ?? null, unit: "%" }),
      },
      { label: "Soil evaluation", get: (c) => ({ value: c.soilSuitability }) },
      { label: "Water requirement", get: (c) => ({ value: c.waterRequirement }) },
      { label: "Growing duration", get: (c) => ({ value: c.growthDurationDays, unit: "days" }) },
      { label: "Crop category", get: (c) => ({ value: c.complexity }) },
      { label: "Hybrid ranking rationale", get: (c) => ({ value: c.hybridRationale ?? null }) },
    ];
  }

  return [
    { label: "Overall suitability", get: (c) => ({ value: c.suitability ?? null }) },
    {
      label: mode === "ml" ? "Uncalibrated model score" : "Agronomic compatibility",
      get: (c) => ({ value: c.confidencePct ?? null, unit: "%" }),
    },
    { label: "Soil evaluation", get: (c) => ({ value: c.soilSuitability }) },
    { label: "Climate context", get: (c) => ({ value: c.weatherSuitability }) },
    { label: "Water requirement", get: (c) => ({ value: c.waterRequirement }) },
    { label: "Growing duration", get: (c) => ({ value: c.growthDurationDays, unit: "days" }) },
    { label: "Crop category", get: (c) => ({ value: c.complexity }) },
  ];
}

function ComparePage() {
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

  const effectiveLabFeatures: Partial<MlPredictionFeatures> = useMemo(() => {
    if (activePlan?.labFeatures && Object.keys(activePlan.labFeatures).length > 0) {
      return activePlan.labFeatures;
    }
    const soilParams = soilQ.data?.data?.parameters;
    if (soilParams && soilParams.length > 0) {
      return extractMlFeaturesFromSoilParameters(soilParams, weatherQ.data?.data, null).features;
    }
    return {};
  }, [activePlan, soilQ.data, weatherQ.data]);

  const { mlPrediction, mlServiceError, allowLocalForestFallback, refetchMl } =
    useMlPrediction(effectiveLabFeatures);

  const isDemoProfile = Boolean(activePlan?.isDemoProfile);
  const mlComplete = areMlFeaturesComplete(effectiveLabFeatures);
  const missingMlLabels = useMemo(
    () => getMissingMlFeatureLabels(effectiveLabFeatures),
    [effectiveLabFeatures],
  );
  const outOfRangeMlLabels = useMemo(
    () => getOutOfRangeMlFeatureLabels(effectiveLabFeatures),
    [effectiveLabFeatures],
  );

  const [comparisonMode, setComparisonMode] = useState<"hybrid" | "rule" | "ml">("hybrid");

  const crops = useMemo(
    () =>
      derivePlanComparisonCrops({
        planInput: currentPlanInput,
        labFeatures: effectiveLabFeatures,
        mlPrediction,
        mlServiceError,
        allowLocalForestFallback,
        isDemoProfile,
        mode: comparisonMode,
      }),
    [
      currentPlanInput,
      effectiveLabFeatures,
      mlPrediction,
      mlServiceError,
      allowLocalForestFallback,
      isDemoProfile,
      comparisonMode,
    ],
  );

  const rows = useMemo(() => getComparisonRows(comparisonMode), [comparisonMode]);
  const isInitialLoading = !activePlan && farmQ.isPending;
  const hybridReallyActive =
    comparisonMode === "hybrid" &&
    crops.some((c) => c.source === "HYBRID" || c.source === "DEMO / ILLUSTRATIVE");

  return (
    <div className="space-y-6 pb-4">
      <PageHeader
        eyebrow="Recommendations"
        title="Compare Crops"
        description="Side-by-side comparison of candidate crops evaluated from your active farm plan."
        icon={Columns3}
        source={
          (comparisonMode === "ml" || hybridReallyActive) && isDemoProfile
            ? "demo"
            : mlPrediction?.runtime === "fastapi" && (comparisonMode === "ml" || hybridReallyActive)
              ? "api"
              : "artifact"
        }
        fetchedAt={activePlan?.submittedAt}
        actions={
          <Button asChild size="sm" variant="outline">
            <Link to="/recommendations">
              <ArrowLeft aria-hidden="true" className="size-4" />
              Back to Recommendations
            </Link>
          </Button>
        }
      />

      {/* Active Farm Plan Context & Engine Selector */}
      <section className="card-surface p-5 space-y-4" aria-label="Active farm plan context">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                Active Farm Plan
              </span>
              <h2 className="text-sm font-semibold text-foreground">
                {currentPlanInput.name || "Active Farm Plan"} · {currentPlanInput.soilType} soil ·{" "}
                {currentPlanInput.landArea} acres · {currentPlanInput.water} water units
              </h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Synced directly with Dashboard and Recommendations for your active farm plan.
            </p>
          </div>

          <div
            className="flex flex-wrap items-center gap-2"
            role="group"
            aria-label="Comparison engine"
          >
            <Button
              type="button"
              size="sm"
              variant={comparisonMode === "hybrid" ? "default" : "outline"}
              onClick={() => setComparisonMode("hybrid")}
            >
              <Sparkles className="size-3.5" />
              {mlComplete && !mlServiceError
                ? isDemoProfile
                  ? "Hybrid Ranking (Demo)"
                  : "Hybrid Ranking"
                : "Active Ranking (Rule-Only)"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={comparisonMode === "rule" ? "default" : "outline"}
              onClick={() => setComparisonMode("rule")}
            >
              <Layers className="size-3.5" />
              Rule-Based Plan
            </Button>
            <Button
              type="button"
              size="sm"
              variant={comparisonMode === "ml" ? "default" : "outline"}
              onClick={() => setComparisonMode("ml")}
            >
              <Cpu className="size-3.5" />
              {isDemoProfile && mlComplete ? "ML Predictions (Demo)" : "ML Model Predictions"}
            </Button>
          </div>
        </div>

        {(comparisonMode === "ml" || hybridReallyActive) && isDemoProfile && mlComplete ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <span className="font-semibold">DEMO / ILLUSTRATIVE BENCHMARK DATA:</span> ML scores
              in this comparison come from the sample benchmark profile, not verified field
              measurements.
            </div>
          </div>
        ) : null}

        {comparisonMode === "hybrid" && mlServiceError ? (
          <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 text-xs text-destructive">
            <div>
              <span className="font-semibold">ML prediction service unavailable:</span>{" "}
              {mlServiceError}. Comparing Rule-Based agronomic candidates only (not a hybrid
              result).
            </div>
            <Button size="sm" variant="outline" onClick={refetchMl}>
              Retry ML service
            </Button>
          </div>
        ) : comparisonMode === "hybrid" && !mlComplete ? (
          <div className="rounded-xl border border-blue-500/25 bg-blue-500/5 p-3.5 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">
              Single-source Rule-Based comparison active:{" "}
            </span>
            ML inputs are incomplete
            {missingMlLabels.length > 0 ? ` (missing ${missingMlLabels.join(", ")})` : ""}
            {outOfRangeMlLabels.length > 0
              ? ` (out of range: ${outOfRangeMlLabels.join(", ")})`
              : ""}
            . Supply all 7 verified measurements on the Recommendations page to activate Hybrid
            (Rule + ML) ranking.
          </div>
        ) : null}
      </section>

      {isInitialLoading ? (
        <LoadingSkeleton variant="table" lines={5} />
      ) : comparisonMode === "ml" && (!mlComplete || Boolean(mlServiceError)) ? (
        <EmptyState
          icon={Cpu}
          title={
            mlServiceError
              ? "ML prediction service is currently unavailable"
              : "ML comparison requires all 7 verified measurements"
          }
          description={
            mlServiceError
              ? `${mlServiceError}. Switch to Rule-Based Plan or retry the ML prediction service.`
              : `Missing: ${missingMlLabels.concat(outOfRangeMlLabels).join(", ")}. Switch to Rule-Based Plan above or supply the missing laboratory/seasonal measurements on the Recommendations page.`
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button type="button" variant="outline" onClick={() => setComparisonMode("rule")}>
                Compare Rule-Based Crops
              </Button>
              {mlServiceError ? (
                <Button type="button" onClick={refetchMl}>
                  Retry ML Service
                </Button>
              ) : (
                <Button asChild>
                  <Link to="/recommendations">Supply Measurements</Link>
                </Button>
              )}
            </div>
          }
        />
      ) : crops.length === 0 ? (
        <EmptyState
          icon={Leaf}
          title="No crops matched this farm plan"
          description="Adjust soil type or water availability on the Recommendations page to generate comparable crop candidates."
          action={
            <Button asChild>
              <Link to="/recommendations">Adjust Farm Plan</Link>
            </Button>
          }
        />
      ) : (
        <>
          {/* Desktop / tablet table */}
          <div className="card-surface hidden overflow-x-auto md:block">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <caption className="sr-only">Comparison of suggested crops</caption>
              <thead>
                <tr className="border-b border-border">
                  <th
                    scope="col"
                    className="w-48 p-4 text-left text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
                  >
                    Detail
                  </th>
                  {crops.map((c, i) => (
                    <th
                      key={c.crop}
                      scope="col"
                      className={
                        i === 0
                          ? "bg-primary/5 p-4 text-left align-bottom"
                          : "p-4 text-left align-bottom"
                      }
                    >
                      <span className="block text-base font-semibold text-foreground">
                        {c.overallRank != null ? `#${c.overallRank} · ${c.crop}` : c.crop}
                      </span>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {i === 0 ? (
                          <StatusBadge label="Top Match" tone="success" icon={Star} />
                        ) : null}
                        <StatusBadge
                          label={c.source}
                          tone={
                            c.source === "DEMO / ILLUSTRATIVE"
                              ? "warning"
                              : c.source === "HYBRID"
                                ? "success"
                                : "info"
                          }
                        />
                        {c.hardConstraintTriggered ? (
                          <StatusBadge
                            label="Constraint Flagged"
                            tone="warning"
                            icon={AlertTriangle}
                          />
                        ) : null}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="border-b border-border/70 last:border-0">
                    <th
                      scope="row"
                      className="p-4 text-left align-top font-medium text-muted-foreground"
                    >
                      {row.label}
                    </th>
                    {crops.map((c, i) => {
                      const cell = row.get(c);
                      return (
                        <td
                          key={c.crop}
                          className={`p-4 align-top text-xs sm:text-sm ${i === 0 ? "bg-primary/5" : ""}`}
                        >
                          <MetricValue value={cell.value} unit={cell.unit ?? null} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr>
                  <td className="p-4" />
                  {crops.map((c, i) => (
                    <td key={c.crop} className={i === 0 ? "bg-primary/5 p-4" : "p-4"}>
                      <Button asChild size="sm" variant={i === 0 ? "default" : "outline"}>
                        <Link to="/cultivation/$crop" params={{ crop: c.guideSlug }}>
                          How to cultivate
                        </Link>
                      </Button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Mobile stacked cards */}
          <div className="space-y-4 md:hidden">
            {crops.map((c, i) => (
              <article
                key={c.crop}
                className={
                  i === 0 ? "card-surface border-primary/30 bg-primary/5 p-5" : "card-surface p-5"
                }
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold tracking-tight text-foreground">
                    {c.overallRank != null ? `#${c.overallRank} · ${c.crop}` : c.crop}
                  </h2>
                  {i === 0 ? <StatusBadge label="Top Match" tone="success" icon={Star} /> : null}
                  <StatusBadge
                    label={c.source}
                    tone={
                      c.source === "DEMO / ILLUSTRATIVE"
                        ? "warning"
                        : c.source === "HYBRID"
                          ? "success"
                          : "info"
                    }
                  />
                  {c.hardConstraintTriggered ? (
                    <StatusBadge label="Constraint Flagged" tone="warning" icon={AlertTriangle} />
                  ) : null}
                </div>
                <dl className="mt-3 space-y-2">
                  {rows.map((row) => {
                    const cell = row.get(c);
                    return (
                      <div key={row.label} className="flex items-start justify-between gap-3">
                        <dt className="text-sm text-muted-foreground">{row.label}</dt>
                        <dd className="max-w-[65%] text-right text-sm font-medium">
                          <MetricValue value={cell.value} unit={cell.unit ?? null} />
                        </dd>
                      </div>
                    );
                  })}
                </dl>
                <Button
                  asChild
                  size="sm"
                  className="mt-4"
                  variant={i === 0 ? "default" : "outline"}
                >
                  <Link to="/cultivation/$crop" params={{ crop: c.guideSlug }}>
                    How to cultivate
                  </Link>
                </Button>
              </article>
            ))}
          </div>

          <p className="text-sm text-muted-foreground">
            {comparisonMode === "hybrid" && hybridReallyActive
              ? "Hybrid Ranking combines ordinal Rule-Based and Random Forest ranks via Constraint-Aware Reciprocal Rank Fusion (CA-RRF). Rule compatibility (%) and ML uncalibrated scores (%) are shown separately and never averaged."
              : comparisonMode === "ml"
                ? "ML percentages represent uncalibrated Random Forest class score averages across the 200-tree ensemble, not calibrated probabilities or field yield guarantees."
                : "Rule-Based scores represent agronomic compatibility with your selected soil texture, water availability, and crop duration."}{" "}
            Anything unavailable is shown as “—”.
          </p>
        </>
      )}
    </div>
  );
}

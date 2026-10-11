import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  Compass,
  Droplets,
  ExternalLink,
  FileCheck2,
  FlaskConical,
  Info,
  Leaf,
  MapPin,
  Ruler,
  ShieldAlert,
  Shovel,
  Sparkles,
  Sprout,
  Thermometer,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { CultivationTimeline } from "@/components/agri/CultivationTimeline";
import { Button } from "@/components/ui/button";
import { farmsService, soilReportsService, cultivationService } from "@/services";
import { getCropCultivationGuide } from "@/data/crop-cultivation";

export const Route = createFileRoute("/cultivation/$crop")({
  loader: async ({ params }) => {
    return await cultivationService.getFullGuide(params.crop);
  },
  head: ({ params }) => {
    const guide = getCropCultivationGuide(params.crop);
    const title = guide
      ? `${guide.displayName} Cultivation Guide — AgriSmart`
      : "Crop Cultivation Guide — AgriSmart";
    const desc = guide
      ? `Complete cultivation procedure for ${guide.displayName}: climate, soil, sowing, irrigation, nutrient, pest management and harvest.`
      : "Stage-by-stage agronomic cultivation guidance.";
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
      links: [{ rel: "canonical", href: `/cultivation/${params.crop}` }],
    };
  },
  component: CultivationCropPage,
});

function CultivationCropPage() {
  const { crop } = Route.useParams();
  const localGuide = useMemo(() => getCropCultivationGuide(crop), [crop]);

  // Validate crop against the 22-class knowledge base
  const guideQ = useQuery({
    queryKey: ["cultivation-guide", crop],
    queryFn: () => cultivationService.getFullGuide(crop),
    initialData: () => ({
      data: localGuide,
      source: "artifact" as const,
      fetchedAt: new Date().toISOString(),
    }),
  });

  const farmQ = useQuery({
    queryKey: ["farm"],
    queryFn: () => farmsService.getActiveFarm(),
  });
  const farm = farmQ.data?.data;

  const soilReportQ = useQuery({
    queryKey: ["soilReports", farm?.id],
    queryFn: () => soilReportsService.list(farm?.id),
    enabled: Boolean(farm?.id),
  });
  const latestSoilReport = soilReportQ.data?.data?.[0];

  const guide = guideQ.data?.data ?? localGuide;

  if (guideQ.isPending && !guide) {
    return (
      <div className="space-y-6 pb-6">
        <LoadingSkeleton variant="card" count={3} />
      </div>
    );
  }

  if (guideQ.isError && !guide) {
    return (
      <div className="py-6">
        <ErrorState
          title="Unable to load cultivation guide"
          description="A network or service issue prevented loading the cultivation details."
          onRetry={() => void guideQ.refetch()}
        />
      </div>
    );
  }

  // Graceful empty state for unknown or legacy crops (e.g., soybean, groundnut)
  if (!guide) {
    return (
      <div className="space-y-6 pb-6">
        <PageHeader
          eyebrow="Agricultural Knowledge Base"
          title="Guide Not Available"
          description={`No authoritative cultivation guide exists for "${crop}".`}
          icon={Sprout}
          actions={
            <Button asChild size="sm" variant="outline">
              <Link to="/cultivation">
                <ArrowLeft aria-hidden="true" className="size-4" />
                All 22 guides
              </Link>
            </Button>
          }
        />
        <EmptyState
          icon={BookOpen}
          title={`No guide for "${crop}"`}
          description="AgriSmart supports complete cultivation procedures strictly for its 22 trained ML model crop classes. Legacy or unmodeled crops do not have verified knowledge entries."
          action={
            <Button asChild size="sm">
              <Link to="/cultivation">Browse all 22 crop guides</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <PageHeader
        eyebrow={`${guide.category} • Full Cultivation Procedure`}
        title={guide.displayName}
        description={guide.overview}
        icon={Sprout}
        actions={
          <Button asChild size="sm" variant="outline">
            <Link to="/cultivation">
              <ArrowLeft aria-hidden="true" className="size-4" />
              All guides
            </Link>
          </Button>
        }
      />

      {/* Farm Context Banner (When Active Farm Exists) */}
      {farm && (
        <section
          aria-labelledby="farm-context-title"
          className="rounded-2xl border border-primary/20 bg-primary/5 p-4 sm:p-5"
        >
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Compass className="size-4 text-primary shrink-0" aria-hidden="true" />
              <h2 id="farm-context-title" className="text-sm font-semibold text-foreground">
                Active Farm Context: {farm.name}
              </h2>
            </div>
            <span className="text-xs text-muted-foreground">Parameters referenced below</span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 lg:grid-cols-5">
            <div className="rounded-xl border border-border/70 bg-card/60 p-2.5">
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <MapPin className="size-3" /> Location
              </span>
              <p className="mt-1 font-semibold text-foreground truncate">
                {farm.location || "Not available"}
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-card/60 p-2.5">
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Compass className="size-3" /> District
              </span>
              <p className="mt-1 font-semibold text-foreground truncate">
                {farm.district || "Not available"}
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-card/60 p-2.5">
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Ruler className="size-3" /> Land Area
              </span>
              <p className="mt-1 font-semibold text-foreground">
                {farm.landAreaAcres ? `${farm.landAreaAcres} acres` : "Not available"}
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-card/60 p-2.5">
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Droplets className="size-3" /> Irrigation
              </span>
              <p className="mt-1 font-semibold text-foreground truncate">
                {farm.irrigation || "Not available"}
              </p>
            </div>
            <div className="col-span-2 sm:col-span-1 rounded-xl border border-border/70 bg-card/60 p-2.5">
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <FileCheck2 className="size-3" /> Soil Report
              </span>
              <p className="mt-1 font-semibold text-foreground flex items-center gap-1">
                {latestSoilReport ? (
                  <>
                    <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>Verified</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Not available</span>
                )}
              </p>
            </div>
          </div>
          <p className="mt-2.5 text-[11px] text-muted-foreground">
            * Note: General agronomic guidelines below should be adapted according to your verified
            soil test results and local agro-climatic conditions.
          </p>
        </section>
      )}

      {/* Quick Agronomic Parameters Cards */}
      <section aria-labelledby="key-specs-title" className="space-y-3">
        <h2
          id="key-specs-title"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Core Crop Specifications
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-xs">
          <div className="card-surface p-4">
            <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
              <Calendar className="size-4 text-primary" /> Growth Duration
            </span>
            <p className="mt-1.5 text-base font-bold text-foreground">{guide.durationDays} days</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              From sowing/planting to harvest
            </p>
          </div>

          <div className="card-surface p-4">
            <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
              <Droplets className="size-4 text-primary" /> Water Requirement
            </span>
            <p
              className="mt-1.5 text-base font-bold text-foreground truncate"
              title={guide.waterRequirement}
            >
              {guide.waterRequirement}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">Total seasonal water need</p>
          </div>

          <div className="card-surface p-4">
            <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
              <Thermometer className="size-4 text-primary" /> Suitable Climate
            </span>
            <p className="mt-1.5 text-xs font-semibold text-foreground line-clamp-2">
              {guide.suitableClimate}
            </p>
          </div>

          <div className="card-surface p-4">
            <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
              <Shovel className="size-4 text-primary" /> Ideal Soil
            </span>
            <p className="mt-1.5 text-xs font-semibold text-foreground line-clamp-2">
              {guide.soilRequirements}
            </p>
          </div>
        </div>
      </section>

      {/* Establishment, Sowing & Land Preparation */}
      <section aria-labelledby="sowing-title" className="card-surface p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-border/70 pb-3">
          <Shovel className="size-5 text-primary" aria-hidden="true" />
          <h2 id="sowing-title" className="text-base font-semibold text-foreground">
            Land Preparation & Sowing Guidelines
          </h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3 text-sm">
          <div className="rounded-xl border border-border/70 p-4">
            <h3 className="font-semibold text-foreground text-xs uppercase tracking-wide text-muted-foreground">
              Seasons & Sowing Window
            </h3>
            <p className="mt-2 text-foreground leading-relaxed">{guide.seasons}</p>
          </div>

          <div className="rounded-xl border border-border/70 p-4">
            <h3 className="font-semibold text-foreground text-xs uppercase tracking-wide text-muted-foreground">
              Seed & Planting Material
            </h3>
            <p className="mt-2 text-foreground leading-relaxed">{guide.plantingMaterial}</p>
          </div>

          <div className="rounded-xl border border-border/70 p-4">
            <h3 className="font-semibold text-foreground text-xs uppercase tracking-wide text-muted-foreground">
              Land Preparation & Tilth
            </h3>
            <p className="mt-2 text-foreground leading-relaxed">{guide.landPreparation}</p>
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-accent/15 p-4 text-sm">
          <h3 className="font-semibold text-foreground text-xs uppercase tracking-wide text-muted-foreground">
            Sowing Method & Geometry
          </h3>
          <p className="mt-1 text-foreground leading-relaxed">{guide.sowingOrPlanting}</p>
        </div>
      </section>

      {/* Stage-by-Stage Biological Growth Timeline */}
      <section aria-labelledby="timeline-heading" className="space-y-3">
        <CultivationTimeline
          crop={guide.displayName}
          stages={guide.growthStages}
          source="artifact"
        />
      </section>

      {/* Agronomic Management Practices (Irrigation, Nutrients, Weeds) */}
      <section aria-labelledby="management-title" className="grid gap-4 md:grid-cols-3">
        {/* Irrigation */}
        <article className="card-surface p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-primary">
              <Droplets className="size-5" />
              <h2 className="text-sm font-semibold text-foreground">Irrigation Management</h2>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{guide.irrigation}</p>
          </div>
        </article>

        {/* Nutrient Management with Context Disclaimer */}
        <article className="card-surface p-5 flex flex-col justify-between border-chart-2/40">
          <div>
            <div className="flex items-center gap-2 text-chart-2">
              <FlaskConical className="size-5" />
              <h2 className="text-sm font-semibold text-foreground">Nutrient Management</h2>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {guide.nutrientManagement}
            </p>
          </div>
          <div className="mt-4 rounded-lg border border-chart-2/30 bg-chart-2/10 p-2 text-[11px] text-foreground">
            <span className="font-semibold">Soil-test reminder: </span>
            Follow soil-test-based nutrient recommendations and locally recommended crop practices
            rather than universal doses.
          </div>
        </article>

        {/* Weed Management */}
        <article className="card-surface p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <Leaf className="size-5" />
              <h2 className="text-sm font-semibold text-foreground">Weed Management</h2>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {guide.weedManagement}
            </p>
          </div>
        </article>
      </section>

      {/* Pest & Disease Monitoring */}
      {guide.pestDiseaseMonitoring && guide.pestDiseaseMonitoring.length > 0 && (
        <section aria-labelledby="pests-title" className="card-surface p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-border/70 pb-3">
            <ShieldAlert className="size-5 text-chart-4" aria-hidden="true" />
            <h2 id="pests-title" className="text-base font-semibold text-foreground">
              Major Pests & Disease Monitoring
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {guide.pestDiseaseMonitoring.map((item, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-border/70 p-4 space-y-2 bg-card/60"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">{item.name}</h3>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                      item.type === "pest"
                        ? "bg-chart-4/20 text-chart-4"
                        : "bg-chart-1/20 text-chart-1"
                    }`}
                  >
                    {item.type}
                  </span>
                </div>
                <div>
                  <h4 className="text-[11px] font-semibold text-muted-foreground uppercase">
                    Symptoms & Timing
                  </h4>
                  <p className="text-xs text-foreground mt-0.5">{item.symptomsOrTiming}</p>
                </div>
                <div>
                  <h4 className="text-[11px] font-semibold text-muted-foreground uppercase">
                    Integrated Management
                  </h4>
                  <p className="text-xs text-foreground mt-0.5">{item.management}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Harvest & Post-Harvest */}
      <section aria-labelledby="harvest-title" className="grid gap-4 md:grid-cols-2">
        <article className="card-surface p-5 space-y-2">
          <h2
            id="harvest-title"
            className="text-sm font-semibold text-foreground flex items-center gap-2"
          >
            <Sparkles className="size-4 text-primary" /> Harvesting Criteria & Method
          </h2>
          <p className="text-xs leading-relaxed text-muted-foreground">{guide.harvest}</p>
        </article>

        <article className="card-surface p-5 space-y-2">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Info className="size-4 text-primary" /> Post-Harvest Handling & Storage
          </h2>
          <p className="text-xs leading-relaxed text-muted-foreground">{guide.postHarvest}</p>
        </article>
      </section>

      {/* Important Notes & Regional Caution */}
      <section aria-labelledby="notes-title" className="space-y-4">
        {guide.importantNotes && guide.importantNotes.length > 0 && (
          <div className="rounded-2xl border border-border/80 bg-accent/10 p-5">
            <h2
              id="notes-title"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Key Agronomic Notes
            </h2>
            <ul className="mt-2 list-disc list-inside space-y-1.5 text-xs text-foreground">
              {guide.importantNotes.map((note, idx) => (
                <li key={idx} className="leading-relaxed">
                  {note}
                </li>
              ))}
            </ul>
          </div>
        )}

        {guide.regionalCaution && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-foreground">
            <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-300">
                Regional & Varietal Caution
              </p>
              <p className="mt-0.5 text-muted-foreground leading-relaxed">
                {guide.regionalCaution}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Authoritative Sources */}
      {guide.sources && guide.sources.length > 0 && (
        <section aria-labelledby="sources-title" className="card-surface p-5 space-y-3">
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-primary" />
            <h2
              id="sources-title"
              className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Authoritative Agricultural Sources
            </h2>
          </div>
          <ul className="divide-y divide-border/60 text-xs">
            {guide.sources.map((src, i) => (
              <li
                key={i}
                className="py-2.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1"
              >
                <div>
                  <p className="font-semibold text-foreground">{src.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {src.organization} • Accessed: {src.accessedDate}
                  </p>
                </div>
                {src.url && (
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                  >
                    <span>Official portal</span>
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Next Step / Action Buttons */}
      <section
        className="rounded-2xl border border-primary/25 bg-primary/5 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        aria-label="Next steps"
      >
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Plan your crop cycle
          </h2>
          <p className="mt-1 text-sm font-semibold text-foreground">
            Get accurate, field-specific nutrient guidance before sowing.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button asChild size="sm">
            <Link to="/soil-testing">Find soil testing labs</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/recommendations">Back to recommendations</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

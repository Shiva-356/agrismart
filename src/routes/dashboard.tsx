import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Coins,
  Compass,
  Droplets,
  FileCheck2,
  FlaskConical,
  MapPin,
  Ruler,
  Save,
  Sprout,
  Sunrise,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
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
import {
  farmsService,
  recommendationsService,
  soilService,
  weatherService,
} from "@/services";
import {
  SOIL_TYPES,
  generateRecommendations,
  saveHistoryEntry,
  type FarmInput,
  type Recommendation,
  type SoilType,
} from "@/lib/agri";

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
  component: Dashboard,
});

const EMPTY: FarmInput = {
  name: "",
  landArea: 5,
  water: 2000,
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
  const farmQ = useQuery({ queryKey: ["farm", "active"], queryFn: () => farmsService.getActiveFarm() });
  const farmId = farmQ.data?.data.id;

  const weatherQ = useQuery({
    queryKey: ["weather", farmId],
    queryFn: () => weatherService.getCurrent(farmId as string),
    enabled: Boolean(farmId),
  });
  const soilQ = useQuery({ queryKey: ["soil", "status"], queryFn: () => soilService.getStatus() });
  const recQ = useQuery({
    queryKey: ["recommendation", farmId],
    queryFn: () => recommendationsService.get(farmId as string),
    enabled: Boolean(farmId),
  });

  const farm = farmQ.data?.data ?? null;
  const soil = soilQ.data?.data ?? null;
  const rec = recQ.data?.data ?? null;
  const hasReport = Boolean(soil?.hasReport);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6 lg:pt-10">
      {/* 1 — Welcome / farm overview */}
      <section className="relative overflow-hidden rounded-2xl border border-border bg-card px-5 py-6 shadow-sm sm:px-7 sm:py-8">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-20 size-52 rounded-full bg-accent/25 blur-2xl"
        />
        <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <Sunrise aria-hidden="true" className="size-3.5 shrink-0" />
              Your farm today
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {farm ? `${greeting()}, ${farm.ownerName}` : `${greeting()}, farmer`}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Let's make a smarter decision for your farm today.
            </p>
          </div>
          {farmQ.data ? (
            <DataSourceBadge
              source={farmQ.data.source}
              fetchedAt={farmQ.data.fetchedAt}
              className="shrink-0"
            />
          ) : null}
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
        ) : (
          <dl className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Fact icon={Sprout} label="Farm" value={farm?.name ?? null} />
            <Fact icon={MapPin} label="Location" value={farm?.location ?? null} />
            <Fact icon={Ruler} label="Land area" value={farm?.landAreaAcres ?? null} unit="acres" />
            <Fact icon={Compass} label="Current crop" value={farm?.currentCrop ?? null} />
          </dl>
        )}
      </section>

      {/* 2 & 3 — Weather + soil status */}
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {weatherQ.isPending || !farmId ? (
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
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
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

      {/* 6 & 7 — Recommendation + always-visible explanation */}
      <section className="mt-8" aria-labelledby="ai-rec-title">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
          <div className="min-w-0">
            <h2 id="ai-rec-title" className="text-xl font-semibold tracking-tight sm:text-2xl">
              AI crop recommendation
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Model output for your field conditions, with the reasoning shown up front.
            </p>
          </div>
        </div>

        {recQ.isPending || !farmId ? (
          <LoadingSkeleton className="mt-5" lines={5} />
        ) : recQ.isError || !recQ.data || !rec ? (
          <ErrorState
            className="mt-5"
            title="Recommendation unavailable"
            description="No crop recommendation can be shown until the model responds."
            onRetry={() => void recQ.refetch()}
          />
        ) : (
          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <RecommendationCard
              recommendation={rec.top}
              source={recQ.data.source}
              fetchedAt={recQ.data.fetchedAt}
              className="lg:row-span-2"
              footer={
                <div className="space-y-4">
                  <dl className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-secondary/60 p-3">
                      <dt className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                        Data completeness
                      </dt>
                      <dd className="mt-1 text-sm font-semibold">
                        <MetricValue value={rec.dataCompletenessPct} unit="%" />
                      </dd>
                    </div>
                    <div className="rounded-xl bg-secondary/60 p-3">
                      <dt className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                        Reliability
                      </dt>
                      <dd className="mt-1 text-sm font-semibold">
                        <MetricValue value={rec.reliability} />
                      </dd>
                    </div>
                  </dl>
                  <Button asChild variant="outline" size="sm" className="w-full">
                    <Link to="/cultivation">
                      View cultivation guide <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              }
            />

            {rec.factors.length > 0 || rec.explanation ? (
              <ExplanationPanel
                result={rec}
                source={recQ.data.source}
                fetchedAt={recQ.data.fetchedAt}
              />
            ) : (
              <EmptyState
                icon={TriangleAlert}
                title="Why this crop?"
                description="Explanation data is not available yet."
              />
            )}

            {/* 8 & 9 — data used / still needed */}
            <div className="card-surface p-5">
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Data used for this recommendation
              </h3>
              {rec.dataUsed.length ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {rec.dataUsed.map((d) => (
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
                Information still needed
              </h3>
              {rec.dataMissing.length ? (
                <>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {rec.dataMissing.map((d) => (
                      <li
                        key={d}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground"
                      >
                        <TriangleAlert aria-hidden="true" className="size-3.5 shrink-0" />
                        <span className="min-w-0">{d}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Your recommendation can be improved with a soil test.
                  </p>
                  <Button asChild size="sm" variant="outline" className="mt-3">
                    <Link to="/soil-testing">
                      <FlaskConical className="size-4" /> Get soil tested
                    </Link>
                  </Button>
                </>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">Nothing reported as missing.</p>
              )}
            </div>
          </div>
        )}
      </section>

      {/* 10 — Alternatives */}
      {rec && rec.alternatives.length > 0 && recQ.data ? (
        <section className="mt-8" aria-labelledby="alt-crops-title">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <h2 id="alt-crops-title" className="min-w-0 text-lg font-semibold tracking-tight">
              Other crops that suit your farm
            </h2>
            <Button asChild size="sm" variant="ghost" className="shrink-0">
              <Link to="/recommendations">
                Compare crops <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {rec.alternatives.map((alt, i) => (
              <RecommendationCard
                key={alt.crop}
                recommendation={alt}
                variant="compact"
                source={recQ.data.source}
                fetchedAt={recQ.data.fetchedAt}
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
        ) : rec ? (
          <>
            <p className="mt-2 text-lg font-semibold tracking-tight">
              Ready to learn how to grow {rec.top.crop}?
            </p>
            <Button asChild className="mt-4">
              <Link to="/cultivation">
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

      <PlanningPanel />
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
function PlanningPanel() {
  const [form, setForm] = useState<FarmInput>(EMPTY);
  const [results, setResults] = useState<Recommendation[] | null>(null);

  const update = <K extends keyof FarmInput>(key: K, value: FarmInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <section className="mt-10 border-t border-border/70 pt-8" aria-labelledby="planning-title">
      <h2 id="planning-title" className="text-lg font-semibold tracking-tight">
        Plan a season yourself
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Optional. Try different land, water and budget combinations and save the result to your
        history. Soil laboratory values are never required.
      </p>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,380px)_1fr]">
        <form
          className="card-surface h-fit space-y-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            setResults(generateRecommendations(form));
            toast.success("Recommendations generated");
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              required
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Ravi Kumar"
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
              <Label htmlFor="water">Water (units)</Label>
              <Input
                id="water"
                type="number"
                min={0}
                value={form.water}
                onChange={(e) => update("water", Number(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="soil">Soil type</Label>
            <Select value={form.soilType} onValueChange={(v) => update("soilType", v as SoilType)}>
              <SelectTrigger id="soil">
                <SelectValue placeholder="Select soil type" />
              </SelectTrigger>
              <SelectContent>
                {SOIL_TYPES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
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
            <div className="space-y-2">
              <Label htmlFor="crop">Preferred crop</Label>
              <Input
                id="crop"
                value={form.preferredCrop}
                onChange={(e) => update("preferredCrop", e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={3}
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Irrigation source, past crops, pest issues…"
            />
          </div>

          <Button type="submit" className="w-full">
            Get recommendations
          </Button>
        </form>

        <div className="space-y-4">
          {!results ? (
            <EmptyState
              icon={Sprout}
              title="No planning result yet"
              description="Fill in the form to see suggested crops you can save to your history."
            />
          ) : (
            <>
              <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                <h3 className="min-w-0 truncate text-base font-semibold">
                  Suggested for {form.name || "your farm"}
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => {
                    saveHistoryEntry({
                      id: crypto.randomUUID(),
                      createdAt: new Date().toISOString(),
                      input: form,
                      recommendations: results,
                    });
                    toast.success("Saved to history");
                  }}
                >
                  <Save className="size-4" /> Save
                </Button>
              </div>
              {results.map((r) => (
                <article key={r.crop} className="card-surface p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <h4 className="text-lg font-semibold">{r.crop}</h4>
                    <span
                      className={
                        r.source === "ML MODEL"
                          ? "rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold tracking-wide text-primary-foreground"
                          : "rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold tracking-wide text-accent-foreground"
                      }
                    >
                      [{r.source}]
                    </span>
                    <span className="ml-auto inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                      <BadgeCheck className="size-4 text-primary" />
                      {r.confidence}% confidence
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">{r.rationale}</p>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-3">
                    <Stat icon={<Sprout className="size-4" />} label="Expected yield" value={r.expectedYield} />
                    <Stat icon={<Droplets className="size-4" />} label="Water need" value={r.waterNeed} />
                    <Stat icon={<Coins className="size-4" />} label="Est. profit" value={r.estimatedProfit} />
                  </dl>
                </article>
              ))}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
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

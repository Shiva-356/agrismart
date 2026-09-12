import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  CloudSun,
  Leaf,
  MapPin,
  MinusCircle,
  Sprout,
  TestTubes,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { StatusBadge } from "@/components/common/StatusBadge";
import { RecommendationCard } from "@/components/agri/RecommendationCard";
import { ExplanationPanel } from "@/components/agri/ExplanationPanel";
import { MetricValue } from "@/components/agri/value";
import { Button } from "@/components/ui/button";
import { farmsService, recommendationsService, soilService, weatherService } from "@/services";
import type { Farm, SoilStatus, Weather } from "@/services/types";

export const Route = createFileRoute("/recommendations/")({
  head: () => ({
    meta: [
      { title: "Your Crop Recommendation — AgriSmart" },
      {
        name: "description",
        content:
          "See the crop suggested for your farm, why it was suggested, what information was used and what is still missing.",
      },
      { property: "og:title", content: "Your Crop Recommendation — AgriSmart" },
      {
        property: "og:description",
        content: "Explainable crop guidance based on the farm and soil information available.",
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
}: {
  farm: Farm | undefined;
  weather: Weather | undefined;
  soil: SoilStatus | undefined;
}) {
  const hasWeather =
    Boolean(weather) &&
    (weather?.temperatureC !== null ||
      weather?.humidityPct !== null ||
      weather?.rainfallMm !== null);
  const hasSoil = Boolean(soil?.hasReport);
  const testedCount = soil?.parameters.filter((p) => p.status === "available").length ?? 0;

  return (
    <section className="card-surface p-5" aria-labelledby="availability-title">
      <h2
        id="availability-title"
        className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
      >
        Information we have right now
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Your recommendation only uses the information listed as available.
      </p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        <AvailabilityRow
          label="Farm information"
          icon={MapPin}
          available={Boolean(farm)}
          detail={farm ? `${farm.name} · ${farm.location}` : "Farm profile not loaded"}
        />
        <AvailabilityRow
          label="Weather"
          icon={CloudSun}
          available={hasWeather}
          detail={hasWeather ? "Current conditions in use" : "No weather readings"}
        />
        <AvailabilityRow
          label="Soil report"
          icon={TestTubes}
          available={hasSoil}
          detail={hasSoil ? `${testedCount} parameters tested` : "No verified soil report linked"}
        />
        <AvailabilityRow
          label="Soil nutrients and pH"
          icon={Sprout}
          available={testedCount > 0}
          detail={
            testedCount > 0
              ? "Taken from your laboratory report"
              : "You don't need to know these — a soil test provides them"
          }
        />
      </ul>

      {!hasSoil ? (
        <div className="mt-4 rounded-2xl border border-accent/60 bg-accent/15 p-4">
          <p className="text-sm font-medium text-foreground">
            Some soil information is still needed for a stronger recommendation.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            AgriSmart connects you with nearby testing centres — you never have to enter NPK or pH
            yourself.
          </p>
          <Button asChild size="sm" className="mt-3">
            <Link to="/soil-testing">
              <TestTubes aria-hidden="true" className="size-4" />
              Get soil tested
            </Link>
          </Button>
        </div>
      ) : (
        <Button asChild size="sm" variant="outline" className="mt-4">
          <Link to="/soil-reports">View soil report</Link>
        </Button>
      )}
    </section>
  );
}

function RecommendationsPage() {
  const farmQ = useQuery({ queryKey: ["farm"], queryFn: () => farmsService.getActiveFarm() });
  const farmId = farmQ.data?.data.id;

  const recQ = useQuery({
    queryKey: ["recommendation", farmId],
    queryFn: () => recommendationsService.get(farmId as string),
    enabled: Boolean(farmId),
  });
  const weatherQ = useQuery({
    queryKey: ["weather", farmId],
    queryFn: () => weatherService.getCurrent(farmId as string),
    enabled: Boolean(farmId),
  });
  const soilQ = useQuery({ queryKey: ["soil-status"], queryFn: () => soilService.getStatus() });

  const rec = recQ.data?.data;
  const source = recQ.data?.source ?? "demo";
  const fetchedAt = recQ.data?.fetchedAt;
  const soil = soilQ.data?.data;

  return (
    <div className="space-y-6 pb-4">
      <PageHeader
        eyebrow="Decision support"
        title="Your Crop Recommendation"
        description="Based on the farming and soil information currently available."
        icon={Leaf}
        {...(recQ.data ? { source: recQ.data.source, fetchedAt: recQ.data.fetchedAt } : {})}
      />

      {farmQ.isPending || soilQ.isPending ? (
        <LoadingSkeleton variant="card" count={2} />
      ) : (
        <DataAvailability
          farm={farmQ.data?.data}
          weather={weatherQ.data?.data}
          soil={soil}
        />
      )}

      {recQ.isPending ? (
        <LoadingSkeleton variant="card" count={2} />
      ) : recQ.isError ? (
        <ErrorState
          title="Unable to load your recommendation"
          description="The recommendation service did not respond. No values are shown rather than estimates."
          onRetry={() => void recQ.refetch()}
        />
      ) : !rec ? (
        <EmptyState
          icon={Leaf}
          title="No crop recommendation is available yet"
          description="Once your farm and soil information is available, your recommendation will appear here."
        />
      ) : (
        <>
          <section className="space-y-4" aria-label="Recommended crop">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge label="ML model" tone="info" icon={Leaf} />
              <StatusBadge label="Explanation always shown" tone="neutral" />
            </div>
            <RecommendationCard
              recommendation={rec.top}
              source={source}
              fetchedAt={fetchedAt}
              variant="primary"
              footer={
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <Link to="/cultivation/$crop" params={{ crop: rec.top.crop }}>
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
          </section>

          <ExplanationPanel result={rec} source={source} fetchedAt={fetchedAt} />

          <section className="grid gap-4 lg:grid-cols-2" aria-label="Information used and needed">
            <div className="card-surface p-5">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Information used for this recommendation
              </h2>
              {rec.dataUsed.length ? (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {rec.dataUsed.map((d) => (
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
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Information still needed
              </h2>
              {rec.dataMissing.length ? (
                <>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {rec.dataMissing.map((d) => (
                      <li key={d}>
                        <StatusBadge label={d} tone="warning" icon={MinusCircle} />
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Your recommendation can be improved with a soil test.
                  </p>
                  <Button asChild size="sm" variant="outline" className="mt-3">
                    <Link to="/soil-testing">Get a soil test</Link>
                  </Button>
                </>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">Nothing reported as missing.</p>
              )}
            </div>
          </section>

          <section aria-labelledby="alternatives-title" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="alternatives-title" className="text-lg font-semibold tracking-tight">
                Other crops that suit your farm
              </h2>
              {rec.alternatives.length ? (
                <Button asChild size="sm" variant="outline">
                  <Link to="/recommendations/compare">
                    Compare crops
                    <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                </Button>
              ) : null}
            </div>
            {rec.alternatives.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {rec.alternatives.map((alt) => (
                  <RecommendationCard
                    key={alt.crop}
                    recommendation={alt}
                    source={source}
                    fetchedAt={fetchedAt}
                    variant="compact"
                    footer={
                      <Button asChild size="sm" variant="outline">
                        <Link to="/cultivation/$crop" params={{ crop: alt.crop }}>
                          Cultivation guide
                        </Link>
                      </Button>
                    }
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Leaf}
                title="Alternative crops are not available"
                description="The current data source did not return any alternative crops."
              />
            )}
          </section>

          <section className="rounded-2xl border border-primary/25 bg-primary/5 p-5" aria-label="Next step">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Recommended next step
            </h2>
            {!soil?.hasReport ? (
              <>
                <p className="mt-1.5 text-base font-semibold text-foreground">
                  Get your soil tested to improve recommendation quality.
                </p>
                <Button asChild className="mt-4">
                  <Link to="/soil-testing">Find soil testing</Link>
                </Button>
              </>
            ) : (
              <>
                <p className="mt-1.5 text-base font-semibold text-foreground">
                  Ready to learn how to grow {rec.top.crop}?
                </p>
                <Button asChild className="mt-4">
                  <Link to="/cultivation/$crop" params={{ crop: rec.top.crop }}>
                    How to cultivate
                  </Link>
                </Button>
              </>
            )}
          </section>

          <section className="card-surface p-5" aria-label="Weather context">
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Weather used as context
            </h2>
            {weatherQ.isError || !weatherQ.data ? (
              <p className="mt-3 text-sm text-muted-foreground">Weather data unavailable.</p>
            ) : (
              <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Temperature", value: weatherQ.data.data.temperatureC, unit: "°C" },
                  { label: "Humidity", value: weatherQ.data.data.humidityPct, unit: "%" },
                  { label: "Rainfall", value: weatherQ.data.data.rainfallMm, unit: "mm" },
                ].map((w) => (
                  <div key={w.label} className="rounded-xl border border-border/70 px-3 py-2">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{w.label}</dt>
                    <dd className="mt-1 text-sm font-semibold">
                      <MetricValue value={w.value} unit={w.unit} />
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </section>
        </>
      )}
    </div>
  );
}

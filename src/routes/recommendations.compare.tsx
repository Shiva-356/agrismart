import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Columns3, Leaf, Star } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { StatusBadge } from "@/components/common/StatusBadge";
import { MetricValue } from "@/components/agri/value";
import { Button } from "@/components/ui/button";
import { farmsService, recommendationsService } from "@/services";
import type { CropRecommendation } from "@/services/types";

export const Route = createFileRoute("/recommendations/compare")({
  head: () => ({
    meta: [
      { title: "Compare Crops — AgriSmart" },
      {
        name: "description",
        content: "Compare the crops suggested for your farm side by side before you decide.",
      },
      { property: "og:title", content: "Compare Crops — AgriSmart" },
      {
        property: "og:description",
        content: "Suitability, water need, duration and confidence for every suggested crop.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "/recommendations/compare" }],
  }),
  component: ComparePage,
});

const ROWS: {
  label: string;
  get: (c: CropRecommendation) => { value: number | string | null; unit?: string };
}[] = [
  { label: "Overall suitability", get: (c) => ({ value: c.suitability ?? null }) },
  { label: "Model confidence", get: (c) => ({ value: c.confidencePct ?? null, unit: "%" }) },
  { label: "Soil suitability", get: (c) => ({ value: c.soilSuitability }) },
  { label: "Climate suitability", get: (c) => ({ value: c.weatherSuitability }) },
  { label: "Water requirement", get: (c) => ({ value: c.waterRequirement }) },
  { label: "Growing duration", get: (c) => ({ value: c.growthDurationDays, unit: "days" }) },
  { label: "Effort / complexity", get: (c) => ({ value: c.complexity }) },
];

function ComparePage() {
  const farmQ = useQuery({ queryKey: ["farm"], queryFn: () => farmsService.getActiveFarm() });
  const farmId = farmQ.data?.data.id;
  const recQ = useQuery({
    queryKey: ["recommendation", farmId],
    queryFn: () => recommendationsService.get(farmId as string),
    enabled: Boolean(farmId),
  });

  const rec = recQ.data?.data;
  const crops = rec ? [rec.top, ...rec.alternatives] : [];

  return (
    <div className="space-y-6 pb-4">
      <PageHeader
        eyebrow="Recommendations"
        title="Compare Crops"
        description="Compare the crops suggested for your farm."
        icon={Columns3}
        {...(recQ.data ? { source: recQ.data.source, fetchedAt: recQ.data.fetchedAt } : {})}
        actions={
          <Button asChild size="sm" variant="outline">
            <Link to="/recommendations">
              <ArrowLeft aria-hidden="true" className="size-4" />
              Back
            </Link>
          </Button>
        }
      />

      {recQ.isPending || farmQ.isPending ? (
        <LoadingSkeleton variant="table" lines={5} />
      ) : recQ.isError ? (
        <ErrorState
          title="Unable to load the crop comparison"
          onRetry={() => void recQ.refetch()}
        />
      ) : crops.length === 0 ? (
        <EmptyState
          icon={Leaf}
          title="No crops to compare yet"
          description="A recommendation with alternatives is needed before crops can be compared."
        />
      ) : (
        <>
          {/* Desktop / tablet table */}
          <div className="card-surface hidden overflow-x-auto md:block">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <caption className="sr-only">Comparison of suggested crops</caption>
              <thead>
                <tr className="border-b border-border">
                  <th
                    scope="col"
                    className="p-4 text-left text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground"
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
                        {c.crop}
                      </span>
                      {i === 0 ? (
                        <StatusBadge
                          label="Recommended"
                          tone="success"
                          icon={Star}
                          className="mt-2"
                        />
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => (
                  <tr key={row.label} className="border-b border-border/70 last:border-0">
                    <th scope="row" className="p-4 text-left font-medium text-muted-foreground">
                      {row.label}
                    </th>
                    {crops.map((c, i) => {
                      const cell = row.get(c);
                      return (
                        <td key={c.crop} className={i === 0 ? "bg-primary/5 p-4" : "p-4"}>
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
                        <Link to="/cultivation/$crop" params={{ crop: c.crop }}>
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
                    {c.crop}
                  </h2>
                  {i === 0 ? <StatusBadge label="Recommended" tone="success" icon={Star} /> : null}
                </div>
                <dl className="mt-3 space-y-2">
                  {ROWS.map((row) => {
                    const cell = row.get(c);
                    return (
                      <div key={row.label} className="flex items-start justify-between gap-3">
                        <dt className="text-sm text-muted-foreground">{row.label}</dt>
                        <dd className="text-right text-sm font-medium">
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
                  <Link to="/cultivation/$crop" params={{ crop: c.crop }}>
                    How to cultivate
                  </Link>
                </Button>
              </article>
            ))}
          </div>

          <p className="text-sm text-muted-foreground">
            Values shown are only those supplied by the current data source. Anything unavailable is
            shown as “—”.
          </p>
        </>
      )}
    </div>
  );
}

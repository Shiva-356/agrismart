import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Leaf, Sprout } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { StatusBadge } from "@/components/common/StatusBadge";
import { MetricValue } from "@/components/agri/value";
import { Button } from "@/components/ui/button";
import { farmsService, recommendationsService } from "@/services";

export const Route = createFileRoute("/cultivation/")({
  head: () => ({
    meta: [
      { title: "Cultivation Guides — AgriSmart" },
      {
        name: "description",
        content:
          "Step-by-step cultivation guidance for the crops suggested for your farm, from land preparation to harvest.",
      },
      { property: "og:title", content: "Cultivation Guides — AgriSmart" },
      {
        property: "og:description",
        content: "Know what to do after the recommendation — stage by stage.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "/cultivation" }],
  }),
  component: CultivationIndexPage,
});

function CultivationIndexPage() {
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
        eyebrow="After the recommendation"
        title="Cultivation Guides"
        description="Now that you know what to grow, see how to grow it — stage by stage."
        icon={Sprout}
        {...(recQ.data ? { source: recQ.data.source, fetchedAt: recQ.data.fetchedAt } : {})}
      />

      {farmQ.isPending || recQ.isPending ? (
        <LoadingSkeleton variant="card" count={2} />
      ) : recQ.isError ? (
        <ErrorState
          title="Unable to load cultivation guides"
          onRetry={() => void recQ.refetch()}
        />
      ) : crops.length === 0 ? (
        <EmptyState
          icon={Sprout}
          title="Detailed cultivation guidance is not available yet"
          description="Once a crop is suggested for your farm, its cultivation guide will appear here."
          action={
            <Button asChild size="sm">
              <Link to="/recommendations">See your recommendation</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {crops.map((c, i) => (
            <article key={c.crop} className="card-surface p-5">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/30 text-accent-foreground">
                  <Leaf aria-hidden="true" className="size-5" />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold tracking-tight text-foreground">
                    {c.crop}
                  </h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Suitability: <MetricValue value={c.suitability ?? null} />
                  </p>
                </div>
              </div>
              {i === 0 ? (
                <StatusBadge label="Recommended for your farm" tone="success" className="mt-3" />
              ) : null}
              <dl className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-border/70 px-3 py-2">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Duration</dt>
                  <dd className="mt-1 text-sm font-semibold">
                    <MetricValue value={c.growthDurationDays} unit="days" />
                  </dd>
                </div>
                <div className="rounded-xl border border-border/70 px-3 py-2">
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">Water need</dt>
                  <dd className="mt-1 text-sm font-semibold">
                    <MetricValue value={c.waterRequirement} />
                  </dd>
                </div>
              </dl>
              <Button asChild size="sm" className="mt-4">
                <Link to="/cultivation/$crop" params={{ crop: c.crop }}>
                  View cultivation guide
                </Link>
              </Button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

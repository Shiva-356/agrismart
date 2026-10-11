import { AlertTriangle, CalendarRange, HelpCircle, ListChecks, Sprout } from "lucide-react";
import type { CultivationStage, DataSource } from "@/services/types";
import { DataSourceBadge } from "@/components/common/DataSourceBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { cn } from "@/lib/utils";

export function CultivationTimeline({
  crop,
  stages,
  source,
  fetchedAt,
  className,
}: {
  crop: string;
  stages: CultivationStage[];
  source: DataSource;
  fetchedAt?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <section className={cn("card-surface p-5", className)} aria-labelledby="cultivation-title">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h2
            id="cultivation-title"
            className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
          >
            Cultivation guide
          </h2>
          <p className="mt-1 flex min-w-0 items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
            <Sprout aria-hidden="true" className="size-5 shrink-0 text-primary" />
            <span className="truncate">{crop}</span>
          </p>
        </div>
        <DataSourceBadge source={source} fetchedAt={fetchedAt} className="shrink-0" />
      </div>

      {stages.length === 0 ? (
        <EmptyState
          className="mt-5 border-0 bg-transparent px-0 py-8"
          icon={ListChecks}
          title="Guide not available"
          description="No cultivation stages were published for this crop yet."
        />
      ) : (
        <ol className="mt-5 space-y-4">
          {stages.map((stage, i) => (
            <li
              key={stage.index}
              className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-2xl border border-border/70 p-4 transition-colors hover:border-accent/60"
            >
              <span
                aria-hidden="true"
                className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent/30 text-sm font-semibold text-accent-foreground"
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-foreground">{stage.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{stage.what}</p>
                <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="flex items-start gap-2">
                    <CalendarRange
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    />
                    <div className="min-w-0">
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        When
                      </dt>
                      <dd className="text-sm text-foreground">{stage.when}</dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <HelpCircle
                      aria-hidden="true"
                      className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    />
                    <div className="min-w-0">
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Why
                      </dt>
                      <dd className="text-sm text-foreground">{stage.why}</dd>
                    </div>
                  </div>
                </dl>
                {stage.caution ? (
                  <p className="mt-3 flex items-start gap-2 rounded-xl border border-chart-4/40 bg-chart-4/10 px-3 py-2 text-sm text-foreground">
                    <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                    <span className="min-w-0">{stage.caution}</span>
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

import { Clock, Droplets, Gauge, Sprout, Wrench } from "lucide-react";
import type { ReactNode } from "react";
import type { CropRecommendation, DataSource } from "@/services/types";
import { DataSourceBadge } from "@/components/common/DataSourceBadge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { MetricValue } from "@/components/agri/value";
import { cn } from "@/lib/utils";

export function RecommendationCard({
  recommendation,
  source,
  fetchedAt,
  variant = "primary",
  footer,
  className,
}: {
  recommendation: CropRecommendation;
  source: DataSource;
  fetchedAt?: string | undefined;
  variant?: "primary" | "compact";
  footer?: ReactNode;
  className?: string | undefined;
}) {
  const r = recommendation;
  const isPrimary = variant === "primary";

  const facts = [
    { icon: Droplets, label: "Water need", value: r.waterRequirement },
    { icon: Clock, label: "Duration", value: r.growthDurationDays, unit: "days" },
    { icon: Wrench, label: "Complexity", value: r.complexity },
  ];

  return (
    <article
      className={cn(
        "card-surface p-5 transition-shadow duration-200 hover:shadow-md focus-within:shadow-md",
        isPrimary && "border-primary/25",
        className,
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-xl",
              isPrimary ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground",
            )}
          >
            <Sprout aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            {isPrimary ? (
              <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Recommended crop
              </p>
            ) : null}
            <h3 className="truncate text-lg font-semibold tracking-tight text-foreground">{r.crop}</h3>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{r.suitability}</p>
          </div>
        </div>
        <DataSourceBadge source={source} fetchedAt={fetchedAt} className="shrink-0" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {r.confidencePct === null || r.confidencePct === undefined ? (
          <StatusBadge label="Confidence not available" tone="muted" icon={Gauge} />
        ) : (
          <StatusBadge label={`Model confidence ${r.confidencePct}%`} tone="info" icon={Gauge} />
        )}
        {r.weatherSuitability ? (
          <StatusBadge label={`Weather: ${r.weatherSuitability}`} tone="neutral" />
        ) : null}
        {r.soilSuitability ? <StatusBadge label={`Soil: ${r.soilSuitability}`} tone="neutral" /> : null}
      </div>

      {r.confidencePct !== null && r.confidencePct !== undefined ? (
        <div
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary"
          role="meter"
          aria-valuenow={r.confidencePct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Model confidence for ${r.crop}`}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500"
            style={{ width: `${Math.min(100, Math.max(0, r.confidencePct))}%` }}
          />
        </div>
      ) : null}

      <dl className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {facts.map((f) => (
          <div key={f.label} className="rounded-xl border border-border/70 px-3 py-2">
            <dt className="flex items-center gap-1.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
              <f.icon aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="truncate">{f.label}</span>
            </dt>
            <dd className="mt-1 text-sm font-semibold">
              <MetricValue value={f.value ?? null} unit={f.unit} />
            </dd>
          </div>
        ))}
      </dl>

      {footer ? <div className="mt-5">{footer}</div> : null}
    </article>
  );
}

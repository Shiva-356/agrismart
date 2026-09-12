import { FlaskConical, Layers } from "lucide-react";
import type { ReactNode } from "react";
import type { DataSource, SoilStatus } from "@/services/types";
import { DataSourceBadge } from "@/components/common/DataSourceBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { ParameterStatusBadge, RatingBadge } from "@/components/common/StatusBadge";
import { MetricValue } from "@/components/agri/value";
import { cn } from "@/lib/utils";

export function SoilStatusCard({
  status,
  source,
  fetchedAt,
  action,
  className,
}: {
  status: SoilStatus;
  source: DataSource;
  fetchedAt?: string | undefined;
  action?: ReactNode;
  className?: string | undefined;
}) {
  const tested = status.parameters.filter((p) => p.status === "available").length;

  return (
    <section className={cn("card-surface p-5", className)} aria-labelledby="soil-status-title">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h2
            id="soil-status-title"
            className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
          >
            Soil status
          </h2>
          <p className="mt-1 text-lg font-semibold tracking-tight text-foreground">
            {status.hasReport ? "Laboratory report linked" : "No soil report yet"}
          </p>
          {status.hasReport ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {tested} of {status.parameters.length} parameters tested
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <DataSourceBadge source={source} fetchedAt={fetchedAt} />
          <Layers aria-hidden="true" className="size-5 text-accent-foreground/70" />
        </div>
      </div>

      {status.hasReport && status.parameters.length > 0 ? (
        <ul className="mt-5 divide-y divide-border/70">
          {status.parameters.map((p) => (
            <li key={p.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{p.label}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <ParameterStatusBadge status={p.status} />
                  <RatingBadge rating={p.rating ?? null} />
                </div>
              </div>
              <p className="shrink-0 text-right text-base font-semibold">
                <MetricValue
                  value={p.status === "available" ? p.value : null}
                  unit={p.status === "available" ? p.unit : null}
                  fallback={p.status === "not_tested" ? "Not tested" : "Not available"}
                />
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          className="mt-5 border-0 bg-transparent px-0 py-8"
          icon={FlaskConical}
          title="Soil data not available"
          description="No laboratory values are shown until a verified report is linked. Nothing is estimated."
          action={action}
        />
      )}

      {status.hasReport && action ? <div className="mt-5">{action}</div> : null}
    </section>
  );
}

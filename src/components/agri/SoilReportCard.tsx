import { BadgeCheck, CalendarDays, FileText, Hash } from "lucide-react";
import type { ReactNode } from "react";
import type { DataSource, SoilReport } from "@/services/types";
import { DataSourceBadge } from "@/components/common/DataSourceBadge";
import { ParameterStatusBadge, StatusBadge } from "@/components/common/StatusBadge";
import { MetricValue } from "@/components/agri/value";
import { cn } from "@/lib/utils";

export function SoilReportCard({
  report,
  source,
  fetchedAt,
  showParameters = true,
  actions,
  className,
}: {
  report: SoilReport;
  source: DataSource;
  fetchedAt?: string | undefined;
  showParameters?: boolean;
  actions?: ReactNode;
  className?: string | undefined;
}) {
  const tested = report.parameters.filter((p) => p.status === "available");

  return (
    <article
      className={cn(
        "card-surface flex flex-col p-5 transition-shadow duration-200 hover:shadow-md focus-within:shadow-md",
        className,
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
            <FileText aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold tracking-tight text-foreground">
              {report.laboratory}
            </h3>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Hash aria-hidden="true" className="size-3.5" />
                {report.sampleId}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays aria-hidden="true" className="size-3.5" />
                {report.testDate}
              </span>
            </p>
          </div>
        </div>
        <DataSourceBadge source={source} fetchedAt={fetchedAt} className="shrink-0" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge
          label={report.status === "ready" ? "Report ready" : "Pending"}
          tone={report.status === "ready" ? "success" : "warning"}
        />
        {report.verified ? <StatusBadge label="Verified" tone="info" icon={BadgeCheck} /> : null}
        <StatusBadge
          label={`${tested.length}/${report.parameters.length} parameters tested`}
          tone="neutral"
        />
      </div>

      {showParameters ? (
        <dl className="mt-4 grid gap-2 sm:grid-cols-2">
          {report.parameters.map((p) => (
            <div
              key={p.key}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-border/70 px-3 py-2"
            >
              <div className="min-w-0">
                <dt className="truncate text-sm font-medium text-foreground">{p.label}</dt>
                {p.status !== "available" ? (
                  <ParameterStatusBadge status={p.status} className="mt-1" />
                ) : null}
              </div>
              <dd className="shrink-0 text-sm font-semibold">
                <MetricValue
                  value={p.status === "available" ? p.value : null}
                  unit={p.status === "available" ? p.unit : null}
                  fallback={p.status === "not_tested" ? "Not tested" : "Not available"}
                />
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      {actions ? <div className="mt-5 flex flex-wrap gap-2">{actions}</div> : null}
    </article>
  );
}

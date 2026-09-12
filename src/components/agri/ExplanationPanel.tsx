import { CheckCircle2, Info, MinusCircle } from "lucide-react";
import type { DataSource, RecommendationResult } from "@/services/types";
import { DataSourceBadge } from "@/components/common/DataSourceBadge";
import { ReliabilityBadge, StatusBadge } from "@/components/common/StatusBadge";
import { FeatureContributionChart } from "@/components/agri/FeatureContributionChart";
import { cn } from "@/lib/utils";

/**
 * Explains WHY a recommendation was made. Every field is optional-safe:
 * missing completeness / reliability / factors are shown as unavailable,
 * never as zero or invented values.
 */
export function ExplanationPanel({
  result,
  source,
  fetchedAt,
  showChart = true,
  className,
}: {
  result: RecommendationResult;
  source: DataSource;
  fetchedAt?: string | undefined;
  showChart?: boolean;
  className?: string | undefined;
}) {
  const completeness = result.dataCompletenessPct;

  return (
    <section className={cn("card-surface p-5", className)} aria-labelledby="explanation-title">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h2
            id="explanation-title"
            className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
          >
            Why this recommendation
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground">{result.explanation}</p>
        </div>
        <DataSourceBadge source={source} fetchedAt={fetchedAt} className="shrink-0" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <ReliabilityBadge reliability={result.reliability} />
        {completeness === null || completeness === undefined ? (
          <StatusBadge label="Data completeness unavailable" tone="muted" icon={Info} />
        ) : (
          <StatusBadge label={`Data completeness ${completeness}%`} tone="neutral" icon={Info} />
        )}
      </div>

      {completeness !== null && completeness !== undefined ? (
        <div
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary"
          role="meter"
          aria-valuenow={completeness}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Data completeness"
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500"
            style={{ width: `${Math.min(100, Math.max(0, completeness))}%` }}
          />
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Data used</h3>
          {result.dataUsed.length ? (
            <ul className="mt-2 space-y-1.5">
              {result.dataUsed.map((d) => (
                <li key={d} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span className="min-w-0">{d}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Not available.</p>
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Missing data</h3>
          {result.dataMissing.length ? (
            <ul className="mt-2 space-y-1.5">
              {result.dataMissing.map((d) => (
                <li key={d} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <MinusCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  <span className="min-w-0">{d}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Nothing reported as missing.</p>
          )}
        </div>
      </div>

      {showChart ? (
        <FeatureContributionChart
          className="mt-5"
          factors={result.factors}
          source={source}
          title="Factor contribution"
          showBadge={false}
        />
      ) : null}
    </section>
  );
}

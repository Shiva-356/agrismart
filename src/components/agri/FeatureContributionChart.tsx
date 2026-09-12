import { BarChart3 } from "lucide-react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DataSource, FeatureContribution } from "@/services/types";
import { DataSourceBadge } from "@/components/common/DataSourceBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { cn } from "@/lib/utils";

/**
 * Horizontal contribution chart for XAI factors (SHAP/LIME style values).
 * Only renders values supplied by the service layer — nothing is imputed.
 */
export function FeatureContributionChart({
  factors,
  source,
  fetchedAt,
  title = "Feature contribution",
  description,
  showBadge = true,
  className,
}: {
  factors: FeatureContribution[];
  source: DataSource;
  fetchedAt?: string | undefined;
  title?: string;
  description?: string;
  showBadge?: boolean;
  className?: string | undefined;
}) {
  const data = factors.filter(
    (f) => typeof f.contribution === "number" && Number.isFinite(f.contribution),
  );
  const hasNegative = data.some((f) => f.contribution < 0);

  return (
    <section
      className={cn("rounded-2xl border border-border bg-card p-5", className)}
      aria-labelledby="feature-contribution-title"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h3
            id="feature-contribution-title"
            className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
          >
            {title}
          </h3>
          {description ? (
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {showBadge ? <DataSourceBadge source={source} fetchedAt={fetchedAt} className="shrink-0" /> : null}
      </div>

      {data.length === 0 ? (
        <EmptyState
          className="mt-4 border-0 bg-transparent px-0 py-8"
          icon={BarChart3}
          title="Explanation values not available"
          description="No factor contributions were returned for this prediction."
        />
      ) : (
        <>
          <div className="mt-4 h-[clamp(180px,40vw,280px)] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 4 }}>
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="feature"
                  width={110}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--card)",
                    fontSize: 12,
                    color: "var(--foreground)",
                  }}
                  formatter={(v: number) => [v, "Contribution"]}
                />
                <Bar dataKey="contribution" radius={[0, 6, 6, 0]} barSize={16}>
                  {data.map((f) => (
                    <Cell
                      key={f.feature}
                      fill={f.contribution < 0 ? "var(--chart-5)" : "var(--chart-1)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2.5 rounded-sm bg-chart-1" /> Supports the crop
            </li>
            {hasNegative ? (
              <li className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2.5 rounded-sm bg-chart-5" /> Works against it
              </li>
            ) : null}
          </ul>
          <table className="sr-only">
            <caption>{title}</caption>
            <thead>
              <tr>
                <th scope="col">Feature</th>
                <th scope="col">Contribution</th>
              </tr>
            </thead>
            <tbody>
              {data.map((f) => (
                <tr key={f.feature}>
                  <th scope="row">{f.feature}</th>
                  <td>{f.contribution}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}

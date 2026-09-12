import { Database, FlaskConical } from "lucide-react";
import type { DataSource } from "@/services/types";
import { cn } from "@/lib/utils";

/**
 * Subtle but visible indicator of where the data came from.
 * Renders nothing for real API data unless `always` is set.
 */
export function DataSourceBadge({
  source,
  fetchedAt,
  always = false,
  className,
}: {
  source: DataSource;
  fetchedAt?: string | undefined;
  always?: boolean;
  className?: string | undefined;
}) {
  const isDemo = source === "demo";
  if (!isDemo && !always) return null;

  const label = isDemo
    ? "Demo data"
    : source === "artifact"
      ? "Trained model results"
      : "Live data";
  const Icon = isDemo ? FlaskConical : Database;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-[0.08em]",
        isDemo
          ? "border-accent/60 bg-accent/25 text-accent-foreground"
          : "border-border bg-secondary text-secondary-foreground",
        className,
      )}
      title={fetchedAt ? `${label} · updated ${new Date(fetchedAt).toLocaleString()}` : label}
    >
      <Icon aria-hidden="true" className="size-3" />
      {label}
    </span>
  );
}

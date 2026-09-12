import { cn } from "@/lib/utils";

/**
 * Renders a numeric value only when it truly exists. Missing values are never
 * coerced to 0 — they render as an explicit "not available" marker.
 */
export function MetricValue({
  value,
  unit,
  fallback = "Not available",
  className,
}: {
  value: number | string | null | undefined;
  unit?: string | null | undefined;
  fallback?: string | undefined;
  className?: string | undefined;
}) {
  if (value === null || value === undefined || value === "") {
    return (
      <span className={cn("text-sm font-medium text-muted-foreground", className)} title={fallback}>
        —<span className="sr-only"> {fallback}</span>
      </span>
    );
  }
  return (
    <span className={cn("text-foreground", className)}>
      <span className="tabular-nums">{value}</span>
      {unit ? <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span> : null}
    </span>
  );
}

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function LoadingSkeleton({
  variant = "card",
  lines = 3,
  count = 1,
  className,
}: {
  variant?: "card" | "list" | "text" | "chart" | "table";
  lines?: number;
  count?: number;
  className?: string | undefined;
}) {
  const items = Array.from({ length: count });

  if (variant === "text") {
    return (
      <div className={cn("space-y-2", className)} aria-busy="true" aria-live="polite">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")} />
        ))}
      </div>
    );
  }

  if (variant === "chart") {
    return (
      <div className={cn("card-surface p-5", className)} aria-busy="true" aria-live="polite">
        <Skeleton className="h-4 w-40" />
        <div className="mt-6 flex h-40 items-end gap-3">
          {[70, 45, 90, 30, 60, 50].map((h, i) => (
            <Skeleton key={i} className="flex-1" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div
        className={cn("card-surface overflow-hidden", className)}
        aria-busy="true"
        aria-live="polite"
      >
        <Skeleton className="h-11 w-full rounded-none" />
        <div className="space-y-px">
          {Array.from({ length: lines }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-none opacity-70" />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div className={cn("space-y-3", className)} aria-busy="true" aria-live="polite">
        {Array.from({ length: Math.max(count, lines) }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
          >
            <Skeleton className="size-10 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn("grid gap-4", count > 1 && "sm:grid-cols-2", className)}
      aria-busy="true"
      aria-live="polite"
    >
      {items.map((_, i) => (
        <div key={i} className="card-surface p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="size-10 shrink-0 rounded-xl" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="mt-5 space-y-2">
            {Array.from({ length: lines }).map((__, j) => (
              <Skeleton key={j} className={cn("h-3.5", j === lines - 1 ? "w-2/3" : "w-full")} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

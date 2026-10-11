import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import type { DataSource } from "@/services/types";
import { DataSourceBadge } from "@/components/common/DataSourceBadge";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
  source,
  fetchedAt,
  className,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  source?: DataSource;
  fetchedAt?: string | undefined;
  className?: string | undefined;
  children?: ReactNode;
}) {
  return (
    <header className={cn("border-b border-border/70 pb-6", className)}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/30 text-accent-foreground">
              <Icon aria-hidden="true" className="size-5" />
            </span>
          ) : null}
          <div className="min-w-0">
            {eyebrow ? (
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {eyebrow}
              </p>
            ) : null}
            <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {title}
            </h1>
            {description ? (
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {actions || source ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {source ? <DataSourceBadge source={source} fetchedAt={fetchedAt} /> : null}
            {actions}
          </div>
        ) : null}
      </div>
      {children ? <div className="mt-5">{children}</div> : null}
    </header>
  );
}

import { BadgeCheck, Clock, MapPin, Navigation, Phone, TestTube2 } from "lucide-react";
import type { ReactNode } from "react";
import type { DataSource, Provider } from "@/services/types";
import { DataSourceBadge } from "@/components/common/DataSourceBadge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { MetricValue } from "@/components/agri/value";
import { cn } from "@/lib/utils";

export function ProviderCard({
  provider,
  source,
  fetchedAt,
  actions,
  className,
}: {
  provider: Provider;
  source: DataSource;
  fetchedAt?: string | undefined;
  actions?: ReactNode;
  className?: string | undefined;
}) {
  const p = provider;

  return (
    <article
      className={cn(
        "card-surface flex flex-col p-5 transition-shadow duration-200 hover:shadow-md focus-within:shadow-md",
        className,
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent/30 text-accent-foreground">
            <TestTube2 aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold tracking-tight text-foreground">{p.name}</h3>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">{p.type}</p>
          </div>
        </div>
        <DataSourceBadge source={source} fetchedAt={fetchedAt} className="shrink-0" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {p.verified ? <StatusBadge label="Verified lab" tone="success" icon={BadgeCheck} /> : null}
        <StatusBadge
          label={p.acceptingSamples ? "Accepting samples" : "Not accepting samples"}
          tone={p.acceptingSamples ? "info" : "muted"}
        />
      </div>

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <dt className="sr-only">Address</dt>
          <dd className="min-w-0 text-muted-foreground">{p.address}</dd>
        </div>
        <div className="flex items-center gap-2">
          <Navigation aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <dt className="sr-only">Distance</dt>
          <dd className="text-muted-foreground">
            <MetricValue value={p.distanceKm} unit="km away" fallback="Distance not available" />
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <Clock aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <dt className="sr-only">Opening hours</dt>
          <dd className="min-w-0 truncate text-muted-foreground">
            {p.openingHours ?? "Hours not available"}
          </dd>
        </div>
        {p.phone ? (
          <div className="flex items-center gap-2">
            <Phone aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <dt className="sr-only">Phone</dt>
            <dd>
              <a
                href={`tel:${p.phone}`}
                className="rounded text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {p.phone}
              </a>
            </dd>
          </div>
        ) : null}
      </dl>

      {p.testTypes.length || p.services.length ? (
        <ul className="mt-4 flex flex-wrap gap-1.5">
          {[...p.testTypes, ...p.services].slice(0, 6).map((t) => (
            <li
              key={t}
              className="rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-xs text-secondary-foreground"
            >
              {t}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-4 text-xs text-muted-foreground">
        Report time:{" "}
        <MetricValue
          value={p.reportTimeDays}
          unit="days"
          fallback="Not published by the laboratory"
          className="text-xs font-medium"
        />
      </p>

      {actions ? <div className="mt-5 flex flex-wrap gap-2">{actions}</div> : null}
    </article>
  );
}

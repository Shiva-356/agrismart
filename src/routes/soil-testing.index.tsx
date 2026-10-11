import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BadgeCheck, List, Map as MapIcon, MapPin, Phone, Search, TestTubes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { ProviderCard } from "@/components/agri/ProviderCard";
import { providersService } from "@/services";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/soil-testing/")({
  head: () => ({
    meta: [
      { title: "Find Soil Testing Near You — AgriSmart" },
      {
        name: "description",
        content:
          "Find nearby soil testing centres, see what they test, and book a soil sample appointment.",
      },
      { property: "og:title", content: "Find Soil Testing Near You — AgriSmart" },
      {
        property: "og:description",
        content:
          "Find nearby soil testing centres, see what they test, and book a soil sample appointment.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SoilTestingPage,
});

function SoilTestingPage() {
  const [view, setView] = useState<"list" | "map">("list");
  const [q, setQ] = useState("");
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [onlyAccepting, setOnlyAccepting] = useState(false);

  const providers = useQuery({
    queryKey: ["providers"],
    queryFn: () => providersService.list(),
  });

  const filtered = useMemo(() => {
    const all = providers.data?.data ?? [];
    const term = q.trim().toLowerCase();
    return all.filter((p) => {
      if (onlyVerified && !p.verified) return false;
      if (onlyAccepting && !p.acceptingSamples) return false;
      if (!term) return true;
      return [p.name, p.type, p.address, ...p.testTypes, ...p.services]
        .join(" ")
        .toLowerCase()
        .includes(term);
    });
  }, [providers.data, q, onlyVerified, onlyAccepting]);

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid gap-6 bg-gradient-to-br from-accent/25 via-card to-card p-6 sm:p-9 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-center">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Soil testing services
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Don&apos;t know your soil NPK or pH?
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              That&apos;s okay. Find a nearby soil testing service and get verified information
              about your soil.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <a href="#providers">
                  <Search aria-hidden="true" className="size-4" />
                  Find soil testing
                </a>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/soil-reports">I already have a soil report</Link>
              </Button>
            </div>
            <p className="mt-5 max-w-xl text-xs leading-relaxed text-muted-foreground">
              AgriSmart helps you connect with soil testing services so your crop recommendations
              can use better soil information. AgriSmart does not carry out laboratory testing
              itself.
            </p>
          </div>
          <ul className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-1">
            {[
              { icon: MapPin, text: "See testing centres near your farm" },
              { icon: TestTubes, text: "Check what each centre can test" },
              { icon: BadgeCheck, text: "Book a visit or sample collection" },
            ].map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="flex items-start gap-3 rounded-2xl border border-border/70 bg-card/80 p-4"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <span className="text-muted-foreground">{text}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div id="providers">
        <PageHeader
          title="Testing centres"
          description="Only details published by each centre are shown. Nothing is estimated."
          icon={TestTubes}
          {...(providers.data
            ? { source: providers.data.source, fetchedAt: providers.data.fetchedAt }
            : {})}
          actions={
            <div className="flex rounded-xl border border-border bg-card p-1">
              {[
                { key: "list" as const, label: "List", icon: List },
                { key: "map" as const, label: "Map", icon: MapIcon },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setView(key)}
                  aria-pressed={view === key}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    view === key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon aria-hidden="true" className="size-4" />
                  {label}
                </button>
              ))}
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <label className="relative block">
              <span className="sr-only">Search by centre name or location</span>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by place or centre name"
                className="pl-9"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <FilterChip active={onlyAccepting} onClick={() => setOnlyAccepting((v) => !v)}>
                Testing available
              </FilterChip>
              <FilterChip active={onlyVerified} onClick={() => setOnlyVerified((v) => !v)}>
                Verified centres
              </FilterChip>
            </div>
          </div>
        </PageHeader>
      </div>

      {providers.isPending ? (
        <LoadingSkeleton variant="list" count={3} />
      ) : providers.isError ? (
        <ErrorState
          title="We couldn't load testing centres"
          onRetry={() => void providers.refetch()}
        />
      ) : view === "map" ? (
        <MapPlaceholder count={filtered.length} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No testing centres match your search"
          description="Try a different place name, or clear the filters to see every centre we have."
          action={
            <Button
              variant="outline"
              onClick={() => {
                setQ("");
                setOnlyVerified(false);
                setOnlyAccepting(false);
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {filtered.map((p) => (
            <li key={p.id} className="min-w-0">
              <ProviderCard
                provider={p}
                source={providers.data.source}
                fetchedAt={providers.data.fetchedAt}
                className="h-full"
                actions={
                  <>
                    <Button asChild size="sm">
                      <Link to="/soil-testing/$providerId" params={{ providerId: p.id }}>
                        View details
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/appointments/book" search={{ providerId: p.id }}>
                        Book appointment
                      </Link>
                    </Button>
                    {p.phone ? (
                      <Button asChild size="sm" variant="ghost">
                        <a href={`tel:${p.phone}`}>
                          <Phone aria-hidden="true" className="size-4" />
                          Call
                        </a>
                      </Button>
                    ) : null}
                  </>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function MapPlaceholder({ count }: { count?: number }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <div className="relative flex flex-col items-center justify-center px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-accent/30 text-accent-foreground">
          <MapIcon aria-hidden="true" className="size-6" />
        </span>
        <h3 className="mt-4 text-base font-semibold tracking-tight text-foreground">
          Map view is not connected yet
        </h3>
        <p className="mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
          Map integration will display nearby testing providers when location services are
          available. No locations are plotted, because we do not show unverified coordinates on a
          map.
        </p>
        {typeof count === "number" ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {count} centre{count === 1 ? "" : "s"} available in list view.
          </p>
        ) : null}
      </div>
    </div>
  );
}

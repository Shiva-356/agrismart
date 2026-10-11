import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Calendar,
  Droplets,
  Filter,
  Leaf,
  Search,
  Sparkles,
  Sprout,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { StatusBadge } from "@/components/common/StatusBadge";
import { MetricValue } from "@/components/agri/value";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { farmsService, recommendationsService, cultivationService } from "@/services";
import { ALL_CULTIVATION_GUIDES, type CropCultivationGuide } from "@/data/crop-cultivation";

export const Route = createFileRoute("/cultivation/")({
  loader: async () => {
    return await cultivationService.listAll();
  },
  head: () => ({
    meta: [
      { title: "Cultivation Guides Catalog — AgriSmart" },
      {
        name: "description",
        content:
          "Authoritative, stage-by-stage cultivation guides for all 22 crops supported by AgriSmart's recommendation engine.",
      },
      { property: "og:title", content: "Cultivation Guides Catalog — AgriSmart" },
      {
        property: "og:description",
        content:
          "Comprehensive agronomic procedures from land preparation to harvest and post-harvest management.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "/cultivation" }],
  }),
  component: CultivationIndexPage,
});

const CATEGORIES = ["All", "Cereal", "Pulse", "Fruit", "Fibre & Commercial", "Plantation"] as const;

function CultivationIndexPage() {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");

  const farmQ = useQuery({ queryKey: ["farm"], queryFn: () => farmsService.getActiveFarm() });
  const farmId = farmQ.data?.data?.id;

  const recQ = useQuery({
    queryKey: ["recommendation", farmId],
    queryFn: () => recommendationsService.get(farmId as string),
    enabled: Boolean(farmId),
  });

  const allGuidesQ = useQuery({
    queryKey: ["cultivation-all"],
    queryFn: () => cultivationService.listAll(),
    initialData: () => ({
      data: ALL_CULTIVATION_GUIDES,
      source: "artifact" as const,
      fetchedAt: new Date().toISOString(),
    }),
  });

  const allGuides = useMemo(
    () =>
      allGuidesQ.data?.data && allGuidesQ.data.data.length > 0
        ? allGuidesQ.data.data
        : ALL_CULTIVATION_GUIDES,
    [allGuidesQ.data?.data],
  );

  const rec = recQ.data?.data;
  const recommendedCrops = rec ? [rec.top, ...rec.alternatives] : [];

  const filteredGuides = useMemo(() => {
    return allGuides.filter((guide: CropCultivationGuide) => {
      const matchesCategory = selectedCategory === "All" || guide.category === selectedCategory;
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        guide.crop.toLowerCase().includes(q) ||
        guide.displayName.toLowerCase().includes(q) ||
        guide.category.toLowerCase().includes(q) ||
        guide.overview.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [allGuides, selectedCategory, search]);

  return (
    <div className="space-y-8 pb-10">
      <PageHeader
        eyebrow="Agricultural Knowledge Base"
        title="Cultivation Guides"
        description="Comprehensive, source-backed agronomic guidance covering all 22 crops supported by our recommendation system."
        icon={Sprout}
      />

      {/* Recommended for your farm section */}
      {recommendedCrops.length > 0 && (
        <section aria-labelledby="recommended-title" className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden="true" />
            <h2 id="recommended-title" className="text-base font-semibold text-foreground">
              Recommended for your farm
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recommendedCrops.map((c, i) => (
              <article key={c.crop} className="card-surface flex flex-col justify-between p-5">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Leaf aria-hidden="true" className="size-4" />
                      </span>
                      <div>
                        <h3 className="font-semibold text-foreground capitalize">{c.crop}</h3>
                        <p className="text-xs text-muted-foreground">
                          Suitability: <MetricValue value={c.suitability ?? null} />
                        </p>
                      </div>
                    </div>
                    {i === 0 ? (
                      <StatusBadge label="Top Pick" tone="success" />
                    ) : (
                      <StatusBadge label="Alternative" tone="neutral" />
                    )}
                  </div>

                  <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl border border-border/70 p-2">
                      <dt className="text-muted-foreground">Duration</dt>
                      <dd className="font-semibold text-foreground mt-0.5">
                        <MetricValue value={c.growthDurationDays} unit="days" />
                      </dd>
                    </div>
                    <div className="rounded-xl border border-border/70 p-2">
                      <dt className="text-muted-foreground">Water Need</dt>
                      <dd className="font-semibold text-foreground mt-0.5 truncate">
                        <MetricValue value={c.waterRequirement} />
                      </dd>
                    </div>
                  </dl>
                </div>

                <Button asChild size="sm" className="mt-4 w-full">
                  <Link to="/cultivation/$crop" params={{ crop: c.crop.toLowerCase() }}>
                    View cultivation guide
                  </Link>
                </Button>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Explore All 22 Crops Catalog */}
      <section aria-labelledby="catalog-title" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-primary" aria-hidden="true" />
            <h2 id="catalog-title" className="text-base font-semibold text-foreground">
              Explore all 22 crop guides
            </h2>
            <span className="rounded-full bg-accent/30 px-2 py-0.5 text-xs font-medium text-foreground">
              {filteredGuides.length}
            </span>
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by crop, pulse, fruit..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-8"
              aria-label="Search crop guides"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Category Filters */}
        <div
          className="flex flex-wrap items-center gap-1.5"
          role="tablist"
          aria-label="Crop categories"
        >
          <span className="mr-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Filter className="size-3" /> Filter:
          </span>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={selectedCategory === cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                selectedCategory === cat
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Catalog Grid */}
        {allGuidesQ.isPending && allGuides.length === 0 ? (
          <LoadingSkeleton variant="card" count={6} />
        ) : allGuidesQ.isError && allGuides.length === 0 ? (
          <ErrorState
            title="Unable to load crop guides"
            onRetry={() => void allGuidesQ.refetch()}
          />
        ) : filteredGuides.length === 0 ? (
          <EmptyState
            icon={Sprout}
            title="No matching crops found"
            description={`No crops matched "${search}". Try searching for another name or selecting a different category.`}
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setSelectedCategory("All");
                }}
              >
                Reset filters
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredGuides.map((guide) => (
              <article
                key={guide.crop}
                className="card-surface flex flex-col justify-between p-5 transition-shadow hover:shadow-md"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold text-foreground">
                        {guide.displayName}
                      </h3>
                      <span className="inline-block rounded-md bg-accent/40 px-2 py-0.5 text-[11px] font-medium text-foreground mt-0.5">
                        {guide.category}
                      </span>
                    </div>
                  </div>

                  <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {guide.overview}
                  </p>

                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 rounded-lg border border-border/70 p-2">
                      <Calendar className="size-3.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <dt className="text-[10px] uppercase text-muted-foreground">Cycle</dt>
                        <dd className="font-semibold text-foreground truncate">
                          {guide.durationDays} days
                        </dd>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 rounded-lg border border-border/70 p-2">
                      <Droplets className="size-3.5 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <dt className="text-[10px] uppercase text-muted-foreground">Water</dt>
                        <dd
                          className="font-semibold text-foreground truncate"
                          title={guide.waterRequirement}
                        >
                          {guide.waterRequirement.split(" ")[0]}
                        </dd>
                      </div>
                    </div>
                  </dl>
                </div>

                <Button asChild size="sm" variant="outline" className="mt-4 w-full">
                  <Link to="/cultivation/$crop" params={{ crop: guide.crop }}>
                    View full guide
                  </Link>
                </Button>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

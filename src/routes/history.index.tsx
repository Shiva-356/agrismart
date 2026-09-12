import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, History as HistoryIcon, Sprout, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/i18n";
import { loadHistory, type HistoryEntry } from "@/lib/agri";

export const Route = createFileRoute("/history/")({
  head: () => ({
    meta: [
      { title: "History — Saved AgriSmart Recommendations" },
      {
        name: "description",
        content:
          "Browse every crop recommendation you have saved, with the field inputs behind it and links to cultivation guidance.",
      },
      { property: "og:title", content: "History — Saved AgriSmart Recommendations" },
      { property: "og:description", content: "Your saved crop plans in one place." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "/history" }],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const t = useT();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [query, setQuery] = useState("");
  const [crop, setCrop] = useState("all");
  const [source, setSource] = useState("all");

  useEffect(() => {
    const sync = () => setEntries(loadHistory());
    sync();
    window.addEventListener("agrismart:history", sync);
    return () => window.removeEventListener("agrismart:history", sync);
  }, []);

  const crops = useMemo(
    () => Array.from(new Set(entries.flatMap((e) => e.recommendations.map((r) => r.crop)))).sort(),
    [entries],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      const matchesQuery =
        q === "" ||
        (e.input.name ?? "").toLowerCase().includes(q) ||
        e.recommendations.some((r) => r.crop.toLowerCase().includes(q));
      const matchesCrop = crop === "all" || e.recommendations.some((r) => r.crop === crop);
      const matchesSource = source === "all" || e.recommendations.some((r) => r.source === source);
      return matchesQuery && matchesCrop && matchesSource;
    });
  }, [entries, query, crop, source]);

  const count = entries.length;

  return (
    <div className="space-y-6 pb-4">
      <PageHeader
        eyebrow="Your record"
        title={t.history.title}
        description={t.history.subtitle}
        icon={HistoryIcon}
        actions={
          count > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                window.localStorage.removeItem("agrismart.history");
                setEntries([]);
              }}
            >
              <Trash2 aria-hidden="true" className="size-4" /> {t.history.clearAll}
            </Button>
          ) : null
        }
      >
        <p className="text-sm text-muted-foreground">
          {count} {count === 1 ? t.history.saved : t.history.savedPlural}
        </p>
      </PageHeader>

      {count === 0 ? (
        <EmptyState
          icon={Sprout}
          title={t.history.empty}
          description={t.history.emptyHint}
          action={
            <Button asChild>
              <Link to="/recommendations">{t.history.cta}</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.history.search}
              aria-label={t.history.search}
            />
            <select
              value={crop}
              onChange={(e) => setCrop(e.target.value)}
              aria-label={t.history.filterCrop}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="all">{t.history.allCrops}</option>
              {crops.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              aria-label={t.history.filterSource}
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              <option value="all">{t.history.allSources}</option>
              <option value="ML MODEL">ML MODEL</option>
              <option value="RULE-BASED">RULE-BASED</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState title={t.history.noMatches} />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((entry) => (
                <article key={entry.id} className="card-surface flex flex-col p-6">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarDays aria-hidden="true" className="size-3.5" />
                    {new Date(entry.createdAt).toLocaleString()}
                  </p>
                  <h2 className="mt-2 text-lg font-semibold">
                    {entry.input.name || "Untitled farm"}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {entry.input.soilType} soil · {entry.input.landArea} acres · ₹
                    {entry.input.budget.toLocaleString("en-IN")}
                  </p>
                  <ul className="mt-4 space-y-2">
                    {entry.recommendations.map((r) => (
                      <li
                        key={r.crop}
                        className="flex items-center justify-between gap-2 rounded-xl bg-secondary px-3 py-2 text-sm"
                      >
                        <span className="font-medium">{r.crop}</span>
                        <StatusBadge
                          label={r.source}
                          tone={r.source === "ML MODEL" ? "success" : "info"}
                        />
                      </li>
                    ))}
                  </ul>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link to="/history/$id" params={{ id: entry.id }}>
                        {t.history.viewDetail}
                      </Link>
                    </Button>
                    {entry.recommendations[0] ? (
                      <Button asChild size="sm" variant="ghost">
                        <Link
                          to="/cultivation/$crop"
                          params={{ crop: entry.recommendations[0].crop }}
                        >
                          {t.history.viewCultivation}
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

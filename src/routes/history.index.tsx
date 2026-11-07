import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertCircle, CalendarDays, History as HistoryIcon, Sprout, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAgriUser } from "@/hooks/use-agri-user";
import { useT } from "@/i18n";
import { getCropGuideSlug } from "@/data/crop-cultivation";
import type { HistoryEntry, RecommendationSource } from "@/lib/agri";
import { historyService } from "@/services";

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

function getSourceTone(source: RecommendationSource): "success" | "warning" | "info" {
  if (source === "HYBRID" || source === "ML MODEL") return "success";
  if (source === "DEMO / ILLUSTRATIVE") return "warning";
  return "info";
}

function HistoryPage() {
  const t = useT();
  const user = useAgriUser();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [query, setQuery] = useState("");
  const [crop, setCrop] = useState("all");
  const [source, setSource] = useState("all");
  const [pendingDeleteEntry, setPendingDeleteEntry] = useState<HistoryEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setEntries(historyService.list());
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

  async function handleConfirmDelete() {
    if (!pendingDeleteEntry || deletingId) return;
    const target = pendingDeleteEntry;
    setDeletingId(target.id);
    setDeleteError(null);
    try {
      const result = await historyService.deleteRecord(target.id, user);
      if (result.ok) {
        setEntries(result.remaining);
        setPendingDeleteEntry(null);
        toast.success("Saved recommendation deleted.");
      } else {
        const message = result.error ?? "Unable to delete this history record.";
        setDeleteError(message);
        setPendingDeleteEntry(null);
        toast.error(message);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unexpected error while deleting history record.";
      setDeleteError(message);
      setPendingDeleteEntry(null);
      toast.error(message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6 pb-4">
      <PageHeader
        eyebrow="Saved on this device"
        title={t.history.title}
        description={t.history.subtitle}
        icon={HistoryIcon}
        actions={
          count > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDeleteError(null);
                historyService.clearAll();
                setEntries([]);
                toast.success("All saved history records cleared.");
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

      {deleteError ? (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{deleteError}</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
            onClick={() => setDeleteError(null)}
          >
            Dismiss
          </Button>
        </div>
      ) : null}

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
              <option value="HYBRID">HYBRID</option>
              <option value="ML MODEL">ML MODEL</option>
              <option value="RULE-BASED">RULE-BASED</option>
              <option value="DEMO / ILLUSTRATIVE">DEMO / ILLUSTRATIVE</option>
            </select>
          </div>

          {filtered.length === 0 ? (
            <EmptyState title={t.history.noMatches} />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((entry) => {
                const farmTitle = entry.input.name || "Untitled farm";
                const isDeletingThis = deletingId === entry.id;
                return (
                  <article key={entry.id} className="card-surface flex flex-col p-6">
                    <div className="flex items-start justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarDays aria-hidden="true" className="size-3.5" />
                        {new Date(entry.createdAt).toLocaleString()}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isDeletingThis}
                        aria-label={`Delete saved recommendation for ${farmTitle}`}
                        className="h-8 px-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteError(null);
                          setPendingDeleteEntry(entry);
                        }}
                      >
                        <Trash2 aria-hidden="true" className="size-4" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                    <h2 className="mt-2 text-lg font-semibold">{farmTitle}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {entry.input.soilType} soil · {entry.input.landArea} acres · ₹
                      {entry.input.budget.toLocaleString("en-IN")}
                    </p>
                    <ul className="mt-4 space-y-2">
                      {entry.recommendations.map((r, idx) => (
                        <li
                          key={`${r.crop}-${idx}`}
                          className="flex items-center justify-between gap-2 rounded-xl bg-secondary px-3 py-2 text-sm"
                        >
                          <span className="font-medium">
                            {r.overallRank != null ? `#${r.overallRank} ` : ""}
                            {r.crop}
                          </span>
                          <StatusBadge label={r.source} tone={getSourceTone(r.source)} />
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto pt-5 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link to="/history/$id" params={{ id: entry.id }}>
                            {t.history.viewDetail}
                          </Link>
                        </Button>
                        {entry.recommendations[0] ? (
                          <Button asChild size="sm" variant="ghost">
                            <Link
                              to="/cultivation/$crop"
                              params={{
                                crop: getCropGuideSlug(entry.recommendations[0].crop),
                              }}
                            >
                              {t.history.viewCultivation}
                            </Link>
                          </Button>
                        ) : null}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={isDeletingThis}
                        className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteError(null);
                          setPendingDeleteEntry(entry);
                        }}
                      >
                        <Trash2 aria-hidden="true" className="size-3.5" />
                        {isDeletingThis ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}

      <AlertDialog
        open={pendingDeleteEntry !== null}
        onOpenChange={(open) => {
          if (!open && !deletingId) {
            setPendingDeleteEntry(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete saved recommendation?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteEntry ? (
                <>
                  This will permanently remove{" "}
                  <span className="font-medium text-foreground">
                    {pendingDeleteEntry.input.name || "Untitled farm"}
                  </span>{" "}
                  ({new Date(pendingDeleteEntry.createdAt).toLocaleString()}) from your saved
                  history on this device. All other saved recommendations will be preserved.
                </>
              ) : (
                "This will permanently remove the selected recommendation from your saved history."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingId !== null}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deletingId !== null}
              onClick={() => {
                void handleConfirmDelete();
              }}
            >
              {deletingId !== null ? "Deleting..." : "Delete record"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

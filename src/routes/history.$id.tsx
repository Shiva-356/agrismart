import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  FileText,
  History as HistoryIcon,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { MetricValue } from "@/components/agri/value";
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
import { useAgriUser } from "@/hooks/use-agri-user";
import { useT } from "@/i18n";
import { getCropGuideSlug } from "@/data/crop-cultivation";
import type { HistoryEntry, RecommendationSource } from "@/lib/agri";
import { historyService } from "@/services";

export const Route = createFileRoute("/history/$id")({
  head: () => ({
    meta: [
      { title: "Saved Recommendation — AgriSmart History" },
      {
        name: "description",
        content:
          "Review a saved crop recommendation: the inputs you entered, the crops suggested and where each suggestion came from.",
      },
      { property: "og:title", content: "Saved Recommendation — AgriSmart History" },
      {
        property: "og:description",
        content: "The stored details behind one of your saved crop plans.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoryDetailPage,
});

function getSourceTone(source: RecommendationSource): "success" | "warning" | "info" {
  if (source === "HYBRID" || source === "ML MODEL") return "success";
  if (source === "DEMO / ILLUSTRATIVE") return "warning";
  return "info";
}

function Row({ label, value }: { label: string | undefined; value: string | number | null }) {
  if (!label) return null;
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/70 py-2.5 last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">
        <MetricValue value={value} />
      </dd>
    </div>
  );
}

function HistoryDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const user = useAgriUser();
  const t = useT();
  const [entry, setEntry] = useState<HistoryEntry | null | undefined>(undefined);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => setEntry(historyService.getById(id));
    sync();
    window.addEventListener("agrismart:history", sync);
    return () => window.removeEventListener("agrismart:history", sync);
  }, [id]);

  async function handleConfirmDelete() {
    if (!entry || isDeleting) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const result = await historyService.deleteRecord(entry.id, user);
      if (result.ok) {
        setConfirmOpen(false);
        toast.success("Saved recommendation deleted.");
        await navigate({ to: "/history" });
      } else {
        const message = result.error ?? "Unable to delete this history record.";
        setDeleteError(message);
        setConfirmOpen(false);
        toast.error(message);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unexpected error while deleting history record.";
      setDeleteError(message);
      setConfirmOpen(false);
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6 pb-4">
      <PageHeader
        eyebrow={t.history.title}
        title={entry ? entry.input.name || "Untitled farm" : t.history.title}
        description={t.history.subtitle}
        icon={HistoryIcon}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {entry ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isDeleting}
                className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  setDeleteError(null);
                  setConfirmOpen(true);
                }}
              >
                <Trash2 aria-hidden="true" className="size-4" />
                {isDeleting ? "Deleting..." : "Delete record"}
              </Button>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link to="/history">
                <ArrowLeft aria-hidden="true" className="size-4" /> {t.history.backToHistory}
              </Link>
            </Button>
          </div>
        }
      />

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

      {entry === undefined ? null : entry === null ? (
        <EmptyState
          title={t.history.detailMissing}
          description={t.history.emptyHint}
          action={
            <Button asChild>
              <Link to="/history">{t.history.backToHistory}</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <CalendarDays aria-hidden="true" className="size-4" />
              {new Date(entry.createdAt).toLocaleString()}
            </p>
            {entry.sourcesUsed && entry.sourcesUsed.length > 0 ? (
              <StatusBadge
                label={`Sources: ${entry.sourcesUsed.join(" + ")}`}
                tone={entry.sourcesUsed.length > 1 ? "success" : "info"}
              />
            ) : null}
          </div>

          <section className="card-surface p-5 sm:p-6">
            <h2 className="text-lg font-semibold tracking-tight">{t.history.inputs}</h2>
            <dl className="mt-4">
              <Row label="Farm" value={entry.input.name || null} />
              <Row label="Soil type" value={entry.input.soilType} />
              <Row label="Land area (acres)" value={entry.input.landArea} />
              <Row label="Water available" value={entry.input.water} />
              <Row label="Budget (₹)" value={entry.input.budget} />
              <Row label="Preferred crop" value={entry.input.preferredCrop || null} />
              <Row label="Notes" value={entry.input.notes || null} />
              {entry.featuresUsed ? (
                <>
                  <div className="mt-4 pt-4 border-t border-border/60">
                    <h3 className="text-sm font-semibold text-foreground">
                      Tested Laboratory & Weather Features
                    </h3>
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="rounded-lg bg-secondary/50 p-2">
                        <span className="text-muted-foreground">Nitrogen (N):</span>{" "}
                        <span className="font-semibold">{entry.featuresUsed.N} kg/ha</span>
                      </div>
                      <div className="rounded-lg bg-secondary/50 p-2">
                        <span className="text-muted-foreground">Phosphorus (P):</span>{" "}
                        <span className="font-semibold">{entry.featuresUsed.P} kg/ha</span>
                      </div>
                      <div className="rounded-lg bg-secondary/50 p-2">
                        <span className="text-muted-foreground">Potassium (K):</span>{" "}
                        <span className="font-semibold">{entry.featuresUsed.K} kg/ha</span>
                      </div>
                      <div className="rounded-lg bg-secondary/50 p-2">
                        <span className="text-muted-foreground">Soil pH:</span>{" "}
                        <span className="font-semibold">{entry.featuresUsed.ph}</span>
                      </div>
                      <div className="rounded-lg bg-secondary/50 p-2">
                        <span className="text-muted-foreground">Temperature:</span>{" "}
                        <span className="font-semibold">{entry.featuresUsed.temperature}°C</span>
                      </div>
                      <div className="rounded-lg bg-secondary/50 p-2">
                        <span className="text-muted-foreground">Humidity:</span>{" "}
                        <span className="font-semibold">{entry.featuresUsed.humidity}%</span>
                      </div>
                      <div className="rounded-lg bg-secondary/50 p-2">
                        <span className="text-muted-foreground">Seasonal rainfall:</span>{" "}
                        <span className="font-semibold">{entry.featuresUsed.rainfall} mm</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <Row label="Soil report" value={null} />
                  <Row label="Weather at the time" value={null} />
                  <Row label="Data completeness" value={null} />
                  <Row label="Reliability" value={null} />
                </>
              )}
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">
              {entry.featuresUsed
                ? "Feature snapshot recorded during Random Forest & Hybrid evaluation."
                : t.history.notStored}
            </p>
          </section>

          <section className="card-surface p-5 sm:p-6">
            <h2 className="text-lg font-semibold tracking-tight">{t.history.recommended}</h2>
            {entry.disclaimer ? (
              <p className="mt-1 text-xs text-muted-foreground">{entry.disclaimer}</p>
            ) : null}
            <ul className="mt-4 space-y-3">
              {entry.recommendations.map((r, i) => {
                const rulePct =
                  r.suitabilityScore ?? (r.source !== "ML MODEL" ? r.confidence : null);
                const mlPct = r.voteSharePct ?? null;
                return (
                  <li
                    key={`${r.crop}-${i}`}
                    className="rounded-xl border border-border bg-card p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-base font-semibold">
                        {r.overallRank != null ? `#${r.overallRank} ` : ""}
                        {r.crop}
                      </h3>
                      <StatusBadge label={r.source} tone={getSourceTone(r.source)} />
                    </div>
                    <dl className="mt-3">
                      {rulePct != null ? (
                        <Row label="Agronomic compatibility score" value={`${rulePct}%`} />
                      ) : null}
                      {mlPct != null ? (
                        <Row label="Uncalibrated ML model score" value={`${mlPct}%`} />
                      ) : null}
                      {r.growthDurationDays != null ? (
                        <Row
                          label="Growth duration (Catalog)"
                          value={`${r.growthDurationDays} days`}
                        />
                      ) : null}
                      {r.waterNeed ? <Row label="Water need" value={r.waterNeed} /> : null}
                      {r.expectedYield ? (
                        <Row label="Expected yield" value={r.expectedYield} />
                      ) : null}
                      {r.estimatedProfit ? (
                        <Row label="Estimated profit" value={r.estimatedProfit} />
                      ) : null}
                      {r.economicNote ? (
                        <Row label="Economic evaluation" value={r.economicNote} />
                      ) : null}
                      {r.modelName ? <Row label="Evaluation method" value={r.modelName} /> : null}
                    </dl>
                    {r.hybridRationale ? (
                      <p className="mt-3 rounded-lg bg-secondary/50 px-3 py-2 text-xs leading-relaxed text-foreground">
                        {r.hybridRationale}
                      </p>
                    ) : null}
                    {r.rationale ? (
                      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                        {r.rationale}
                      </p>
                    ) : null}
                    {r.note ? (
                      <p className="mt-2 text-xs italic text-muted-foreground">* {r.note}</p>
                    ) : null}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/cultivation/$crop" params={{ crop: getCropGuideSlug(r.crop) }}>
                          {t.history.viewCultivation}
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/soil-reports">
                          <FileText aria-hidden="true" className="size-4" />
                          {t.history.viewSoilReport}
                        </Link>
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setConfirmOpen(false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete saved recommendation?</AlertDialogTitle>
            <AlertDialogDescription>
              {entry ? (
                <>
                  This will permanently remove{" "}
                  <span className="font-medium text-foreground">
                    {entry.input.name || "Untitled farm"}
                  </span>{" "}
                  ({new Date(entry.createdAt).toLocaleString()}) from your saved history on this
                  device. All other saved recommendations will be preserved.
                </>
              ) : (
                "This will permanently remove this recommendation from your saved history."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={() => {
                void handleConfirmDelete();
              }}
            >
              {isDeleting ? "Deleting..." : "Delete record"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

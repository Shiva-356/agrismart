import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CalendarDays, FileText, History as HistoryIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
import { MetricValue } from "@/components/agri/value";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { loadHistory, type HistoryEntry } from "@/lib/agri";

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

function Row({ label, value }: { label: string; value: string | number | null }) {
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
  const t = useT();
  const [entry, setEntry] = useState<HistoryEntry | null | undefined>(undefined);

  useEffect(() => {
    const sync = () => setEntry(loadHistory().find((e) => e.id === id) ?? null);
    sync();
    window.addEventListener("agrismart:history", sync);
    return () => window.removeEventListener("agrismart:history", sync);
  }, [id]);

  return (
    <div className="space-y-6 pb-4">
      <PageHeader
        eyebrow={t.history.title}
        title={entry ? entry.input.name || "Untitled farm" : t.history.title}
        description={t.history.subtitle}
        icon={HistoryIcon}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/history">
              <ArrowLeft aria-hidden="true" className="size-4" /> {t.history.backToHistory}
            </Link>
          </Button>
        }
      />

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
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarDays aria-hidden="true" className="size-4" />
            {new Date(entry.createdAt).toLocaleString()}
          </p>

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
              <Row label="Soil report" value={null} />
              <Row label="Weather at the time" value={null} />
              <Row label="Data completeness" value={null} />
              <Row label="Reliability" value={null} />
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">{t.history.notStored}</p>
          </section>

          <section className="card-surface p-5 sm:p-6">
            <h2 className="text-lg font-semibold tracking-tight">{t.history.recommended}</h2>
            <ul className="mt-4 space-y-3">
              {entry.recommendations.map((r) => (
                <li key={r.crop} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-semibold">{r.crop}</h3>
                    <StatusBadge
                      label={r.source}
                      tone={r.source === "ML MODEL" ? "success" : "info"}
                    />
                  </div>
                  <dl className="mt-3">
                    <Row label="Confidence" value={r.confidence ? `${r.confidence}%` : null} />
                    <Row label="Expected yield" value={r.expectedYield || null} />
                    <Row label="Water need" value={r.waterNeed || null} />
                    <Row label="Estimated profit" value={r.estimatedProfit || null} />
                  </dl>
                  {r.rationale ? (
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {r.rationale}
                    </p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link to="/cultivation/$crop" params={{ crop: r.crop }}>
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
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

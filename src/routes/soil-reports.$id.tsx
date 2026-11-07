import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, FileText, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { SoilReportCard } from "@/components/agri/SoilReportCard";
import { buildActivePlanFromSoilReport, loadActivePlan, saveActivePlan } from "@/lib/agri";
import {
  soilReportsService,
  type Envelope,
  type Farm,
  type SoilReport,
  type Weather,
} from "@/services";

export const Route = createFileRoute("/soil-reports/$id")({
  head: () => ({
    meta: [
      { title: "Soil Health Report — AgriSmart" },
      {
        name: "description",
        content:
          "Your verified soil report: which soil values were tested, which were not, and what to do next.",
      },
      { property: "og:title", content: "Soil Health Report — AgriSmart" },
      {
        property: "og:description",
        content:
          "Your verified soil report: which soil values were tested, which were not, and what to do next.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SoilReportDetailPage,
});

function SoilReportDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: ["soil-report", id], queryFn: () => soilReportsService.byId(id) });
  const report = q.data?.data ?? null;

  const handleUseForRecommendation = (selected: SoilReport) => {
    const cachedFarm = queryClient.getQueryData<Envelope<Farm | null>>(["farm"])?.data ?? null;
    const cachedWeather = cachedFarm?.id
      ? (queryClient.getQueryData<Envelope<Weather>>(["weather", cachedFarm.id])?.data ?? null)
      : null;

    const nextPlan = buildActivePlanFromSoilReport({
      report: selected,
      existingPlan: loadActivePlan(),
      fallbackFarm: cachedFarm,
      ambientWeather: cachedWeather,
    });
    saveActivePlan(nextPlan);

    const loadedCount = nextPlan.linkedSoilReport?.loadedKeys.length ?? 0;
    toast.success(
      loadedCount > 0
        ? `Applied ${loadedCount} verified soil measurement${loadedCount === 1 ? "" : "s"} from ${selected.laboratory}.`
        : `Linked report from ${selected.laboratory} (no tested N/P/K/pH values found).`,
    );
    void navigate({
      to: "/recommendations",
      search: { soilReportId: selected.id },
    });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Your soil information"
        title="Soil health report"
        description="Values shown here come from the testing centre. Nothing is estimated or filled in."
        icon={FileText}
        {...(q.data ? { source: q.data.source, fetchedAt: q.data.fetchedAt } : {})}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link to="/soil-reports">
              <ArrowLeft aria-hidden="true" className="size-4" />
              All reports
            </Link>
          </Button>
        }
      />

      {q.isPending ? (
        <LoadingSkeleton variant="list" count={1} />
      ) : q.isError ? (
        <ErrorState title="We couldn't load this report" onRetry={() => void q.refetch()} />
      ) : !report ? (
        <EmptyState
          icon={FileText}
          title="Report not found"
          description="This soil report is no longer available."
          action={
            <Button asChild>
              <Link to="/soil-reports">Back to soil reports</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <SoilReportCard report={report} source={q.data.source} fetchedAt={q.data.fetchedAt} />

          {report.status === "ready" ? (
            <section className="rounded-2xl border border-border bg-gradient-to-br from-accent/25 via-card to-card p-6">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Your soil report is ready.
              </h2>
              <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Use your verified soil information to improve your crop recommendation.
              </p>
              <Button
                type="button"
                className="mt-5"
                onClick={() => handleUseForRecommendation(report)}
              >
                <Sparkles aria-hidden="true" className="size-4" />
                Use for recommendation
              </Button>
            </section>
          ) : (
            <p className="rounded-2xl border border-dashed border-border bg-card/60 px-5 py-6 text-sm text-muted-foreground">
              The testing centre has not finished this report yet. It will appear here once they
              upload it.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

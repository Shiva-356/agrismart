import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Search, Sparkles } from "lucide-react";
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

export const Route = createFileRoute("/soil-reports/")({
  head: () => ({
    meta: [
      { title: "Your Soil Reports — AgriSmart" },
      {
        name: "description",
        content:
          "See the soil reports uploaded by testing centres and use them for better crop recommendations.",
      },
      { property: "og:title", content: "Your Soil Reports — AgriSmart" },
      {
        property: "og:description",
        content:
          "See the soil reports uploaded by testing centres and use them for better crop recommendations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SoilReportsPage,
});

function SoilReportsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const q = useQuery({ queryKey: ["soil-reports"], queryFn: () => soilReportsService.list() });
  const reports = q.data?.data ?? [];

  const handleUseForRecommendation = (report: SoilReport) => {
    const cachedFarm = queryClient.getQueryData<Envelope<Farm | null>>(["farm"])?.data ?? null;
    const cachedWeather = cachedFarm?.id
      ? (queryClient.getQueryData<Envelope<Weather>>(["weather", cachedFarm.id])?.data ?? null)
      : null;

    const nextPlan = buildActivePlanFromSoilReport({
      report,
      existingPlan: loadActivePlan(),
      fallbackFarm: cachedFarm,
      ambientWeather: cachedWeather,
    });
    saveActivePlan(nextPlan);

    const loadedCount = nextPlan.linkedSoilReport?.loadedKeys.length ?? 0;
    toast.success(
      loadedCount > 0
        ? `Applied ${loadedCount} verified soil measurement${loadedCount === 1 ? "" : "s"} from ${report.laboratory}.`
        : `Linked report from ${report.laboratory} (no tested N/P/K/pH values found).`,
    );
    void navigate({
      to: "/recommendations",
      search: { soilReportId: report.id },
    });
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Your soil information"
        title="Soil reports"
        description="Reports uploaded by the testing centre after your soil sample is tested."
        icon={FileText}
        {...(q.data ? { source: q.data.source, fetchedAt: q.data.fetchedAt } : {})}
        actions={
          <Button asChild size="sm" variant="outline">
            <Link to="/soil-testing">Find soil testing</Link>
          </Button>
        }
      />

      {q.isPending ? (
        <LoadingSkeleton variant="list" count={2} />
      ) : q.isError ? (
        <ErrorState title="We couldn't load your soil reports" onRetry={() => void q.refetch()} />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No soil report yet."
          description="Complete a soil test to get verified information about your soil."
          action={
            <Button asChild>
              <Link to="/soil-testing">
                <Search aria-hidden="true" className="size-4" />
                Find soil testing
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 xl:grid-cols-2">
          {reports.map((r) => (
            <li key={r.id} className="min-w-0">
              <SoilReportCard
                report={r}
                source={q.data.source}
                fetchedAt={q.data.fetchedAt}
                showParameters={false}
                className="h-full"
                actions={
                  <>
                    <Button asChild size="sm">
                      <Link to="/soil-reports/$id" params={{ id: r.id }}>
                        View report
                      </Link>
                    </Button>
                    {r.status === "ready" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleUseForRecommendation(r)}
                      >
                        <Sparkles aria-hidden="true" className="size-4" />
                        Use for recommendation
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

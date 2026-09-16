import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Sprout } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { CultivationTimeline } from "@/components/agri/CultivationTimeline";
import { Button } from "@/components/ui/button";
import { cultivationService } from "@/services";

export const Route = createFileRoute("/cultivation/$crop")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.crop} Cultivation Guide — AgriSmart` },
      {
        name: "description",
        content: `Stage-by-stage cultivation guidance for ${params.crop}, from land preparation through harvest.`,
      },
      { property: "og:title", content: `${params.crop} Cultivation Guide — AgriSmart` },
      {
        property: "og:description",
        content: `What to do and when, for growing ${params.crop}.`,
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: `/cultivation/${params.crop}` }],
  }),
  component: CultivationCropPage,
});

function CultivationCropPage() {
  const { crop } = Route.useParams();
  const guideQ = useQuery({
    queryKey: ["cultivation", crop],
    queryFn: () => cultivationService.getGuide(crop),
  });

  return (
    <div className="space-y-6 pb-4">
      <PageHeader
        eyebrow="Cultivation guide"
        title={crop}
        description="What to do at each stage of the season, and why it matters."
        icon={Sprout}
        {...(guideQ.data ? { source: guideQ.data.source, fetchedAt: guideQ.data.fetchedAt } : {})}
        actions={
          <Button asChild size="sm" variant="outline">
            <Link to="/cultivation">
              <ArrowLeft aria-hidden="true" className="size-4" />
              All guides
            </Link>
          </Button>
        }
      />

      {guideQ.isPending ? (
        <LoadingSkeleton variant="list" lines={4} />
      ) : guideQ.isError ? (
        <ErrorState
          title="Unable to load this cultivation guide"
          onRetry={() => void guideQ.refetch()}
        />
      ) : (
        <CultivationTimeline
          crop={crop}
          stages={guideQ.data?.data ?? []}
          source={guideQ.data?.source ?? "demo"}
          fetchedAt={guideQ.data?.fetchedAt}
        />
      )}

      <section
        className="rounded-2xl border border-primary/25 bg-primary/5 p-5"
        aria-label="Next step"
      >
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Keep going
        </h2>
        <p className="mt-1.5 text-base font-semibold text-foreground">
          Nutrient doses should follow your soil report, not a guess.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link to="/soil-testing">Find soil testing</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to="/recommendations">Back to recommendation</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}

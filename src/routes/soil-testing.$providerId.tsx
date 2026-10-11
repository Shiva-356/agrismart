import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarPlus, MapPin, Navigation, Phone, TestTubes } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { ProviderCard } from "@/components/agri/ProviderCard";
import { MapPlaceholder } from "@/routes/soil-testing.index";
import { providersService } from "@/services";

export const Route = createFileRoute("/soil-testing/$providerId")({
  head: () => ({
    meta: [
      { title: "Soil Testing Centre Details — AgriSmart" },
      {
        name: "description",
        content:
          "See what this soil testing centre offers, how to reach it, and book a sample appointment.",
      },
      { property: "og:title", content: "Soil Testing Centre Details — AgriSmart" },
      {
        property: "og:description",
        content:
          "See what this soil testing centre offers, how to reach it, and book a sample appointment.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProviderDetailsPage,
});

function ProviderDetailsPage() {
  const { providerId } = Route.useParams();
  const q = useQuery({
    queryKey: ["provider", providerId],
    queryFn: () => providersService.byId(providerId),
  });

  const provider = q.data?.data ?? null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Soil testing"
        title={provider?.name ?? "Testing centre"}
        description="Only details published by this centre are shown."
        icon={TestTubes}
        {...(q.data ? { source: q.data.source, fetchedAt: q.data.fetchedAt } : {})}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link to="/soil-testing">
              <ArrowLeft aria-hidden="true" className="size-4" />
              All centres
            </Link>
          </Button>
        }
      />

      {q.isPending ? (
        <LoadingSkeleton variant="list" count={1} />
      ) : q.isError ? (
        <ErrorState title="We couldn't load this centre" onRetry={() => void q.refetch()} />
      ) : !provider ? (
        <EmptyState
          icon={MapPin}
          title="Testing centre not found"
          description="This centre is no longer listed. Browse the other testing centres near you."
          action={
            <Button asChild>
              <Link to="/soil-testing">Find soil testing</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start">
          <ProviderCard
            provider={provider}
            source={q.data.source}
            fetchedAt={q.data.fetchedAt}
            actions={
              <>
                <Button asChild>
                  <Link to="/appointments/book" search={{ providerId: provider.id }}>
                    <CalendarPlus aria-hidden="true" className="size-4" />
                    Book appointment
                  </Link>
                </Button>
                {provider.phone ? (
                  <Button asChild variant="outline">
                    <a href={`tel:${provider.phone}`}>
                      <Phone aria-hidden="true" className="size-4" />
                      Call
                    </a>
                  </Button>
                ) : null}
                <Button asChild variant="ghost">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                      `${provider.name} ${provider.address}`,
                    )}`}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    <Navigation aria-hidden="true" className="size-4" />
                    Get directions
                  </a>
                </Button>
              </>
            }
          />

          <div className="space-y-4">
            <MapPlaceholder />
            <section className="card-surface p-5">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                What happens next
              </h2>
              <ol className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>1. Book a visit or a soil sample collection.</li>
                <li>2. The centre collects and tests your soil sample.</li>
                <li>3. Your soil report appears in AgriSmart when the centre uploads it.</li>
              </ol>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CalendarPlus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { AppointmentTimeline } from "@/components/agri/AppointmentTimeline";
import { appointmentsService } from "@/services";
import type { Appointment } from "@/services/types";

export const Route = createFileRoute("/appointments/")({
  head: () => ({
    meta: [
      { title: "Your Soil Testing Appointments — AgriSmart" },
      {
        name: "description",
        content:
          "Track your soil testing appointments from booking to sample collection, testing and report.",
      },
      { property: "og:title", content: "Your Soil Testing Appointments — AgriSmart" },
      {
        property: "og:description",
        content:
          "Track your soil testing appointments from booking to sample collection, testing and report.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AppointmentsPage,
});

const isPast = (a: Appointment) =>
  a.status === "completed" || new Date(`${a.date}T${a.time || "00:00"}`).getTime() < Date.now();

function AppointmentsPage() {
  const q = useQuery({
    queryKey: ["appointments"],
    queryFn: () => appointmentsService.list(),
  });

  const all = q.data?.data ?? [];
  const upcoming = all.filter((a) => !isPast(a));
  const previous = all.filter(isPast);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Soil testing"
        title="Your appointments"
        description="Follow your soil test from booking to report. Only updates reported by the testing centre are shown."
        icon={CalendarClock}
        {...(q.data ? { source: q.data.source, fetchedAt: q.data.fetchedAt } : {})}
        actions={
          <Button asChild size="sm">
            <Link to="/appointments/book">
              <CalendarPlus aria-hidden="true" className="size-4" />
              Book appointment
            </Link>
          </Button>
        }
      />

      {q.isPending ? (
        <LoadingSkeleton variant="list" count={2} />
      ) : q.isError ? (
        <ErrorState title="We couldn't load your appointments" onRetry={() => void q.refetch()} />
      ) : all.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Your soil-testing appointments will appear here."
          description="Book a visit or a sample collection with a testing centre near your farm."
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
        <div className="space-y-10">
          <Group title="Upcoming" items={upcoming} q={q.data} empty="No upcoming appointments." />
          <Group title="Previous" items={previous} q={q.data} empty="No previous appointments." />
        </div>
      )}
    </div>
  );
}

function Group({
  title,
  items,
  q,
  empty,
}: {
  title: string;
  items: Appointment[];
  q: { source: "demo" | "api"; fetchedAt: string };
  empty: string;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h2>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-card/60 px-5 py-6 text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <ul className="grid gap-4 xl:grid-cols-2">
          {items.map((a) => (
            <li key={a.id} className="min-w-0">
              <AppointmentTimeline
                appointment={a}
                source={q.source}
                fetchedAt={q.fetchedAt}
                className="h-full"
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

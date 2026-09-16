import { CalendarClock } from "lucide-react";
import type { Appointment, AppointmentStatus, DataSource } from "@/services/types";
import { DataSourceBadge } from "@/components/common/DataSourceBadge";
import { AppointmentStatusBadge } from "@/components/common/StatusBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { cn } from "@/lib/utils";

const ORDER: AppointmentStatus[] = [
  "booked",
  "confirmed",
  "sample_collected",
  "testing",
  "report_ready",
  "completed",
];

const LABELS: Record<AppointmentStatus, string> = {
  booked: "Booked",
  confirmed: "Confirmed by lab",
  sample_collected: "Sample collected",
  testing: "Testing in progress",
  report_ready: "Report ready",
  completed: "Completed",
};

export function AppointmentTimeline({
  appointment,
  source,
  fetchedAt,
  className,
}: {
  appointment: Appointment;
  source: DataSource;
  fetchedAt?: string | undefined;
  className?: string | undefined;
}) {
  const history = appointment.history ?? [];
  const reachedAt = new Map(history.map((h) => [h.status, h.at]));
  const currentIndex = ORDER.indexOf(appointment.status);

  return (
    <section
      className={cn("card-surface p-5", className)}
      aria-labelledby="appointment-timeline-title"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h2
            id="appointment-timeline-title"
            className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
          >
            Appointment progress
          </h2>
          <p className="mt-1 truncate text-lg font-semibold tracking-tight text-foreground">
            {appointment.providerName}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {appointment.method === "lab_visit" ? "Lab visit" : "Sample collection"} ·{" "}
            {appointment.date} at {appointment.time}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <DataSourceBadge source={source} fetchedAt={fetchedAt} />
          <AppointmentStatusBadge status={appointment.status} />
        </div>
      </div>

      {history.length === 0 && currentIndex < 0 ? (
        <EmptyState
          className="mt-5 border-0 bg-transparent px-0 py-8"
          icon={CalendarClock}
          title="Status not available"
          description="The laboratory has not reported any status update for this appointment."
        />
      ) : (
        <ol className="mt-5 space-y-0">
          {ORDER.map((status, i) => {
            const done = currentIndex >= 0 && i <= currentIndex;
            const isCurrent = i === currentIndex;
            const at = reachedAt.get(status);
            return (
              <li key={status} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
                <div className="flex flex-col items-center">
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mt-1 size-3 shrink-0 rounded-full border-2",
                      done ? "border-primary bg-primary" : "border-border bg-card",
                      isCurrent && "ring-4 ring-primary/15",
                    )}
                  />
                  {i < ORDER.length - 1 ? (
                    <span
                      aria-hidden="true"
                      className={cn("min-h-8 w-px flex-1", done ? "bg-primary/40" : "bg-border")}
                    />
                  ) : null}
                </div>
                <div className={cn("pb-5", i === ORDER.length - 1 && "pb-0")}>
                  <p
                    className={cn(
                      "text-sm font-medium",
                      done ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {LABELS[status]}
                    {isCurrent ? <span className="sr-only"> (current step)</span> : null}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {at ? new Date(at).toLocaleString() : done ? "Time not reported" : "Pending"}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarPlus, CheckCircle2, ClipboardList, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { DataSourceBadge } from "@/components/common/DataSourceBadge";
import { StatusBadge } from "@/components/common/StatusBadge";
import { appointmentsService, farmsService, providersService } from "@/services";

export const Route = createFileRoute("/appointments/book")({
  validateSearch: (search: Record<string, unknown>): { providerId?: string } =>
    typeof search["providerId"] === "string" ? { providerId: search["providerId"] as string } : {},
  head: () => ({
    meta: [
      { title: "Book a Soil Test — AgriSmart" },
      {
        name: "description",
        content:
          "Book a soil testing visit or sample collection. No soil numbers needed — the centre measures them for you.",
      },
      { property: "og:title", content: "Book a Soil Test — AgriSmart" },
      {
        property: "og:description",
        content:
          "Book a soil testing visit or sample collection. No soil numbers needed — the centre measures them for you.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BookAppointmentPage,
});

type Method = "lab_visit" | "sample_collection";

function BookAppointmentPage() {
  const { providerId } = Route.useSearch();
  const navigate = useNavigate();

  const providers = useQuery({ queryKey: ["providers"], queryFn: () => providersService.list() });
  const farm = useQuery({ queryKey: ["farm"], queryFn: () => farmsService.getActiveFarm() });

  const [selected, setSelected] = useState<string>(providerId ?? "");
  const [method, setMethod] = useState<Method>("sample_collection");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [farmName, setFarmName] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const list = providers.data?.data ?? [];
  const provider = list.find((p) => p.id === selected) ?? null;
  const resolvedFarm = farmName || farm.data?.data.name || "";

  const booking = useMutation({
    mutationFn: () =>
      appointmentsService.book({
        providerId: selected,
        method,
        date,
        time,
        farmName: resolvedFarm,
        notes,
      }),
  });

  const validate = () => {
    const next: Record<string, string> = {};
    if (!selected) next["provider"] = "Choose a testing centre.";
    if (!date) next["date"] = "Choose a preferred date.";
    if (!time) next["time"] = "Choose a preferred time.";
    if (!resolvedFarm.trim()) next["farm"] = "Tell the centre which farm or village to visit.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    booking.mutate();
  };

  if (providers.isPending) {
    return <LoadingSkeleton variant="list" count={2} />;
  }
  if (providers.isError) {
    return (
      <ErrorState
        title="We couldn't load testing centres"
        onRetry={() => void providers.refetch()}
      />
    );
  }

  const result = booking.data;
  const confirmed = result?.data ?? null;
  const demoMode = result?.source === "demo";

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Soil testing"
        title="Book a soil test"
        description="You don't need to know your soil numbers. The testing centre measures them for you."
        icon={CalendarPlus}
        {...(providers.data
          ? { source: providers.data.source, fetchedAt: providers.data.fetchedAt }
          : {})}
      />

      {booking.isSuccess && confirmed ? (
        <section className="card-surface p-6" aria-live="polite">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CheckCircle2 aria-hidden="true" className="size-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Appointment confirmed
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {confirmed.providerName} · {confirmed.date} at {confirmed.time}
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/appointments">Track appointment</Link>
            </Button>
          </div>
        </section>
      ) : booking.isSuccess && demoMode ? (
        <section className="card-surface p-6" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge label="Not booked" tone="warning" />
            <DataSourceBadge source="demo" fetchedAt={result?.fetchedAt} />
          </div>
          <h2 className="mt-3 text-lg font-semibold tracking-tight text-foreground">
            This is demonstration mode — no real appointment was made
          </h2>
          <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Your request details were checked, but no testing centre has received or confirmed them.
            Real bookings will be sent once AgriSmart is connected to live testing centres.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => booking.reset()}>
              Edit request
            </Button>
            <Button asChild variant="ghost">
              <Link to="/appointments">View appointments</Link>
            </Button>
          </div>
        </section>
      ) : booking.isSuccess || booking.isError ? (
        <ErrorState
          title="Unable to confirm your appointment."
          description="The testing centre did not confirm this booking. Nothing has been scheduled."
          onRetry={() => booking.mutate()}
        />
      ) : null}

      {!booking.isSuccess ? (
        <form
          onSubmit={submit}
          noValidate
          className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start"
        >
          <div className="card-surface space-y-5 p-6">
            <Field label="Testing centre" error={errors["provider"]} htmlFor="provider">
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger id="provider">
                  <SelectValue placeholder="Choose a testing centre" />
                </SelectTrigger>
                <SelectContent>
                  {list.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="How should the soil sample be taken?" htmlFor="method">
              <Select value={method} onValueChange={(v) => setMethod(v as Method)}>
                <SelectTrigger id="method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sample_collection">Someone collects from my farm</SelectItem>
                  <SelectItem value="lab_visit">I will visit the centre</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Preferred date" error={errors["date"]} htmlFor="date">
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </Field>
              <Field label="Preferred time" error={errors["time"]} htmlFor="time">
                <Input
                  id="time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </Field>
            </div>

            <Field label="Farm or village" error={errors["farm"]} htmlFor="farm">
              <Input
                id="farm"
                value={resolvedFarm}
                onChange={(e) => setFarmName(e.target.value)}
                placeholder="Which field should they visit?"
              />
            </Field>

            <Field label="Notes for the centre (optional)" htmlFor="notes">
              <Textarea
                id="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Landmarks, best time to reach you, or anything else useful."
              />
            </Field>

            <p className="flex items-start gap-2 rounded-xl bg-secondary/50 p-3 text-xs leading-relaxed text-muted-foreground">
              <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              You never need to enter NPK, pH or any soil numbers. The testing centre measures them
              and sends you a soil report.
            </p>
          </div>

          <aside className="card-surface p-6 lg:sticky lg:top-24">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              <ClipboardList aria-hidden="true" className="size-4" />
              Appointment summary
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <Summary label="Centre" value={provider?.name} />
              <Summary
                label="Testing service"
                value={method === "lab_visit" ? "Visit the centre" : "Sample collection at my farm"}
              />
              <Summary label="Date" value={date} />
              <Summary label="Time" value={time} />
              <Summary label="Location" value={resolvedFarm} />
            </dl>
            <Button type="submit" size="lg" className="mt-6 w-full" disabled={booking.isPending}>
              {booking.isPending ? "Sending request…" : "Confirm appointment"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="mt-2 w-full"
              onClick={() => void navigate({ to: "/soil-testing" })}
            >
              Back to testing centres
            </Button>
          </aside>
        </form>
      ) : null}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Summary({ label, value }: { label: string; value?: string | null | undefined }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 border-b border-border/60 pb-3 last:border-0 last:pb-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-foreground">
        {value ? value : <span className="text-muted-foreground">Not chosen yet</span>}
      </dd>
    </div>
  );
}

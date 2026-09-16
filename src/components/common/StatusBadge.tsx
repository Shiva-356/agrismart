import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  CircleHelp,
  Clock,
  FlaskConical,
  MinusCircle,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { AppointmentStatus, ParameterStatus } from "@/services/types";
import { cn } from "@/lib/utils";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger" | "muted";

const TONE: Record<StatusTone, string> = {
  neutral: "border-border bg-secondary text-secondary-foreground",
  info: "border-accent/60 bg-accent/25 text-accent-foreground",
  success: "border-primary/30 bg-primary/10 text-primary",
  warning: "border-chart-4/50 bg-chart-4/15 text-foreground",
  danger: "border-destructive/40 bg-destructive/10 text-destructive",
  muted: "border-dashed border-border bg-muted text-muted-foreground",
};

export function StatusBadge({
  label,
  tone = "neutral",
  icon: Icon,
  className,
}: {
  label: string;
  tone?: StatusTone;
  icon?: LucideIcon;
  className?: string | undefined;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        TONE[tone],
        className,
      )}
    >
      {Icon ? <Icon aria-hidden="true" className="size-3.5" /> : null}
      <span className="truncate">{label}</span>
    </span>
  );
}

const APPOINTMENT_MAP: Record<
  AppointmentStatus,
  { label: string; tone: StatusTone; icon: LucideIcon }
> = {
  booked: { label: "Booked", tone: "neutral", icon: Clock },
  confirmed: { label: "Confirmed", tone: "info", icon: CheckCircle2 },
  sample_collected: { label: "Sample collected", tone: "info", icon: FlaskConical },
  testing: { label: "Testing in lab", tone: "warning", icon: CircleDashed },
  report_ready: { label: "Report ready", tone: "success", icon: ShieldCheck },
  completed: { label: "Completed", tone: "success", icon: CheckCircle2 },
};

export function AppointmentStatusBadge({
  status,
  className,
}: {
  status: AppointmentStatus;
  className?: string | undefined;
}) {
  const m = APPOINTMENT_MAP[status];
  return <StatusBadge label={m.label} tone={m.tone} icon={m.icon} className={className} />;
}

const PARAMETER_MAP: Record<
  ParameterStatus,
  { label: string; tone: StatusTone; icon: LucideIcon }
> = {
  available: { label: "Tested", tone: "success", icon: CheckCircle2 },
  not_tested: { label: "Not tested", tone: "muted", icon: MinusCircle },
  not_available: { label: "Not available", tone: "muted", icon: CircleHelp },
};

export function ParameterStatusBadge({
  status,
  className,
}: {
  status: ParameterStatus;
  className?: string | undefined;
}) {
  const m = PARAMETER_MAP[status];
  return <StatusBadge label={m.label} tone={m.tone} icon={m.icon} className={className} />;
}

export function RatingBadge({
  rating,
  className,
}: {
  rating: "low" | "optimal" | "high" | null | undefined;
  className?: string | undefined;
}) {
  if (!rating) return null;
  const map = {
    low: { label: "Low", tone: "warning" as StatusTone, icon: TrendingDown },
    optimal: { label: "Optimal", tone: "success" as StatusTone, icon: CheckCircle2 },
    high: { label: "High", tone: "danger" as StatusTone, icon: TrendingUp },
  }[rating];
  return <StatusBadge label={map.label} tone={map.tone} icon={map.icon} className={className} />;
}

export function ReliabilityBadge({
  reliability,
  className,
}: {
  reliability: "High" | "Moderate" | "Low" | null;
  className?: string | undefined;
}) {
  if (!reliability) {
    return (
      <StatusBadge
        label="Reliability unavailable"
        tone="muted"
        icon={CircleHelp}
        className={className}
      />
    );
  }
  const tone: StatusTone =
    reliability === "High" ? "success" : reliability === "Moderate" ? "warning" : "danger";
  return (
    <StatusBadge
      label={`${reliability} reliability`}
      tone={tone}
      icon={reliability === "High" ? ShieldCheck : AlertTriangle}
      className={className}
    />
  );
}

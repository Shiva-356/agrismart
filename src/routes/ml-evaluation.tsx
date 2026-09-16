import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Database,
  FlaskConical,
  Grid3X3,
  ListTree,
  Sigma,
  Sliders,
  Trophy,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { LoadingSkeleton } from "@/components/common/LoadingSkeleton";
import { StatusBadge } from "@/components/common/StatusBadge";
import { MetricValue } from "@/components/agri/value";
import { useT } from "@/i18n";
import { mlEvaluationService } from "@/services";
import type { MlEvaluation as MlEvaluationData } from "@/services/types";

export const Route = createFileRoute("/ml-evaluation")({
  head: () => ({
    meta: [
      { title: "ML Model Evaluation — AgriSmart" },
      {
        name: "description",
        content:
          "Model comparison, cross-validation, confusion matrix, feature importance and dataset provenance for the AgriSmart crop recommendation models.",
      },
      { property: "og:title", content: "ML Model Evaluation — AgriSmart" },
      {
        property: "og:description",
        content: "Transparent evaluation results for the AgriSmart crop recommendation models.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "/ml-evaluation" }],
  }),
  component: MlEvaluationPage,
});

/** Formats a 0–1 metric without changing its meaning. Missing stays missing. */
function ratio(value: number | null | undefined) {
  return value === null || value === undefined ? null : value.toFixed(4);
}

function Section({
  title,
  icon: Icon,
  description,
  children,
}: {
  title: string;
  icon: typeof BarChart3;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card-surface p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent/30 text-accent-foreground">
          <Icon aria-hidden="true" className="size-4.5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Unavailable({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
      {message}
    </p>
  );
}

function Field({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-medium">
        <MetricValue value={value} />
      </dd>
    </div>
  );
}

function MlEvaluationPage() {
  const t = useT();
  const q = useQuery({ queryKey: ["ml-evaluation"], queryFn: () => mlEvaluationService.get() });
  const envelope = q.data;
  const data = envelope?.data;
  const isDemo = envelope?.source === "demo";

  return (
    <div className="space-y-6 pb-4">
      <PageHeader
        eyebrow="Academic / technical"
        title={t.mlEval.title}
        description={t.mlEval.subtitle}
        icon={BarChart3}
        {...(envelope ? { source: envelope.source, fetchedAt: envelope.fetchedAt } : {})}
        actions={
          envelope ? (
            <StatusBadge
              label={isDemo ? t.mlEval.demoBadge : t.mlEval.experimentBadge}
              tone={isDemo ? "warning" : "success"}
              icon={isDemo ? FlaskConical : Database}
            />
          ) : null
        }
      />

      {q.isPending ? (
        <>
          <LoadingSkeleton variant="table" lines={5} />
          <LoadingSkeleton variant="chart" />
        </>
      ) : q.isError ? (
        <ErrorState
          title={t.mlEval.unavailableTitle}
          description={t.mlEval.unavailableHint}
          onRetry={() => void q.refetch()}
        />
      ) : !data ? (
        <EmptyState title={t.mlEval.unavailableTitle} description={t.mlEval.unavailableHint} />
      ) : (
        <>
          {isDemo ? (
            <div
              role="note"
              className="flex items-start gap-3 rounded-2xl border border-chart-4/50 bg-chart-4/10 px-4 py-4"
            >
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
              <div className="text-sm leading-relaxed">
                <p className="font-semibold">{t.mlEval.demoBadge}</p>
                <p className="mt-1 text-muted-foreground">{t.mlEval.demoWarning}</p>
                <p className="mt-1 text-muted-foreground">
                  {t.mlEval.sourceLabel}: {t.mlEval.sourceDemo}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t.mlEval.sourceLabel}: {t.mlEval.sourceApi}
            </p>
          )}

          <DatasetSection data={data} />
          <ComparisonSection data={data} />
          <ChartSection data={data} />
          <CrossValidationSection data={data} />
          <ConfusionSection data={data} />
          <PerClassSection data={data} />
          <ImportanceSection data={data} />
          <AblationSection data={data} />
          <TuningSection data={data} />

          <section className="rounded-2xl border border-border bg-secondary/60 p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
              <AlertTriangle aria-hidden="true" className="size-4.5" />
              {t.mlEval.limitations}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
              {t.mlEval.limitationsBody}
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function DatasetSection({ data }: { data: MlEvaluationData }) {
  const t = useT();
  const d = data.dataset;
  return (
    <Section title={t.mlEval.dataset} icon={Database}>
      {!d ? (
        <Unavailable message={t.mlEval.datasetUnavailable} />
      ) : (
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label={t.mlEval.datasetName} value={d.name} />
          <Field label={t.mlEval.datasetSource} value={d.source} />
          <Field label={t.mlEval.samples} value={d.samples} />
          <Field label={t.mlEval.classCount} value={d.classCount} />
          <Field
            label={t.mlEval.features}
            value={d.features.length > 0 ? d.features.join(", ") : null}
          />
          <Field label={t.mlEval.split} value={d.split} />
          <Field label={t.mlEval.cvStrategy} value={d.crossValidation} />
          <Field label={t.mlEval.license} value={d.license} />
          <Field
            label={t.mlEval.lastEvaluated}
            value={d.evaluatedAt ? new Date(d.evaluatedAt).toLocaleDateString() : null}
          />
        </dl>
      )}
      {data.classes.length > 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {t.mlEval.classCount}: {data.classes.length} — {data.classes.join(", ")}
        </p>
      ) : null}
    </Section>
  );
}

function ComparisonSection({ data }: { data: MlEvaluationData }) {
  const t = useT();
  const rows = data.benchmarks;
  const best = useMemo(
    () => (rows.length > 0 ? rows.reduce((a, b) => (b.macroF1 > a.macroF1 ? b : a)) : null),
    [rows],
  );

  return (
    <Section title={t.mlEval.modelComparison} icon={Sigma} description={t.mlEval.macroF1Note}>
      {rows.length === 0 ? (
        <Unavailable message={t.mlEval.unavailableTitle} />
      ) : (
        <>
          {best ? (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
              <Trophy aria-hidden="true" className="size-4.5 text-primary" />
              <div className="text-sm">
                <span className="font-semibold">{t.mlEval.bestObserved}: </span>
                {best.model} — {t.mlEval.macroF1} <MetricValue value={ratio(best.macroF1)} />
              </div>
            </div>
          ) : null}
          <div className="overflow-x-auto rounded-xl border border-border">
            <Table>
              <caption className="sr-only">{t.mlEval.modelComparison}</caption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{t.mlEval.model}</TableHead>
                  <TableHead scope="col" className="text-right">
                    {t.mlEval.macroF1}
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    {t.mlEval.accuracy}
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    {t.mlEval.precision}
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    {t.mlEval.recall}
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    {t.mlEval.cvScore}
                  </TableHead>
                  <TableHead scope="col">{t.mlEval.trainingStatus}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((m) => (
                  <TableRow key={m.model}>
                    <TableCell className="font-medium whitespace-nowrap">{m.model}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      <MetricValue value={ratio(m.macroF1)} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <MetricValue value={ratio(m.accuracy)} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <MetricValue value={ratio(m.precision)} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <MetricValue value={ratio(m.recall)} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <MetricValue value={ratio(m.crossValidation)} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <StatusBadge label={t.mlEval.evaluated} tone="neutral" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </Section>
  );
}

function ChartSection({ data }: { data: MlEvaluationData }) {
  const t = useT();
  const chartData = data.benchmarks.map((m) => ({
    model: m.model,
    Accuracy: m.accuracy,
    "Macro-F1": m.macroF1,
  }));

  return (
    <Section title={t.mlEval.chartTitle} icon={BarChart3} description={t.mlEval.chartHint}>
      {chartData.length === 0 ? (
        <EmptyState title={t.mlEval.unavailableTitle} description={t.mlEval.unavailableHint} />
      ) : (
        <div className="h-96 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
                horizontal={false}
              />
              <XAxis
                type="number"
                domain={[0, 1]}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
              />
              <YAxis
                type="category"
                dataKey="model"
                width={120}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
              />
              <Tooltip
                cursor={{ fill: "var(--color-secondary)" }}
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "0.75rem",
                  fontSize: 12,
                }}
                formatter={(v: number) => v.toFixed(4)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Macro-F1" fill="var(--color-chart-1)" radius={[0, 6, 6, 0]} />
              <Bar dataKey="Accuracy" fill="var(--color-chart-2)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Section>
  );
}

function CrossValidationSection({ data }: { data: MlEvaluationData }) {
  const t = useT();
  const rows = data.benchmarks.filter((m) => m.crossValidation !== null);
  const strategy = data.dataset?.crossValidation ?? null;

  return (
    <Section title={t.mlEval.crossValidation} icon={ListTree}>
      {rows.length === 0 ? (
        <Unavailable message={t.mlEval.cvUnavailable} />
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {t.mlEval.cvStrategy}: <MetricValue value={strategy} />
          </p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((m) => (
              <li key={m.model} className="rounded-xl border border-border bg-card px-4 py-3">
                <p className="text-sm font-medium">{m.model}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  <MetricValue value={ratio(m.crossValidation)} />
                  {m.crossValidationStd !== null && m.crossValidationStd !== undefined ? (
                    <span className="text-sm font-normal text-muted-foreground">
                      {" "}
                      ± {m.crossValidationStd.toFixed(4)}
                    </span>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
          {rows.every(
            (m) => m.crossValidationStd === null || m.crossValidationStd === undefined,
          ) ? (
            <p className="mt-3 text-xs text-muted-foreground">{t.mlEval.cvStdUnavailable}</p>
          ) : null}
        </>
      )}
    </Section>
  );
}

function ConfusionSection({ data }: { data: MlEvaluationData }) {
  const t = useT();
  const { classes, confusionMatrix } = data;
  const valid =
    classes.length > 0 &&
    confusionMatrix.length === classes.length &&
    confusionMatrix.every((row) => row.length === classes.length);
  const max = valid ? Math.max(...confusionMatrix.flat(), 1) : 1;

  return (
    <Section title={t.mlEval.confusionMatrix} icon={Grid3X3} description={t.mlEval.confusionHint}>
      {!valid ? (
        <Unavailable message={t.mlEval.confusionUnavailable} />
      ) : (
        <div className="max-w-full overflow-x-auto rounded-xl border border-border">
          <table className="w-max min-w-full border-collapse text-sm">
            <caption className="sr-only">{t.mlEval.confusionMatrix}</caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 z-10 bg-card px-3 py-2 text-left text-xs font-semibold text-muted-foreground"
                >
                  {t.mlEval.actual} \ {t.mlEval.predicted}
                </th>
                {classes.map((c) => (
                  <th
                    key={c}
                    scope="col"
                    className="px-3 py-2 text-xs font-semibold whitespace-nowrap"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {confusionMatrix.map((row, i) => (
                <tr key={classes[i]}>
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-card px-3 py-2 text-left text-xs font-semibold whitespace-nowrap"
                  >
                    {classes[i]}
                  </th>
                  {row.map((v, j) => (
                    <td
                      key={`${i}-${j}`}
                      className="px-3 py-2 text-center tabular-nums"
                      style={{
                        background: `color-mix(in srgb, var(--color-chart-1) ${(v / max) * 45}%, transparent)`,
                      }}
                      title={`${t.mlEval.actual}: ${classes[i]} · ${t.mlEval.predicted}: ${classes[j]} · ${v}`}
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function PerClassSection({ data }: { data: MlEvaluationData }) {
  const t = useT();
  const rows = data.perClass ?? [];
  const [sortKey, setSortKey] = useState<"className" | "f1">("f1");
  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) =>
      sortKey === "className"
        ? a.className.localeCompare(b.className)
        : (b.f1 ?? -1) - (a.f1 ?? -1),
    );
    return copy;
  }, [rows, sortKey]);

  return (
    <Section title={t.mlEval.perClass} icon={ListTree}>
      {rows.length === 0 ? (
        <Unavailable message={t.mlEval.perClassUnavailable} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">
                  <button
                    type="button"
                    className="font-medium underline-offset-2 hover:underline"
                    onClick={() => setSortKey(sortKey === "className" ? "f1" : "className")}
                  >
                    {t.mlEval.model}
                  </button>
                </TableHead>
                <TableHead scope="col" className="text-right">
                  {t.mlEval.precision}
                </TableHead>
                <TableHead scope="col" className="text-right">
                  {t.mlEval.recall}
                </TableHead>
                <TableHead scope="col" className="text-right">
                  {t.mlEval.macroF1}
                </TableHead>
                <TableHead scope="col" className="text-right">
                  {t.mlEval.support}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((r) => (
                <TableRow key={r.className}>
                  <TableCell className="font-medium whitespace-nowrap">{r.className}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <MetricValue value={ratio(r.precision)} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <MetricValue value={ratio(r.recall)} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <MetricValue value={ratio(r.f1)} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <MetricValue value={r.support} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Section>
  );
}

function ImportanceSection({ data }: { data: MlEvaluationData }) {
  const t = useT();
  const fi = data.featureImportance ?? [];
  const pi = data.permutationImportance ?? [];

  return (
    <Section title={t.mlEval.featureImportance} icon={Sliders}>
      {fi.length === 0 ? (
        <Unavailable message={t.mlEval.featureImportanceUnavailable} />
      ) : (
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={fi} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
                horizontal={false}
              />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
              />
              <YAxis
                type="category"
                dataKey="feature"
                width={110}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "var(--color-muted-foreground)" }}
              />
              <Tooltip
                cursor={{ fill: "var(--color-secondary)" }}
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: "0.75rem",
                  fontSize: 12,
                }}
                formatter={(v: number) => v.toFixed(4)}
              />
              <Bar dataKey="importance" radius={[0, 6, 6, 0]}>
                {fi.map((f) => (
                  <Cell key={f.feature} fill="var(--color-chart-1)" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <h3 className="mt-6 text-sm font-semibold">{t.mlEval.permutationImportance}</h3>
      <div className="mt-2">
        {pi.length === 0 ? (
          <Unavailable message={t.mlEval.permutationUnavailable} />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {pi.map((p) => (
              <li
                key={p.feature}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-2 text-sm"
              >
                <span>{p.feature}</span>
                <MetricValue value={ratio(p.importance)} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}

function AblationSection({ data }: { data: MlEvaluationData }) {
  const t = useT();
  const ablation = data.ablation ?? [];
  const missing = data.missingDataExperiment ?? [];

  return (
    <Section title={t.mlEval.ablation} icon={FlaskConical}>
      {ablation.length === 0 ? (
        <Unavailable message={t.mlEval.ablationUnavailable} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{t.mlEval.featureSet}</TableHead>
                <TableHead scope="col" className="text-right">
                  {t.mlEval.accuracy}
                </TableHead>
                <TableHead scope="col" className="text-right">
                  {t.mlEval.macroF1}
                </TableHead>
                <TableHead scope="col" className="text-right">
                  {t.mlEval.cvScore}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ablation.map((a) => (
                <TableRow key={a.featureSet}>
                  <TableCell className="font-medium whitespace-nowrap">{a.featureSet}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <MetricValue value={ratio(a.accuracy)} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <MetricValue value={ratio(a.macroF1)} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <MetricValue value={ratio(a.crossValidation)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {missing.length > 0 ? (
        <>
          <h3 className="mt-6 text-sm font-semibold">{t.mlEval.missingDataExperiment}</h3>
          <div className="mt-2 overflow-x-auto rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col">{t.mlEval.scenario}</TableHead>
                  <TableHead scope="col" className="text-right">
                    {t.mlEval.accuracy}
                  </TableHead>
                  <TableHead scope="col" className="text-right">
                    {t.mlEval.macroF1}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {missing.map((m) => (
                  <TableRow key={m.scenario}>
                    <TableCell className="font-medium whitespace-nowrap">{m.scenario}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <MetricValue value={ratio(m.accuracy)} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <MetricValue value={ratio(m.macroF1)} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ) : null}
    </Section>
  );
}

function TuningSection({ data }: { data: MlEvaluationData }) {
  const t = useT();
  const rows = data.tuning ?? [];
  return (
    <Section title={t.mlEval.tuning} icon={Sliders}>
      {rows.length === 0 ? (
        <Unavailable message={t.mlEval.tuningUnavailable} />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {rows.map((r) => (
            <li key={r.model} className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
              <p className="font-semibold">{r.model}</p>
              <p className="mt-1 text-muted-foreground">{r.parametersEvaluated.join(", ")}</p>
              <dl className="mt-2 space-y-1">
                {Object.entries(r.bestParams).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-medium tabular-nums">{String(v)}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-2">
                {t.mlEval.cvScore}: <MetricValue value={ratio(r.bestCvScore)} />
              </p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

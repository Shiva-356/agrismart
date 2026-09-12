import { CloudRain, Droplets, Thermometer, Wind } from "lucide-react";
import type { DataSource, Weather } from "@/services/types";
import { DataSourceBadge } from "@/components/common/DataSourceBadge";
import { MetricValue } from "@/components/agri/value";
import { cn } from "@/lib/utils";

export function WeatherCard({
  weather,
  source,
  fetchedAt,
  className,
}: {
  weather: Weather;
  source: DataSource;
  fetchedAt?: string | undefined;
  className?: string | undefined;
}) {
  const metrics = [
    { icon: Thermometer, label: "Temperature", value: weather.temperatureC, unit: "°C" },
    { icon: Droplets, label: "Humidity", value: weather.humidityPct, unit: "%" },
    { icon: CloudRain, label: "Rainfall", value: weather.rainfallMm, unit: "mm" },
  ];

  return (
    <section className={cn("card-surface p-5", className)} aria-labelledby="weather-card-title">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h2
            id="weather-card-title"
            className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
          >
            Field weather
          </h2>
          <p className="mt-1 truncate text-lg font-semibold tracking-tight text-foreground">
            {weather.condition ?? "Condition not available"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Observed {new Date(weather.observedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <DataSourceBadge source={source} fetchedAt={fetchedAt} />
          <Wind aria-hidden="true" className="size-5 text-accent-foreground/70" />
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-3">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl border border-border bg-secondary/40 p-3">
            <dt className="flex items-center gap-1.5 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
              <m.icon aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="truncate">{m.label}</span>
            </dt>
            <dd className="mt-1.5 text-xl font-semibold">
              <MetricValue value={m.value} unit={m.unit} />
            </dd>
          </div>
        ))}
      </dl>

      {weather.forecast.length > 0 ? (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {weather.forecast.map((f) => (
            <li
              key={f.day}
              className="flex items-center justify-between gap-2 rounded-xl border border-border/70 px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate">
                <span className="font-medium">{f.day}</span>
                <span className="ml-2 text-muted-foreground">{f.condition}</span>
              </span>
              <span className="shrink-0 text-sm font-medium tabular-nums">
                <MetricValue value={f.maxC} unit="°" />
                <span className="mx-1 text-muted-foreground">/</span>
                <MetricValue value={f.minC} unit="°" className="text-muted-foreground" />
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

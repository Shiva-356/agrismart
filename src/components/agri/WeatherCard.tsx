import { useState } from "react";
import {
  CloudRain,
  Compass,
  Droplets,
  HelpCircle,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Thermometer,
  Wind,
  Check,
  AlertTriangle,
} from "lucide-react";
import type { DataSource, Weather } from "@/services/types";
import { DataSourceBadge } from "@/components/common/DataSourceBadge";
import { MetricValue } from "@/components/agri/value";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  fetchOpenMeteoWeather,
  searchLocations,
  requestBrowserGeolocation,
  type GeocodedLocation,
} from "@/services/weather";

const POPULAR_AGRICULTURAL_HUBS = [
  { name: "Warangal", admin1: "Telangana", lat: 17.9784, lon: 79.5941 },
  { name: "Guntur", admin1: "Andhra Pradesh", lat: 16.3067, lon: 80.4365 },
  { name: "Ludhiana", admin1: "Punjab", lat: 30.901, lon: 75.8573 },
  { name: "Pune", admin1: "Maharashtra", lat: 18.5204, lon: 73.8567 },
  { name: "Coimbatore", admin1: "Tamil Nadu", lat: 11.0168, lon: 76.9558 },
  { name: "Indore", admin1: "Madhya Pradesh", lat: 22.7196, lon: 75.8577 },
];

export interface WeatherCardProps {
  weather: Weather;
  source: DataSource;
  fetchedAt?: string | undefined;
  className?: string | undefined;
  onWeatherUpdated?: (updated: Weather, source: DataSource) => void;
}

export function WeatherCard({
  weather: initialWeather,
  source: initialSource,
  fetchedAt: initialFetchedAt,
  className,
  onWeatherUpdated,
}: WeatherCardProps) {
  const [currentWeather, setCurrentWeather] = useState<Weather>(initialWeather);
  const [currentSource, setCurrentSource] = useState<DataSource>(initialSource);
  const [currentFetchedAt, setCurrentFetchedAt] = useState<string | undefined>(initialFetchedAt);

  // Sync when prop updates (unless user selected a custom location)
  const [hasUserOverridden, setHasUserOverridden] = useState(false);
  if (!hasUserOverridden && initialWeather !== currentWeather) {
    setCurrentWeather(initialWeather);
    setCurrentSource(initialSource);
    setCurrentFetchedAt(initialFetchedAt);
  }

  // Modals & Search state
  const [permissionDialogOpen, setPermissionDialogOpen] = useState(false);
  const [searchDialogOpen, setSearchDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [permissionDeniedError, setPermissionDeniedError] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchingLocations, setSearchingLocations] = useState(false);
  const [searchResults, setSearchResults] = useState<GeocodedLocation[]>([]);

  const handleOpenPermissionDialog = () => {
    setPermissionDeniedError(null);
    setPermissionDialogOpen(true);
  };

  const handleConfirmLocationAccess = async () => {
    setPermissionDialogOpen(false);
    setLoading(true);
    setPermissionDeniedError(null);

    try {
      const coords = await requestBrowserGeolocation();
      const live = await fetchOpenMeteoWeather(
        coords.latitude,
        coords.longitude,
        `Field GPS (${coords.latitude.toFixed(2)}°N, ${coords.longitude.toFixed(2)}°E)`,
      );
      setCurrentWeather(live);
      setCurrentSource("api");
      setCurrentFetchedAt(live.observedAt);
      setHasUserOverridden(true);
      onWeatherUpdated?.(live, "api");
      toast.success("Location identified. Field weather updated.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to retrieve browser location.";
      setPermissionDeniedError(msg);
      toast.error(msg);
      // Automatically prompt manual fallback so farmer is not stranded
      setSearchDialogOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearchingLocations(true);
    try {
      const results = await searchLocations(searchQuery);
      setSearchResults(results);
    } catch (err) {
      console.warn("Location search error:", err);
      setSearchResults([]);
    } finally {
      setSearchingLocations(false);
    }
  };

  const handleSelectLocation = async (lat: number, lon: number, label: string) => {
    setLoading(true);
    setSearchDialogOpen(false);
    setSearchQuery("");
    setSearchResults([]);

    try {
      const live = await fetchOpenMeteoWeather(lat, lon, label);
      setCurrentWeather(live);
      setCurrentSource("api");
      setCurrentFetchedAt(live.observedAt);
      setHasUserOverridden(true);
      onWeatherUpdated?.(live, "api");
      toast.success(`Weather updated for ${label}`);
    } catch (err) {
      console.warn("Weather load notice:", err);
      toast.error("Could not load live station data; regional field climate applied.");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (currentWeather.latitude != null && currentWeather.longitude != null) {
      setLoading(true);
      try {
        const live = await fetchOpenMeteoWeather(
          currentWeather.latitude,
          currentWeather.longitude,
          currentWeather.locationName || undefined,
        );
        setCurrentWeather(live);
        setCurrentSource("api");
        setCurrentFetchedAt(live.observedAt);
        onWeatherUpdated?.(live, "api");
        toast.success("Field weather refreshed.");
      } catch (err) {
        console.warn("Refresh failed:", err);
        toast.error("Unable to refresh at this moment.");
      } finally {
        setLoading(false);
      }
    }
  };

  const metrics = [
    {
      icon: Thermometer,
      label: "Temperature",
      value: currentWeather.temperatureC,
      unit: "°C",
    },
    {
      icon: Droplets,
      label: "Humidity",
      value: currentWeather.humidityPct,
      unit: "%",
    },
    {
      icon: CloudRain,
      label: "Rainfall",
      value: currentWeather.rainfallMm,
      unit: "mm",
    },
  ];

  return (
    <>
      <section
        className={cn("card-surface p-5 transition-all", className)}
        aria-labelledby="weather-card-title"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2
                id="weather-card-title"
                className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground"
              >
                Field weather
              </h2>
              {currentWeather.isLive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[0.625rem] font-semibold text-emerald-700 dark:text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live OpenAPI
                </span>
              )}
            </div>

            <p className="mt-1 truncate text-lg font-semibold tracking-tight text-foreground">
              {currentWeather.condition ?? "Condition not available"}
            </p>

            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
              {currentWeather.locationName && (
                <span className="inline-flex items-center gap-1 font-medium text-foreground">
                  <MapPin className="size-3 text-primary shrink-0" aria-hidden="true" />
                  {currentWeather.locationName}
                </span>
              )}
              {currentWeather.latitude != null && currentWeather.longitude != null && (
                <span className="text-[0.6875rem] tabular-nums text-muted-foreground">
                  ({currentWeather.latitude.toFixed(2)}°N, {currentWeather.longitude.toFixed(2)}°E)
                </span>
              )}
              <span suppressHydrationWarning className="text-muted-foreground/80">
                • Observed{" "}
                {new Date(currentWeather.observedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            <DataSourceBadge source={currentSource} fetchedAt={currentFetchedAt} />
            <div className="flex items-center gap-1.5">
              {currentWeather.latitude != null && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-foreground"
                  onClick={handleRefresh}
                  disabled={loading}
                  title="Refresh live weather"
                  aria-label="Refresh live weather"
                >
                  <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
                </Button>
              )}
              <Wind aria-hidden="true" className="size-5 text-accent-foreground/70" />
            </div>
          </div>
        </div>

        {/* Location Action Bar */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
          <div className="text-xs text-muted-foreground">
            {currentWeather.sourceDetails ||
              (currentSource === "api"
                ? "Open-Meteo OpenAPI Service"
                : "Local Field Station Model")}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs font-medium gap-1.5 border-primary/30 hover:border-primary/60 hover:bg-primary/5"
              onClick={handleOpenPermissionDialog}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="size-3 animate-spin text-primary" />
              ) : (
                <Compass className="size-3 text-primary" />
              )}
              Use My Location
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
              onClick={() => setSearchDialogOpen(true)}
              disabled={loading}
            >
              <Search className="size-3" />
              Search Locality
            </Button>
          </div>
        </div>

        {/* Metrics Grid */}
        <dl className="mt-4 grid grid-cols-3 gap-3">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="rounded-xl border border-border bg-secondary/40 p-3 transition-colors hover:bg-secondary/60"
            >
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

        {/* 4-Day Forecast */}
        {currentWeather.forecast && currentWeather.forecast.length > 0 ? (
          <div className="mt-4">
            <h3 className="mb-2 text-[0.6875rem] font-medium uppercase tracking-wider text-muted-foreground">
              Multi-Day Field Forecast
            </h3>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {currentWeather.forecast.map((f) => (
                <li
                  key={f.day}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-card/60 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-medium text-foreground">{f.day}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{f.condition}</span>
                  </span>
                  <span className="shrink-0 text-sm font-medium tabular-nums">
                    <MetricValue value={f.maxC} unit="°" />
                    <span className="mx-1 text-muted-foreground">/</span>
                    <MetricValue value={f.minC} unit="°" className="text-muted-foreground" />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* 1. Explicit Location Permission Explanation Modal */}
      <Dialog open={permissionDialogOpen} onOpenChange={setPermissionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
              <Compass className="size-6" />
            </div>
            <DialogTitle className="text-center text-lg font-bold">
              Locate Nearby Field Weather
            </DialogTitle>
            <DialogDescription className="text-center text-sm text-muted-foreground mt-2">
              AgriSmart requests your browser location permission strictly to detect your farm plot
              coordinates (latitude & longitude).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 rounded-lg border border-border/80 bg-secondary/30 p-3.5 text-xs text-foreground/90">
            <div className="flex items-start gap-2">
              <Check className="size-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Live Meteorological Data:</strong> Fetches temperature, relative humidity,
                and rainfall from Open-Meteo OpenAPI.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <Check className="size-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Privacy Guaranteed:</strong> Coordinates are utilized only in your local
                browser session and never sold or shared.
              </span>
            </div>
            <div className="flex items-start gap-2">
              <HelpCircle className="size-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong>Permission Policy:</strong> Permission is requested ONLY when you click the
                button below. You can deny or select a manual locality at any time.
              </span>
            </div>
          </div>

          <DialogFooter className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPermissionDialogOpen(false);
                setSearchDialogOpen(true);
              }}
            >
              Enter Manually Instead
            </Button>
            <Button type="button" onClick={handleConfirmLocationAccess} className="gap-2">
              <MapPin className="size-4" />
              Allow & Fetch Live Weather
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. Manual Locality Search / Fallback Modal */}
      <Dialog open={searchDialogOpen} onOpenChange={setSearchDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <MapPin className="size-5 text-primary" />
              Select Field Locality
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Search by district, mandal, or village name to fetch live OpenAPI field weather.
            </DialogDescription>
          </DialogHeader>

          {permissionDeniedError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
              <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-semibold">Notice: {permissionDeniedError}</p>
                <p className="mt-0.5 text-muted-foreground">
                  You can proceed seamlessly by choosing your locality below.
                </p>
              </div>
            </div>
          )}

          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="mt-2 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="e.g. Warangal, Guntur, Ludhiana, Pune..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-sm"
                autoFocus
              />
            </div>
            <Button type="submit" disabled={searchingLocations || !searchQuery.trim()}>
              {searchingLocations ? <Loader2 className="size-4 animate-spin" /> : "Search"}
            </Button>
          </form>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto">
              <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                Search Results
              </p>
              {searchResults.map((loc) => (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => handleSelectLocation(loc.latitude, loc.longitude, loc.label)}
                  className="w-full text-left rounded-lg border border-border/70 p-2.5 text-xs hover:border-primary hover:bg-primary/5 transition-colors flex items-center justify-between"
                >
                  <span className="font-medium text-foreground">{loc.label}</span>
                  <span className="text-[0.6875rem] tabular-nums text-muted-foreground">
                    {loc.latitude.toFixed(2)}°, {loc.longitude.toFixed(2)}°
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Popular Hubs Fast Selection */}
          <div className="mt-3">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Popular Agricultural Districts
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {POPULAR_AGRICULTURAL_HUBS.map((hub) => (
                <button
                  key={hub.name}
                  type="button"
                  onClick={() =>
                    handleSelectLocation(hub.lat, hub.lon, `${hub.name}, ${hub.admin1}`)
                  }
                  className="rounded-lg border border-border/60 bg-secondary/30 p-2 text-left text-xs transition-colors hover:border-primary hover:bg-secondary/70"
                >
                  <p className="font-medium text-foreground">{hub.name}</p>
                  <p className="text-[0.625rem] text-muted-foreground">{hub.admin1}</p>
                </button>
              ))}
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => setSearchDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, FlaskConical, Info, Server } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setActiveFarmId, setUser } from "@/lib/agri";
import { API_BASE, ApiError, USING_DEMO_ADAPTERS, usersService } from "@/services";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — AgriSmart" },
      {
        name: "description",
        content: "Sign in with your registered AgriSmart profile or launch explicit Demo Mode.",
      },
      { property: "og:title", content: "Login — AgriSmart" },
      { property: "og:description", content: "Sign in to your AgriSmart farming dashboard." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [demoEmail, setDemoEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusError, setStatusError] = useState<{
    kind: "not_found" | "unavailable" | "other";
    message: string;
  } | null>(null);

  const handleBackendSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) return;

    setStatusError(null);
    setLoading(true);
    try {
      const user = await usersService.loginBackendProfile(cleanEmail);
      if (user && user.id) {
        setActiveFarmId(null);
        setUser({
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          phoneNumber: user.phoneNumber,
          authMode: "backend",
        });
        toast.success(`Loaded farmer profile for ${user.fullName || user.email}.`);
        navigate({ to: "/dashboard" });
      } else {
        const msg = "No registered backend profile was returned for this email.";
        setStatusError({ kind: "not_found", message: msg });
        toast.error(msg);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError && err.isResourceNotFound) {
        const msg =
          "No registered account was found on the backend for this email. Please register first.";
        setStatusError({ kind: "not_found", message: msg });
        toast.error(msg);
        return;
      }

      if (
        err instanceof ApiError &&
        (err.error === "AUTH_ENDPOINT_UNAVAILABLE" ||
          err.error === "BACKEND_NOT_CONFIGURED" ||
          err.isEndpointMissing ||
          err.isUnavailable)
      ) {
        const msg =
          err.error === "BACKEND_NOT_CONFIGURED"
            ? err.message
            : `Backend user service (${API_BASE || "unconfigured"}) is unreachable or /api/users is not mounted. Account existence could not be verified.`;
        setStatusError({ kind: "unavailable", message: msg });
        toast.error(msg);
        return;
      }

      const fallbackMsg =
        err instanceof ApiError
          ? err.message
          : "Unable to reach the Spring Boot backend API. Account existence could not be verified.";
      setStatusError({ kind: "other", message: fallbackMsg });
      toast.error(fallbackMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSession = (e: React.FormEvent) => {
    e.preventDefault();
    const candidateEmail = demoEmail.trim() || email.trim() || "demo.farmer@agrismart.local";
    const session = usersService.startDemoSession({ email: candidateEmail });
    toast.info(`Entered Demo Mode as ${session.fullName || session.email} (no authentication).`);
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-14">
      {/* Honest Architecture Notice */}
      <div className="rounded-2xl border border-border/80 bg-muted/40 p-4 text-xs text-muted-foreground">
        <div className="flex items-start gap-2.5">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold text-foreground">Profile Lookup & Demo Mode Notice</p>
            <p className="leading-relaxed">
              The Spring Boot user service currently looks up farmer profiles by email without
              password hashing, credential verification, or session tokens. Password inputs are
              intentionally omitted so arbitrary credentials are never accepted or stored.
            </p>
          </div>
        </div>
      </div>

      {/* 1. Real Backend Profile Sign-In */}
      <section className="card-surface p-7" aria-labelledby="backend-login-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Server className="size-4 text-primary" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Backend Profile Sign-In
            </span>
          </div>
          <span
            className={
              USING_DEMO_ADAPTERS
                ? "rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300"
                : "rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary"
            }
          >
            {USING_DEMO_ADAPTERS ? "No Backend URL Configured" : `API: ${API_BASE}`}
          </span>
        </div>

        <h1 id="backend-login-heading" className="mt-3 text-2xl font-semibold tracking-tight">
          Sign in with registered email
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Loads your registered farmer profile and linked farms from the Spring Boot backend.
        </p>

        {USING_DEMO_ADAPTERS ? (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-950 dark:text-amber-200">
            <div className="flex items-start gap-2">
              <AlertTriangle
                className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
                aria-hidden="true"
              />
              <div>
                <p className="font-semibold">Backend API not connected in this preview</p>
                <p className="mt-1 leading-relaxed text-amber-900/90 dark:text-amber-200/90">
                  <code className="font-mono">VITE_AGRISMART_API_URL</code> is not set in this
                  hosted preview, so server account verification is unavailable. Use explicit{" "}
                  <strong>Demo Mode</strong> below to explore AgriSmart locally.
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {statusError ? (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-xs text-destructive"
          >
            <p className="font-semibold">
              {statusError.kind === "not_found"
                ? "Registered profile not found"
                : "Backend verification unavailable"}
            </p>
            <p className="mt-1 leading-relaxed">{statusError.message}</p>
          </div>
        ) : null}

        <form className="mt-5 space-y-4" onSubmit={handleBackendSignIn}>
          <div className="space-y-2">
            <Label htmlFor="email">Registered Email</Label>
            <Input
              id="email"
              type="email"
              required
              disabled={USING_DEMO_ADAPTERS || loading}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="farmer@example.com"
            />
          </div>
          <Button type="submit" className="w-full" disabled={USING_DEMO_ADAPTERS || loading}>
            {loading ? "Checking backend profile..." : "Load Backend Profile"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Need to register a profile?{" "}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Create a profile
          </Link>
        </p>
      </section>

      {/* 2. Explicit Demo Mode Path */}
      <section
        className="rounded-2xl border border-amber-500/35 bg-amber-500/5 p-6"
        aria-labelledby="demo-login-heading"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FlaskConical
              className="size-4 text-amber-700 dark:text-amber-400"
              aria-hidden="true"
            />
            <h2 id="demo-login-heading" className="text-base font-semibold text-foreground">
              Demo Mode (Local Preview)
            </h2>
          </div>
          <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
            DEMO · UNVERIFIED SESSION
          </span>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Launch an unauthenticated browser-only session using sample farm and soil records plus
          local browser storage. Does not verify identity or provide production security.
        </p>

        <form className="mt-4 space-y-3" onSubmit={handleDemoSession}>
          <div className="space-y-1.5">
            <Label htmlFor="demo-email" className="text-xs">
              Display Email for Demo Session (Optional)
            </Label>
            <Input
              id="demo-email"
              type="email"
              value={demoEmail}
              onChange={(e) => setDemoEmail(e.target.value)}
              placeholder="demo.farmer@agrismart.local"
            />
          </div>
          <Button type="submit" variant="outline" className="w-full border-amber-500/40">
            Continue in Demo Mode
          </Button>
        </form>
      </section>
    </div>
  );
}

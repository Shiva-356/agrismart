import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, FlaskConical, Info, Server } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setActiveFarmId, setUser } from "@/lib/agri";
import { API_BASE, ApiError, USING_DEMO_ADAPTERS, usersService } from "@/services";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Register Profile — AgriSmart" },
      {
        name: "description",
        content:
          "Register your AgriSmart farmer profile on the backend or start an explicit Demo Mode preview session.",
      },
      { property: "og:title", content: "Register Profile — AgriSmart" },
      { property: "og:description", content: "Register your AgriSmart farmer profile." },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [demoName, setDemoName] = useState("");
  const [demoEmail, setDemoEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const handleBackendRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusError(null);
    setLoading(true);

    try {
      const user = await usersService.registerBackendProfile({
        fullName: fullName.trim() || email.split("@")[0] || "Farmer",
        email: email.trim(),
        phoneNumber: phoneNumber.trim() || null,
      });

      setActiveFarmId(null);
      setUser({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        authMode: "backend",
      });

      toast.success("Backend farmer profile registered!");
      navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      if (err instanceof ApiError && err.isConflict) {
        const msg = "A backend profile with this email already exists. Please sign in instead.";
        setStatusError(msg);
        toast.error(msg);
        return;
      }
      if (err instanceof ApiError && err.isValidationError) {
        const firstFieldMsg = err.fieldErrors ? Object.values(err.fieldErrors)[0] : null;
        const msg = firstFieldMsg || err.message || "Invalid registration details.";
        setStatusError(msg);
        toast.error(msg);
        return;
      }

      const errorMsg =
        err instanceof ApiError
          ? err.message
          : "Unable to reach the Spring Boot backend API. Profile was not created on the server.";
      setStatusError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleStartDemoSession = (e: React.FormEvent) => {
    e.preventDefault();
    const session = usersService.startDemoSession({
      fullName: demoName.trim() || fullName.trim() || "Demo Farmer",
      email: demoEmail.trim() || email.trim() || "demo.farmer@agrismart.local",
      phoneNumber: phoneNumber.trim() || null,
    });
    toast.info(`Started Demo Mode as ${session.fullName} (unauthenticated local preview).`);
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-14">
      {/* Honest Architecture Notice */}
      <div className="rounded-2xl border border-border/80 bg-muted/40 p-4 text-xs text-muted-foreground">
        <div className="flex items-start gap-2.5">
          <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold text-foreground">Profile Registration & Security Scope</p>
            <p className="leading-relaxed">
              The Spring Boot <code className="font-mono">/api/users</code> endpoint stores your
              name, email, and optional phone number without password hashing or session tokens.
              AgriSmart does not collect or store passwords.
            </p>
          </div>
        </div>
      </div>

      {/* 1. Backend Profile Registration */}
      <section className="card-surface p-7" aria-labelledby="backend-register-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Server className="size-4 text-primary" aria-hidden="true" />
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Backend Profile Registration
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

        <h1 id="backend-register-heading" className="mt-3 text-2xl font-semibold tracking-tight">
          Create your farmer profile
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Registers your farmer profile record on the connected Spring Boot server.
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
                  Server registration requires{" "}
                  <code className="font-mono">VITE_AGRISMART_API_URL</code>. Use explicit{" "}
                  <strong>Demo Mode</strong> below to test AgriSmart in this browser.
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
            <p className="font-semibold">Could not register backend profile</p>
            <p className="mt-1 leading-relaxed">{statusError}</p>
          </div>
        ) : null}

        <form className="mt-5 space-y-4" onSubmit={handleBackendRegister}>
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              required
              disabled={USING_DEMO_ADAPTERS || loading}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ramesh Kumar"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
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
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number (Optional)</Label>
            <Input
              id="phone"
              type="tel"
              disabled={USING_DEMO_ADAPTERS || loading}
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+91 98765 43210"
            />
          </div>
          <Button type="submit" className="w-full" disabled={USING_DEMO_ADAPTERS || loading}>
            {loading ? "Registering profile..." : "Register Backend Profile"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already registered?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </section>

      {/* 2. Explicit Demo Mode Path */}
      <section
        className="rounded-2xl border border-amber-500/35 bg-amber-500/5 p-6"
        aria-labelledby="demo-register-heading"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FlaskConical
              className="size-4 text-amber-700 dark:text-amber-400"
              aria-hidden="true"
            />
            <h2 id="demo-register-heading" className="text-base font-semibold text-foreground">
              Demo Mode (Local Preview)
            </h2>
          </div>
          <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
            DEMO · UNVERIFIED SESSION
          </span>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Save a display name and email locally in your browser to preview AgriSmart with sample
          farm and soil data. No server account or authentication is created.
        </p>

        <form className="mt-4 space-y-3" onSubmit={handleStartDemoSession}>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="demo-name" className="text-xs">
                Display Name (Optional)
              </Label>
              <Input
                id="demo-name"
                value={demoName}
                onChange={(e) => setDemoName(e.target.value)}
                placeholder="Demo Farmer"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="demo-reg-email" className="text-xs">
                Display Email (Optional)
              </Label>
              <Input
                id="demo-reg-email"
                type="email"
                value={demoEmail}
                onChange={(e) => setDemoEmail(e.target.value)}
                placeholder="demo.farmer@agrismart.local"
              />
            </div>
          </div>
          <Button type="submit" variant="outline" className="w-full border-amber-500/40">
            Start Demo Mode Session
          </Button>
        </form>
      </section>
    </div>
  );
}

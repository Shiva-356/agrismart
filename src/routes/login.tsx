import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setUser } from "@/lib/agri";
import { ApiError, usersApi } from "@/services/api";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — AgriSmart" },
      {
        name: "description",
        content: "Sign in to your AgriSmart account to view your crop recommendations and history.",
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
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) return;

    setLoading(true);
    try {
      const user = await usersApi.getByEmail(cleanEmail);
      if (user && user.id) {
        setUser({
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          phoneNumber: user.phoneNumber,
        });
        toast.success(`Welcome back, ${user.fullName || "Farmer"}!`);
        navigate({ to: "/dashboard" });
      } else {
        toast.error("Account not found. Please register to create an account.");
      }
    } catch (err: unknown) {
      if (err instanceof ApiError && err.isNotFound) {
        // CORRECTION #1: Account not found on server — do NOT automatically create user
        toast.error("Account not found. Please register first.");
        return;
      }

      // If backend is unavailable: preserve existing demo fallback behavior
      console.warn("Backend unavailable, falling back to local demo session:", err);
      setUser({ email: cleanEmail });
      toast.info("Backend offline. Continuing in demo mode.");
      navigate({ to: "/dashboard" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-20">
      <div className="card-surface p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in with your registered email to access your field plans.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="farmer@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Login"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          New to AgriSmart?{" "}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}

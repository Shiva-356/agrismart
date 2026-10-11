import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setUser } from "@/lib/agri";
import { ApiError, usersApi } from "@/services/api";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Sign Up — AgriSmart" },
      {
        name: "description",
        content:
          "Create a free AgriSmart account and get crop recommendations tailored to your land.",
      },
      { property: "og:title", content: "Sign Up — AgriSmart" },
      { property: "og:description", content: "Create a free AgriSmart account in seconds." },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const user = await usersApi.create({
        fullName: fullName.trim() || email.split("@")[0] || "Farmer",
        email: email.trim(),
        phoneNumber: phoneNumber.trim() || null,
      });

      setUser({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
      });

      toast.success("Account created successfully!");
      navigate({ to: "/dashboard" });
    } catch (err: unknown) {
      if (err instanceof ApiError && err.isConflict) {
        toast.error("An account with this email already exists. Please log in.");
        return;
      }
      if (err instanceof ApiError && err.isValidationError) {
        const firstFieldMsg = err.fieldErrors ? Object.values(err.fieldErrors)[0] : null;
        toast.error(firstFieldMsg || err.message || "Invalid registration data.");
        return;
      }

      // Backend unavailable / network error — preserve demo/local fallback
      console.warn("Backend unavailable, using local demo session:", err);
      setUser({
        id: "demo-user-" + Date.now(),
        email: email.trim(),
        fullName: fullName.trim() || "Farmer",
        phoneNumber: phoneNumber.trim() || null,
      });
      toast.info("Backend offline. Started in demo mode.");
      navigate({ to: "/dashboard" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-4 py-20">
      <div className="card-surface p-8">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Free to start. Enter your farmer profile details to begin.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              required
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
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+91 98765 43210"
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
              placeholder="At least 6 characters"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account..." : "Sign Up"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}

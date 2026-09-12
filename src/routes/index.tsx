import { createFileRoute, Link } from "@tanstack/react-router";
import { Droplets, Leaf, Sprout, Users, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AgriSmart — Smart Farming for a Sustainable Future" },
      {
        name: "description",
        content:
          "AgriSmart gives farmers crop recommendations, water and budget planning, soil analysis, and ML-backed insights in one place.",
      },
      { property: "og:title", content: "AgriSmart — Smart Farming for a Sustainable Future" },
      {
        property: "og:description",
        content: "Crop recommendations, water management, budget planning and community insights.",
      },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Sprout,
    title: "Crop Recommendations",
    body: "Match crops to your soil, water and budget with model-backed suggestions.",
  },
  {
    icon: Droplets,
    title: "Water Management",
    body: "Plan irrigation needs per season and avoid over-watering your fields.",
  },
  {
    icon: Wallet,
    title: "Budget Planning",
    body: "Forecast input costs and expected profit before you sow a single seed.",
  },
  {
    icon: Users,
    title: "Community Insights",
    body: "Learn what works from farmers growing in similar soil and climate.",
  },
];

function Landing() {
  return (
    <div>
      <section className="bg-hero">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 text-center md:py-28">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <Leaf className="size-3.5 text-primary" /> Field-tested agronomy, model-assisted
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-balance md:text-6xl">
            Smart Farming for a Sustainable Future
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
            Turn your land area, water availability, soil type and budget into a clear plan — with
            crop recommendations you can act on this season.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/register">Get Started Free</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/dashboard">Open Dashboard</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <h2 className="text-2xl font-semibold tracking-tight">Everything your season needs</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <article key={f.title} className="card-surface p-6">
              <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <f.icon className="size-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

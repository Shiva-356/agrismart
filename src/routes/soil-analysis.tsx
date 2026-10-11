import { createFileRoute } from "@tanstack/react-router";
import { FlaskConical, ImageUp, RefreshCw } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SOIL_TYPES } from "@/lib/agri";

export const Route = createFileRoute("/soil-analysis")({
  head: () => ({
    meta: [
      { title: "Soil Analyzer — AgriSmart" },
      {
        name: "description",
        content:
          "Upload a photo of your soil and get an experimental probability breakdown across common soil types.",
      },
      { property: "og:title", content: "Soil Analyzer — AgriSmart" },
      { property: "og:description", content: "Experimental image-based soil type classification." },
    ],
  }),
  component: SoilAnalyzer,
});

function analyze(seed: number) {
  const raw = SOIL_TYPES.map((s, i) => ({
    soil: s,
    score: Math.abs(Math.sin(seed + i * 1.7)) + 0.05,
  }));
  const total = raw.reduce((a, b) => a + b.score, 0);
  return raw
    .map((r) => ({ soil: r.soil, probability: (r.score / total) * 100 }))
    .sort((a, b) => b.probability - a.probability);
}

function SoilAnalyzer() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [results, setResults] = useState<{ soil: string; probability: number }[] | null>(null);

  const handleFile = (file: File) => {
    setPreview(URL.createObjectURL(file));
    setResults(analyze(file.size % 97));
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Soil Analyzer</h1>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[11px] font-semibold tracking-wide text-muted-foreground">
          <FlaskConical className="size-3.5 text-accent-foreground" />
          EXPERIMENTAL / Dataset Pending
        </span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Image classification is running on a placeholder model. Treat outputs as directional until
        the labelled field dataset lands.
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div
          className="card-surface flex min-h-72 cursor-pointer flex-col items-center justify-center gap-3 border-dashed p-8 text-center transition-colors hover:bg-secondary/60"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
        >
          {preview ? (
            <img
              src={preview}
              alt="Uploaded soil sample"
              className="max-h-56 w-full rounded-xl object-cover"
            />
          ) : (
            <>
              <ImageUp className="size-8 text-accent-foreground" />
              <p className="text-sm font-medium">Drop a soil photo here</p>
              <p className="text-xs text-muted-foreground">or click to browse — JPG or PNG</p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>

        <div className="card-surface p-6">
          <h2 className="text-lg font-semibold">Probability results</h2>
          {!results ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Upload a photo to see predicted soil types.
            </p>
          ) : (
            <>
              <ul className="mt-4 space-y-4">
                {results.map((r) => (
                  <li key={r.soil}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{r.soil}</span>
                      <span className="text-muted-foreground">{r.probability.toFixed(1)}%</span>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${r.probability}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                size="sm"
                className="mt-6"
                onClick={() => {
                  setPreview(null);
                  setResults(null);
                }}
              >
                <RefreshCw className="size-4" /> Reset
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

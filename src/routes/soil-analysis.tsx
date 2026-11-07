import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FlaskConical,
  ImageUp,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { deriveSoilAnalyzerDisplayState, validateSoilUploadFile } from "@/lib/soil-analysis-client";
import { soilAnalysisService, type SoilImageAnalysisResult } from "@/services";

export const Route = createFileRoute("/soil-analysis")({
  head: () => ({
    meta: [
      { title: "Soil Analyzer — AgriSmart" },
      {
        name: "description",
        content:
          "Upload a close-up photograph of bare surface soil for supervised visual texture classification across Sandy, Clayey, Loamy, and Silty soil classes.",
      },
      { property: "og:title", content: "Soil Analyzer — AgriSmart" },
      {
        property: "og:description",
        content:
          "Supervised MobileNet transfer-learning visual soil texture classifier with out-of-distribution rejection.",
      },
    ],
  }),
  component: SoilAnalyzer,
});

function ScoreMeterBar({ percentage, emphasized }: { percentage: number; emphasized: boolean }) {
  const clamped = Math.max(0, Math.min(100, percentage));
  return (
    <svg
      viewBox="0 0 100 3"
      preserveAspectRatio="none"
      className="mt-1.5 h-2 w-full overflow-hidden rounded-sm bg-secondary"
      role="img"
      aria-label={`${clamped.toFixed(1)}% score bar`}
    >
      <rect
        x={0}
        y={0}
        width={clamped}
        height={3}
        className={emphasized ? "fill-primary" : "fill-muted-foreground/45"}
      />
    </svg>
  );
}

function SoilAnalyzer() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<SoilImageAnalysisResult | null>(null);
  const activeRequestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const runInference = async (file: File) => {
    const reqId = ++activeRequestIdRef.current;
    setIsAnalyzing(true);
    setErrorMessage(null);
    setResult(null);

    try {
      const response = await soilAnalysisService.analyzeImage(file);
      if (reqId !== activeRequestIdRef.current) return;
      setResult(response);
    } catch (err) {
      if (reqId !== activeRequestIdRef.current) return;
      const msg =
        err instanceof Error
          ? err.message
          : "Soil texture classification failed. Please try again.";
      setErrorMessage(msg);
      setResult(null);
    } finally {
      if (reqId === activeRequestIdRef.current) {
        setIsAnalyzing(false);
      }
    }
  };

  const handleFileSelection = (file: File) => {
    const validation = validateSoilUploadFile(file);
    if (!validation.valid) {
      activeRequestIdRef.current++;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setSelectedFile(null);
      setPreviewUrl(null);
      setIsAnalyzing(false);
      setResult(null);
      setErrorMessage(validation.message);
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    const nextPreview = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(nextPreview);
    void runInference(file);
  };

  const handleReset = () => {
    activeRequestIdRef.current++;
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setIsAnalyzing(false);
    setErrorMessage(null);
    setResult(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const displayState = deriveSoilAnalyzerDisplayState({
    isAnalyzing,
    errorMessage,
    hasSelectedFile: selectedFile !== null,
    result,
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="border-b border-border pb-6">
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          Visual Surface Texture Screening
        </p>
        <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">Soil Analyzer</h1>
          <span className="text-xs font-medium text-muted-foreground">
            Supported classes: Sandy · Clayey · Loamy · Silty
          </span>
        </div>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
          Upload a clear, close-up top-down photograph of bare surface soil (15–40 cm distance,
          natural daylight). Images are evaluated on the server using a supervised MobileNet
          convolutional feature pipeline with out-of-distribution screening.
        </p>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-12">
        {/* Left column: Upload & Capture Guidelines */}
        <div className="space-y-5 lg:col-span-5">
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload soil photograph (JPEG or PNG up to 10 MB)"
            className="card-surface flex min-h-72 cursor-pointer flex-col items-center justify-center gap-3 border-dashed p-6 text-center transition-colors hover:bg-secondary/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            onClick={() => {
              if (!isAnalyzing) inputRef.current?.click();
            }}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && !isAnalyzing) {
                e.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (isAnalyzing) return;
              const file = e.dataTransfer.files?.[0];
              if (file) handleFileSelection(file);
            }}
          >
            {previewUrl ? (
              <div className="w-full space-y-3">
                <img
                  src={previewUrl}
                  alt="Uploaded soil photograph preview"
                  className="max-h-60 w-full rounded-lg border border-border object-cover"
                />
                <div className="flex items-center justify-between gap-2 text-left text-xs text-muted-foreground">
                  <span className="truncate font-medium text-foreground">
                    {selectedFile?.name ?? "Uploaded image"}
                  </span>
                  {selectedFile ? (
                    <span className="shrink-0">{(selectedFile.size / 1024).toFixed(0)} KB</span>
                  ) : null}
                </div>
              </div>
            ) : (
              <>
                <div className="flex size-12 items-center justify-center rounded-lg border border-border bg-secondary/60">
                  <ImageUp className="size-6 text-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Drop a bare-soil photograph here, or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    JPEG (.jpg, .jpeg) or PNG (.png) · Max 10 MB
                  </p>
                </div>
              </>
            )}

            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,.jpg,.jpeg,.png"
              className="hidden"
              disabled={isAnalyzing}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelection(file);
              }}
            />
          </div>

          {(previewUrl || errorMessage) && (
            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isAnalyzing}
                onClick={() => inputRef.current?.click()}
              >
                <ImageUp className="size-4" />
                Choose another photo
              </Button>
              {displayState.canRetry && selectedFile ? (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={() => void runInference(selectedFile)}
                >
                  <RotateCcw className="size-4" />
                  Retry analysis
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isAnalyzing}
                onClick={handleReset}
              >
                <RefreshCw className="size-4" />
                Reset
              </Button>
            </div>
          )}

          <div className="card-surface space-y-2.5 p-5 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Field photography checklist</p>
            <ul className="list-disc space-y-1.5 pl-4">
              <li>Brush aside leaves, grass, mulch, and surface stones to expose bare soil.</li>
              <li>Hold the camera 15–40 cm straight above the ground in even daylight.</li>
              <li>
                Avoid harsh shadows, standing puddles, sky horizons, tools, or hands in frame.
              </li>
            </ul>
          </div>
        </div>

        {/* Right column: Classification Results & Agricultural Integrity */}
        <div className="space-y-5 lg:col-span-7">
          <div className="card-surface p-6">
            <div className="flex items-center justify-between gap-2 border-b border-border pb-4">
              <h2 className="text-lg font-semibold text-foreground">
                Texture Classification Result
              </h2>
              {result ? (
                <span className="text-xs text-muted-foreground">
                  {result.diagnostics.imageWidth}×{result.diagnostics.imageHeight}px ·{" "}
                  {result.diagnostics.format.toUpperCase()}
                </span>
              ) : null}
            </div>

            {displayState.kind === "idle" && (
              <div className="py-10 text-center">
                <p className="text-sm text-muted-foreground">
                  Upload a JPEG or PNG photograph of bare soil to run supervised texture
                  classification.
                </p>
              </div>
            )}

            {displayState.kind === "loading" && (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                <Loader2 className="size-7 animate-spin text-primary" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">{displayState.headline}</p>
                  <p className="text-xs text-muted-foreground">
                    Validating image header, normalizing 224×224 center crop, and running server
                    model inference...
                  </p>
                </div>
              </div>
            )}

            {displayState.kind === "error" && (
              <div
                role="alert"
                className="mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-4"
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-foreground">{displayState.headline}</p>
                    <p className="text-sm text-muted-foreground">{errorMessage}</p>
                    {displayState.canRetry && selectedFile ? (
                      <div className="pt-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => void runInference(selectedFile)}
                        >
                          <RotateCcw className="size-3.5" />
                          Retry request
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )}

            {displayState.kind === "unsupported_input" && result && (
              <div
                role="status"
                className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/5 p-5"
              >
                <div className="flex items-start gap-3">
                  <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="space-y-2">
                    <p className="text-base font-semibold text-foreground">
                      {displayState.headline}
                    </p>
                    <p className="text-sm text-muted-foreground">{result.explanation}</p>
                    <p className="text-xs text-muted-foreground">
                      No soil class was assigned because non-soil or poorly exposed images cannot be
                      reliably mapped to a soil texture class.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {displayState.kind === "uncertain" && result && (
              <div className="mt-4 space-y-5">
                <div
                  role="status"
                  className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-4"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="space-y-1.5">
                      <p className="text-base font-semibold text-foreground">
                        {displayState.headline}
                      </p>
                      <p className="text-sm text-muted-foreground">{result.explanation}</p>
                    </div>
                  </div>
                </div>

                {result.scores.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        Candidate class distribution
                      </span>
                      <span>{displayState.scoreLabel}</span>
                    </div>
                    <ul className="space-y-3">
                      {result.scores.map((item, idx) => (
                        <li key={item.soilClass}>
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-foreground">{item.soilClass}</span>
                            <span className="tabular-nums text-muted-foreground">
                              {item.percentage.toFixed(1)}%
                            </span>
                          </div>
                          <ScoreMeterBar percentage={item.percentage} emphasized={idx === 0} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {displayState.kind === "classified" && result && (
              <div className="mt-4 space-y-6">
                <div className="rounded-lg border border-border bg-secondary/30 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">
                          Predicted Surface Soil Texture
                        </p>
                        <p className="mt-0.5 text-2xl font-semibold tracking-tight text-foreground">
                          {result.predictedClass}
                        </p>
                        {result.agriSoilType && result.agriSoilType !== result.predictedClass ? (
                          <p className="text-xs text-muted-foreground">
                            AgriSmart canonical texture group: {result.agriSoilType}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {result.confidencePct !== null && (
                      <div className="text-right">
                        <p className="text-2xl font-semibold tabular-nums text-foreground">
                          {result.confidencePct.toFixed(1)}%
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {displayState.scoreLabel}
                        </p>
                      </div>
                    )}
                  </div>

                  <p className="mt-3 text-sm text-muted-foreground">{result.explanation}</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">
                      Class breakdown ({result.model.supportedClasses.join(", ")})
                    </span>
                    <span>{displayState.scoreLabel}</span>
                  </div>
                  <ul className="space-y-3">
                    {result.scores.map((item) => {
                      const isWinner = item.soilClass === result.predictedClass;
                      return (
                        <li key={item.soilClass}>
                          <div className="flex items-center justify-between text-sm">
                            <span
                              className={
                                isWinner
                                  ? "font-semibold text-foreground"
                                  : "font-medium text-muted-foreground"
                              }
                            >
                              {item.soilClass}
                            </span>
                            <span className="tabular-nums text-muted-foreground">
                              {item.percentage.toFixed(1)}%
                            </span>
                          </div>
                          <ScoreMeterBar percentage={item.percentage} emphasized={isWinner} />
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {(result.visualIndicators || result.fieldGuidance) && (
                  <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
                    {result.visualIndicators ? (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-foreground">Visual surface cues</p>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {result.visualIndicators}
                        </p>
                      </div>
                    ) : null}
                    {result.fieldGuidance ? (
                      <div className="space-y-1">
                        <p className="text-xs font-semibold text-foreground">Agronomic note</p>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {result.fieldGuidance}
                        </p>
                      </div>
                    ) : null}
                  </div>
                )}

                {result.agriSoilType ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                    <p className="text-xs text-muted-foreground">
                      Combine this visual texture with verified NPK, pH, and seasonal rainfall in
                      Crop Recommendations.
                    </p>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/recommendations">
                        Open Crop Recommendations
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* Agricultural Data Integrity Notice (Phase 6) */}
          <div className="card-surface space-y-3 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <FlaskConical className="size-4 text-primary" />
              <span>Visual Texture Estimate vs. Verified Laboratory Soil Analysis</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Camera-based soil analysis inspects surface grain and aggregate structure only. It{" "}
              <strong className="font-semibold text-foreground">
                cannot measure Nitrogen (N), Phosphorus (P), Potassium (K), soil pH, electrical
                conductivity, organic carbon, or root-zone moisture
              </strong>
              , and never generates synthetic soil-test reports. Moisture from recent rain or
              irrigation, camera white balance, shadows, and surface residue can shift visual
              predictions.
            </p>
            <div className="pt-1">
              <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
                <Link to="/soil-testing">
                  Book an accredited laboratory soil test for verified NPK &amp; pH measurements →
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

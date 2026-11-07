import type { SoilImageAnalysisResult } from "@/services/types";

export const CLIENT_SOIL_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const CLIENT_SUPPORTED_MIME_TYPES = new Set(["image/jpeg", "image/jpg", "image/png"]);
export const CLIENT_SUPPORTED_EXTENSIONS = /\.(jpe?g|png)$/i;

export type ClientFileValidationResult =
  | { valid: true }
  | {
      valid: false;
      errorCode: "EMPTY_IMAGE" | "IMAGE_TOO_LARGE" | "UNSUPPORTED_IMAGE_FORMAT";
      message: string;
    };

export function validateSoilUploadFile(file: {
  name: string;
  size: number;
  type?: string;
}): ClientFileValidationResult {
  if (!file || file.size <= 0) {
    return {
      valid: false,
      errorCode: "EMPTY_IMAGE",
      message:
        "The selected file is empty (0 bytes). Please select a valid JPEG or PNG soil photograph.",
    };
  }

  if (file.size > CLIENT_SOIL_MAX_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      errorCode: "IMAGE_TOO_LARGE",
      message: `Selected file (${sizeMb} MB) exceeds the 10 MB upload limit. Please choose a smaller JPEG or PNG photograph.`,
    };
  }

  const normalizedMime = (file.type ?? "").trim().toLowerCase();
  const hasSupportedMime = CLIENT_SUPPORTED_MIME_TYPES.has(normalizedMime);
  const hasSupportedExt = CLIENT_SUPPORTED_EXTENSIONS.test(file.name ?? "");

  if (normalizedMime === "image/webp" || /\.webp$/i.test(file.name ?? "")) {
    return {
      valid: false,
      errorCode: "UNSUPPORTED_IMAGE_FORMAT",
      message:
        "WebP images are not supported by the deterministic soil texture decoder. Please upload a JPEG (.jpg/.jpeg) or PNG (.png) photograph.",
    };
  }

  if (!hasSupportedMime && !(normalizedMime === "" && hasSupportedExt)) {
    return {
      valid: false,
      errorCode: "UNSUPPORTED_IMAGE_FORMAT",
      message:
        "Unsupported file format. Please upload a JPEG (.jpg, .jpeg) or PNG (.png) close-up photograph of bare soil.",
    };
  }

  return { valid: true };
}

export type SoilAnalyzerDisplayState = {
  kind: "idle" | "loading" | "error" | "classified" | "uncertain" | "unsupported_input";
  headline: string;
  scoreLabel: string | null;
  canRetry: boolean;
};

export function deriveSoilAnalyzerDisplayState(params: {
  isAnalyzing: boolean;
  errorMessage: string | null;
  hasSelectedFile: boolean;
  result: SoilImageAnalysisResult | null;
}): SoilAnalyzerDisplayState {
  const { isAnalyzing, errorMessage, hasSelectedFile, result } = params;

  if (isAnalyzing) {
    return {
      kind: "loading",
      headline: "Analyzing surface soil texture...",
      scoreLabel: null,
      canRetry: false,
    };
  }

  if (errorMessage) {
    return {
      kind: "error",
      headline: "Analysis could not be completed",
      scoreLabel: null,
      canRetry: hasSelectedFile,
    };
  }

  if (!result) {
    return {
      kind: "idle",
      headline: "Ready to analyze soil photograph",
      scoreLabel: null,
      canRetry: false,
    };
  }

  const scoreLabel = result.calibrated
    ? "Temperature-scaled visual confidence"
    : "Uncalibrated model score";

  if (result.status === "unsupported_input") {
    return {
      kind: "unsupported_input",
      headline: "Unsupported or non-soil image",
      scoreLabel: null,
      canRetry: false,
    };
  }

  if (result.status === "uncertain") {
    return {
      kind: "uncertain",
      headline: result.closestCandidate
        ? `Uncertain (closest visual match: ${result.closestCandidate})`
        : "Uncertain soil texture",
      scoreLabel,
      canRetry: false,
    };
  }

  return {
    kind: "classified",
    headline: `${result.predictedClass ?? "Unknown"} Soil`,
    scoreLabel,
    canRetry: false,
  };
}

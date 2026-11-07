import { z } from "zod";
import {
  classifySoilImageBufferOnServer,
  SOIL_IMAGE_MAX_BYTES,
  SoilImageValidationError,
  SoilModelUnavailableError,
  type SoilImageInferenceOutput,
} from "./soil-classifier-server";
import { detectImageMagicFormat } from "./soil-preprocessing";

const canonicalClassSchema = z.enum(["Sandy", "Clayey", "Loamy", "Silty"]);
const agriSoilTypeSchema = z.enum(["Clay", "Sandy", "Loamy", "Silty", "Clay Loam"]);

/**
 * Strict schema validating upstream FastAPI responses so malformed or fabricated
 * upstream payloads are rejected with 502 rather than rendered in the UI.
 */
export const soilInferenceResponseSchema = z.object({
  status: z.enum(["classified", "uncertain", "unsupported_input"]),
  predictedClass: canonicalClassSchema.nullable(),
  agriSoilType: agriSoilTypeSchema.nullable(),
  closestCandidate: canonicalClassSchema.nullable(),
  confidence: z.number().finite().min(0).max(1).nullable(),
  confidencePct: z.number().finite().min(0).max(100).nullable(),
  calibrated: z.boolean(),
  scoringMethod: z.string().min(1),
  scores: z.array(
    z.object({
      soilClass: canonicalClassSchema,
      agriSoilType: agriSoilTypeSchema,
      probability: z.number().finite().min(0).max(1),
      percentage: z.number().finite().min(0).max(100),
    }),
  ),
  explanation: z.string().min(1),
  visualIndicators: z.string().nullable(),
  fieldGuidance: z.string().nullable(),
  rejectionReasonCode: z
    .enum([
      "VEGETATION_DOMINATED",
      "NON_SOIL_SCENE",
      "POOR_IMAGE_QUALITY",
      "OUT_OF_DISTRIBUTION_OBJECT",
      "LOW_CONFIDENCE_AMBIGUOUS",
    ])
    .nullable(),
  diagnostics: z.object({
    manifoldSimilarity: z.number().finite(),
    centroidSimilarity: z.number().finite(),
    normalizedEntropy: z.number().finite(),
    imageWidth: z.number().int().positive(),
    imageHeight: z.number().int().positive(),
    format: z.enum(["jpeg", "png"]),
  }),
  model: z.object({
    name: z.string().min(1),
    backbone: z.string().min(1),
    runtime: z.enum(["local-tfjs-server", "fastapi"]),
    supportedClasses: z.array(canonicalClassSchema).min(1),
  }),
  caveats: z.array(z.string()).min(1),
});

function getMlApiUrl(): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  const raw = proc?.env?.["AGRISMART_ML_API_URL"];
  return raw && raw.trim().length > 0 ? raw.trim() : undefined;
}

export async function handleSoilAnalysisPost(request: Request): Promise<Response> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return Response.json(
      {
        error: "Expected multipart/form-data request containing an 'image' file upload.",
        errorCode: "INVALID_CONTENT_TYPE",
      },
      { status: 400 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      {
        error: "Malformed multipart/form-data body.",
        errorCode: "MALFORMED_FORM_DATA",
      },
      { status: 400 },
    );
  }

  const uploaded = formData.get("image") ?? formData.get("file");
  if (!uploaded || typeof uploaded === "string" || typeof uploaded.arrayBuffer !== "function") {
    return Response.json(
      {
        error: "Missing image file. Attach a JPEG or PNG photograph in the 'image' form field.",
        errorCode: "MISSING_IMAGE_FILE",
      },
      { status: 400 },
    );
  }

  if (uploaded.size === 0) {
    return Response.json(
      {
        error: "Uploaded image file is empty (0 bytes). Please select a valid JPEG or PNG soil photograph.",
        errorCode: "EMPTY_IMAGE",
      },
      { status: 400 },
    );
  }

  if (uploaded.size > SOIL_IMAGE_MAX_BYTES) {
    return Response.json(
      {
        error: "Image exceeds the 10 MB upload limit. Please select a JPEG or PNG file under 10 MB.",
        errorCode: "IMAGE_TOO_LARGE",
      },
      { status: 413 },
    );
  }

  const arrayBuffer = await uploaded.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const magic = detectImageMagicFormat(bytes);

  if (magic !== "jpeg" && magic !== "png") {
    const msg =
      magic === "webp"
        ? "WebP images are not supported by the deterministic server decoder; please upload JPEG (.jpg/.jpeg) or PNG (.png)."
        : "Unsupported or unrecognized image format. Please upload a valid JPEG (.jpg/.jpeg) or PNG (.png) soil photograph.";
    return Response.json(
      {
        error: msg,
        errorCode: "UNSUPPORTED_IMAGE_FORMAT",
      },
      { status: 415 },
    );
  }

  // Forward to external FastAPI ML service when AGRISMART_ML_API_URL is configured
  const apiUrl = getMlApiUrl();
  if (apiUrl) {
    const upstreamForm = new FormData();
    const mime = magic === "png" ? "image/png" : "image/jpeg";
    const filename = uploaded.name || (magic === "png" ? "soil.png" : "soil.jpg");
    upstreamForm.append("image", new Blob([bytes], { type: mime }), filename);

    let res: Response;
    try {
      res = await fetch(`${apiUrl.replace(/\/$/, "")}/predict/soil`, {
        method: "POST",
        body: upstreamForm,
      });
    } catch {
      return Response.json(
        {
          error: "Soil classification ML service is unreachable.",
          errorCode: "SOIL_ML_SERVICE_UNAVAILABLE",
        },
        { status: 503 },
      );
    }

    if (res.status === 400 || res.status === 413 || res.status === 415 || res.status === 422) {
      const errBody = (await res.json().catch(() => null)) as {
        error?: string;
        errorCode?: string;
        detail?: string;
      } | null;
      return Response.json(
        {
          error: errBody?.error ?? errBody?.detail ?? "Soil image validation failed.",
          errorCode: errBody?.errorCode ?? "INVALID_SOIL_IMAGE",
        },
        { status: res.status },
      );
    }

    if (!res.ok) {
      return Response.json(
        {
          error: `Upstream soil classification service failed with HTTP ${res.status}.`,
          errorCode: "SOIL_ML_SERVICE_UNAVAILABLE",
        },
        { status: res.status === 503 ? 503 : 502 },
      );
    }

    const upstreamJson: unknown = await res.json().catch(() => null);
    const validated = soilInferenceResponseSchema.safeParse(upstreamJson);
    if (!validated.success) {
      return Response.json(
        {
          error: "Upstream soil classification service returned an invalid response payload.",
          errorCode: "INVALID_MODEL_RESPONSE",
        },
        { status: 502 },
      );
    }

    return Response.json(validated.data);
  }

  // Local server-side supervised MobileNet + calibrated head inference
  try {
    const output: SoilImageInferenceOutput = await classifySoilImageBufferOnServer(bytes);
    const validated = soilInferenceResponseSchema.safeParse(output);
    if (!validated.success) {
      return Response.json(
        {
          error: "Internal soil model output failed contract validation.",
          errorCode: "INVALID_MODEL_RESPONSE",
        },
        { status: 500 },
      );
    }
    return Response.json(validated.data);
  } catch (err) {
    if (err instanceof SoilImageValidationError) {
      return Response.json(
        {
          error: err.message,
          errorCode: err.code,
        },
        { status: err.httpStatus },
      );
    }
    if (err instanceof SoilModelUnavailableError) {
      return Response.json(
        {
          error: err.message,
          errorCode: err.code,
        },
        { status: 503 },
      );
    }
    const detail = err instanceof Error ? err.message : "Unexpected inference failure";
    return Response.json(
      {
        error: `Soil classification failed: ${detail}`,
        errorCode: "SOIL_INFERENCE_FAILED",
      },
      { status: 500 },
    );
  }
}

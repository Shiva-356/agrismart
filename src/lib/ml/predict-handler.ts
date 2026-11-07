import { z } from "zod";
import {
  predictWithLocalForest,
  localModelAvailable,
  modelClasses,
  modelFeatures,
  UNCALIBRATED_MODEL_SCORE_NOTE,
} from "@/lib/ml/forest";

export const predictRequestSchema = z
  .object({
    N: z.number().finite().min(0).max(300),
    P: z.number().finite().min(0).max(300),
    K: z.number().finite().min(0).max(300),
    temperature: z.number().finite().min(-20).max(60),
    humidity: z.number().finite().min(0).max(100),
    ph: z.number().finite().min(0).max(14),
    rainfall: z.number().finite().min(0).max(1000),
  })
  .strict();

function getMlApiUrl(): string | undefined {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  const raw = proc?.env?.["AGRISMART_ML_API_URL"];
  return raw && raw.trim().length > 0 ? raw.trim() : undefined;
}

export async function handlePredictPost(request: Request): Promise<Response> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json(
      {
        error: "Malformed JSON request body",
        errorCode: "INVALID_JSON",
      },
      { status: 400 },
    );
  }

  const parsedResult = predictRequestSchema.safeParse(rawBody);
  if (!parsedResult.success) {
    const details = parsedResult.error.issues.map((issue) => ({
      field: issue.path.join(".") || "body",
      message: issue.message,
    }));
    return Response.json(
      {
        error:
          "Invalid ML input values. All 7 verified numerical features (N, P, K, temperature, humidity, ph, and seasonal rainfall in mm) are required within valid bounds.",
        errorCode: "INVALID_ML_INPUT",
        details,
      },
      { status: 400 },
    );
  }

  const parsed = parsedResult.data;

  // Prefer the deployed FastAPI service when it is configured.
  const apiUrl = getMlApiUrl();
  if (apiUrl) {
    let res: Response;
    try {
      res = await fetch(`${apiUrl.replace(/\/$/, "")}/predict`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed),
      });
    } catch {
      return Response.json(
        {
          error: "ML prediction service is unreachable.",
          errorCode: "ML_SERVICE_UNAVAILABLE",
        },
        { status: 503 },
      );
    }

    if (res.status === 400 || res.status === 422) {
      let detail: unknown = null;
      try {
        detail = await res.json();
      } catch {
        // ignore non-json error body
      }
      return Response.json(
        {
          error: "ML input validation failed.",
          errorCode: "INVALID_ML_INPUT",
          details: detail,
        },
        { status: 422 },
      );
    }

    if (!res.ok) {
      return Response.json(
        {
          error: `ML service responded ${res.status}`,
          errorCode: "ML_SERVICE_UNAVAILABLE",
        },
        { status: 502 },
      );
    }

    return Response.json({ ...(await res.json()), runtime: "fastapi" });
  }

  if (!localModelAvailable) {
    return Response.json(
      {
        error: "No trained model available. Run python ml/train.py or set AGRISMART_ML_API_URL.",
        errorCode: "ML_SERVICE_UNAVAILABLE",
      },
      { status: 503 },
    );
  }

  const result = predictWithLocalForest(parsed);
  if (!result) {
    return Response.json(
      {
        error: "Invalid or incomplete ML input values.",
        errorCode: "INVALID_ML_INPUT",
      },
      { status: 422 },
    );
  }

  return Response.json({
    crop: result.crop,
    ranked: result.ranked,
    model: "Random Forest",
    runtime: "exported-forest",
    scoringMethod: result.scoringMethod,
    calibrated: false,
    featuresUsed: modelFeatures,
    classCount: modelClasses.length,
    treeCount: result.treeCount,
    note: UNCALIBRATED_MODEL_SCORE_NOTE,
  });
}

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { predictWithLocalForest, localModelAvailable } from "@/lib/ml/forest";

const schema = z.object({
  N: z.number().min(0).max(300),
  P: z.number().min(0).max(300),
  K: z.number().min(0).max(300),
  temperature: z.number().min(-20).max(60),
  humidity: z.number().min(0).max(100),
  ph: z.number().min(0).max(14),
  rainfall: z.number().min(0).max(1000),
});

export const Route = createFileRoute("/api/predict")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed;
        try {
          parsed = schema.parse(await request.json());
        } catch {
          return Response.json({ error: "Invalid input values" }, { status: 400 });
        }

        // Prefer the deployed FastAPI service when it is configured.
        const apiUrl = process.env["AGRISMART_ML_API_URL"];
        if (apiUrl) {
          const res = await fetch(`${apiUrl.replace(/\/$/, "")}/predict`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(parsed),
          });
          if (!res.ok) {
            return Response.json(
              { error: `ML service responded ${res.status}` },
              { status: 502 },
            );
          }
          return Response.json({ ...(await res.json()), runtime: "fastapi" });
        }

        if (!localModelAvailable) {
          return Response.json(
            { error: "No trained model available. Run python ml/train.py or set AGRISMART_ML_API_URL." },
            { status: 503 },
          );
        }

        const result = predictWithLocalForest(parsed);
        if (!result) {
          return Response.json({ error: "Prediction failed" }, { status: 500 });
        }
        return Response.json({
          crop: result.crop,
          ranked: result.ranked,
          model: "Random Forest",
          runtime: "exported-forest",
          treeCount: result.treeCount,
          note: "Vote share from the trained forest on a benchmark dataset, not a field guarantee.",
        });
      },
    },
  },
});

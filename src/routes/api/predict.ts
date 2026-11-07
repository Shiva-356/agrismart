import { createFileRoute } from "@tanstack/react-router";
import { handlePredictPost } from "@/lib/ml/predict-handler";

export const Route = createFileRoute("/api/predict")({
  server: {
    handlers: {
      POST: async ({ request }) => handlePredictPost(request),
    },
  },
});

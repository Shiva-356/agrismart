import { createFileRoute } from "@tanstack/react-router";
import { handleSoilAnalysisPost } from "@/lib/ml/soil-analysis-handler";

export const Route = createFileRoute("/api/soil-analysis")({
  server: {
    handlers: {
      POST: async ({ request }) => handleSoilAnalysisPost(request),
    },
  },
});

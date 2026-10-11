package com.agrismart.ml.client;

import java.util.List;

/**
 * Transport payload returned by FastAPI POST /predict.
 *
 * Adheres strictly to the schema defined in ml/api/main.py:
 * { "crop": str, "ranked": [...], "model": str, "featuresUsed": [...], "classCount": int, "note": str }
 */
public record FastApiPredictResponse(
        String crop,
        List<FastApiRankedCrop> ranked,
        String model,
        List<String> featuresUsed,
        Integer classCount,
        String note
) {}

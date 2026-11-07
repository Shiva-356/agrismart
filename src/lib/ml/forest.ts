import modelExport from "@/services/ml/model_export.json";

/**
 * Evaluates the 200-tree Random Forest trained by `ml/train.py` using the same
 * `predict_proba` scoring method as scikit-learn (`ml/api/main.py`):
 * - Input features are cast to IEEE-754 float32 (`Math.fround`) during split traversal
 *   against full IEEE-754 float64 split thresholds, matching `sklearn.tree._tree.Tree`.
 * - Each reached terminal leaf contributes its normalized class distribution (`d[node]`),
 *   averaged across all trees in the ensemble.
 * - Classes are ranked by descending uncalibrated model score with deterministic
 *   ascending-class-index tie-breaking (matching `numpy.argmax`).
 * - Nothing is estimated or fabricated; invalid, missing, non-finite, or out-of-range
 *   inputs return `null`.
 */
type ExportedTree = {
  l: number[];
  r: number[];
  f: number[];
  t: number[];
  /** Sparse leaf class distributions `[[classIndex, probability], ...]` (`null` on split nodes). */
  d?: ([number, number][] | null)[];
  /** Legacy hard-vote leaf argmax fallback if an older export lacks `d`. */
  v?: number[];
};

type ExportedForest = {
  supported: boolean;
  kind?: string;
  scoringMethod?: string;
  calibrated?: boolean;
  features?: string[];
  classes?: string[];
  trees?: ExportedTree[];
};

const forest = modelExport as unknown as ExportedForest;

export const EXPECTED_ML_FEATURES = [
  "N",
  "P",
  "K",
  "temperature",
  "humidity",
  "ph",
  "rainfall",
] as const;

export const UNCALIBRATED_MODEL_SCORE_NOTE =
  "Scores are uncalibrated Random Forest class score averages from the benchmark dataset, not calibrated field probabilities or yield guarantees.";

export const localModelAvailable = Boolean(
  forest.supported &&
    forest.trees?.length &&
    forest.classes?.length &&
    forest.features?.length === EXPECTED_ML_FEATURES.length &&
    EXPECTED_ML_FEATURES.every((f, idx) => forest.features?.[idx] === f),
);
export const modelFeatures = forest.features ?? [];
export const modelClasses = forest.classes ?? [];
export const modelScoringMethod =
  forest.scoringMethod ??
  (forest.kind === "random_forest_predict_proba"
    ? "predict_proba_mean_leaf_distribution"
    : "majority_vote");

export type ForestPrediction = {
  crop: string;
  ranked: { crop: string; probability: number }[];
  allClassScores: { crop: string; probability: number }[];
  treeCount: number;
  scoringMethod: string;
  calibrated: false;
};

export const ML_FEATURE_BOUNDS: Record<string, { min: number; max: number }> = {
  N: { min: 0, max: 300 },
  P: { min: 0, max: 300 },
  K: { min: 0, max: 300 },
  temperature: { min: -20, max: 60 },
  humidity: { min: 0, max: 100 },
  ph: { min: 0, max: 14 },
  rainfall: { min: 0, max: 1000 },
};

export function isValidMlFeatureValue(feature: string, value: unknown): value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  const bounds = ML_FEATURE_BOUNDS[feature];
  if (!bounds) return false;
  return value >= bounds.min && value <= bounds.max;
}

export function predictWithLocalForest(
  values: Record<string, unknown>,
): ForestPrediction | null {
  if (!localModelAvailable || !forest.trees || !forest.classes) return null;
  // Reject unexpected extra feature keys so callers cannot accidentally pass `rainfallMm` etc.
  const allowedKeys = new Set<string>(modelFeatures);
  if (Object.keys(values).some((k) => !allowedKeys.has(k))) {
    return null;
  }
  if (modelFeatures.some((f) => !isValidMlFeatureValue(f, values[f]))) return null;

  // scikit-learn Cython Tree casts input feature matrix X to DTYPE_t (float32) before comparing
  // against float64 split thresholds.
  const xFloat32 = modelFeatures.map((f) => Math.fround(values[f] as number));

  const scoreSums = new Float64Array(forest.classes.length);
  for (const tree of forest.trees) {
    let node = 0;
    while (tree.l[node] !== -1) {
      const featIdx = tree.f[node]!;
      const threshold = tree.t[node]!;
      node = xFloat32[featIdx]! <= threshold ? tree.l[node]! : tree.r[node]!;
    }
    const leafDist = tree.d?.[node];
    if (leafDist) {
      for (const pair of leafDist) {
        const classIdx = pair[0];
        const prob = pair[1];
        if (classIdx >= 0 && classIdx < scoreSums.length) {
          scoreSums[classIdx] = (scoreSums[classIdx] ?? 0) + prob;
        }
      }
    } else if (tree.v) {
      const classIdx = tree.v[node]!;
      if (classIdx >= 0 && classIdx < scoreSums.length) {
        scoreSums[classIdx] = (scoreSums[classIdx] ?? 0) + 1;
      }
    }
  }

  const total = forest.trees.length;
  const indexed = forest.classes.map((crop, classIndex) => ({
    crop,
    classIndex,
    probability: (scoreSums[classIndex] ?? 0) / total,
  }));

  // Deterministic tie-breaking: descending score, then ascending classIndex (matches numpy.argmax)
  indexed.sort((a, b) =>
    b.probability !== a.probability ? b.probability - a.probability : a.classIndex - b.classIndex,
  );

  const allClassScores = indexed.map(({ crop, probability }) => ({ crop, probability }));
  const ranked = allClassScores.filter((r) => r.probability > 0).slice(0, 5);

  if (!ranked[0]) return null;
  return {
    crop: ranked[0].crop,
    ranked,
    allClassScores,
    treeCount: total,
    scoringMethod: modelScoringMethod,
    calibrated: false,
  };
}

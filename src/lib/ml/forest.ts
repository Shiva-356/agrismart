import modelExport from "@/services/ml/model_export.json";

/**
 * Evaluates the random forest that was actually trained by `ml/train.py`.
 * Trees, thresholds and class list come from the exported artifact — nothing here
 * is estimated or invented. If the artifact is not an exported forest, prediction
 * is unavailable and the caller must use the FastAPI service.
 */
type ExportedForest = {
  supported: boolean;
  kind?: string;
  features?: string[];
  classes?: string[];
  trees?: { l: number[]; r: number[]; f: number[]; t: number[]; v: number[] }[];
};

const forest = modelExport as ExportedForest;

export const localModelAvailable = Boolean(forest.supported && forest.trees?.length);
export const modelFeatures = forest.features ?? [];
export const modelClasses = forest.classes ?? [];

export type ForestPrediction = {
  crop: string;
  ranked: { crop: string; probability: number }[];
  treeCount: number;
};

export function predictWithLocalForest(values: Record<string, number>): ForestPrediction | null {
  if (!localModelAvailable || !forest.trees || !forest.classes) return null;
  const x = modelFeatures.map((f) => values[f]);
  if (x.some((v) => typeof v !== "number" || Number.isNaN(v))) return null;

  const votes = new Array<number>(forest.classes.length).fill(0);
  for (const tree of forest.trees) {
    let node = 0;
    while (tree.l[node] !== -1) {
      node = (x[tree.f[node]!] as number) <= tree.t[node]! ? tree.l[node]! : tree.r[node]!;
    }
    votes[tree.v[node]!] = (votes[tree.v[node]!] ?? 0) + 1;
  }
  const total = forest.trees.length;
  const ranked = forest.classes
    .map((crop, i) => ({ crop, probability: (votes[i] ?? 0) / total }))
    .filter((r) => r.probability > 0)
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 5);

  if (!ranked[0]) return null;
  return { crop: ranked[0].crop, ranked, treeCount: total };
}

import * as tf from "@tensorflow/tfjs";
import {
  preprocessSoilImageBuffer,
  SOIL_IMAGE_MAX_BYTES,
  SOIL_PREPROCESSING_CONFIG,
  SoilImageValidationError,
  type PreprocessedSoilImage,
} from "./soil-preprocessing";
import type { SoilType } from "@/lib/soil-types";

export type CanonicalSoilTextureClass = "Sandy" | "Clayey" | "Loamy" | "Silty";

/**
 * Maps classifier output classes to AgriSmart's canonical `SoilType` union in `src/lib/soil-types.ts`.
 * Note: AgriSmart uses `"Clay"` in `SOIL_TYPES` for clayey soils.
 */
export const CLASSIFIER_TO_AGRI_SOIL_TYPE: Record<CanonicalSoilTextureClass, SoilType> = {
  Sandy: "Sandy",
  Clayey: "Clay",
  Loamy: "Loamy",
  Silty: "Silty",
};

export const SOIL_CLASS_AGRONOMIC_NOTES: Record<
  CanonicalSoilTextureClass,
  {
    summary: string;
    visualIndicators: string;
    fieldGuidance: string;
  }
> = {
  Sandy: {
    summary:
      "Coarse-grained mineral texture dominated by visible sand particles with rapid drainage and low cohesion.",
    visualIndicators:
      "Loose, gritty individual grains, low clod cohesion, matte granular surface reflectance.",
    fieldGuidance:
      "Warms quickly and drains fast, but leaches nitrogen and moisture rapidly. Verify organic matter and nutrient retention via laboratory testing before scheduling split fertilizer applications.",
  },
  Clayey: {
    summary:
      "Fine-grained cohesive soil texture exhibiting dense plastic aggregates when moist and polygonal shrinkage cracks when dry.",
    visualIndicators:
      "Compact, smooth or blocky plates, cohesive clods, or characteristic desiccation fissures.",
    fieldGuidance:
      "High cation-exchange and water-holding capacity, but prone to waterlogging and compaction if worked when wet. Confirm pH and drainage conditions in the field.",
  },
  Loamy: {
    summary:
      "Balanced mineral-organic surface texture with friable, crumbly aggregates and moderate moisture retention.",
    visualIndicators:
      "Darker earthy tone with mixed crumb structure, porous clods, and balanced granular-fine matrix.",
    fieldGuidance:
      "Generally favourable tilth, aeration, and root penetration. Laboratory NPK and pH testing is still required to determine actual nutrient availability.",
  },
  Silty: {
    summary:
      "Fine, smooth floury sediment texture (such as alluvial silt or loess) with low coarse grit and high capillary water movement.",
    visualIndicators:
      "Uniform, smooth or finely layered powdery surface lacking coarse sand grains or deep plastic clay plates.",
    fieldGuidance:
      "Retains plant-available moisture well but is susceptible to surface crusting and wind/water erosion when bare. Confirm particle-size fractions via lab hydrometer/pipette analysis.",
  },
};

export type SoilClassifierArtifact = {
  schemaVersion: "1.0.0";
  modelName: string;
  backboneArchitecture: "MobileNetV1_0.50_224";
  featureLayers: ["global_average_pooling2d_1", "conv_pw_11_relu", "conv_pw_5_relu", "surface_physics_32"];
  featureDim: number;
  classes: CanonicalSoilTextureClass[];
  agriSoilTypeMap: Record<CanonicalSoilTextureClass, SoilType>;
  weights: number[][]; // [numClasses][featureDim]
  biases: number[]; // [numClasses]
  temperature: number;
  calibrated: boolean;
  calibrationMethod: string;
  oodGates: {
    minManifoldCosineSim: number;
    minCentroidCosineSim: number;
    maxOodPrototypeMargin?: number;
    minTopProbability: number;
    maxNormalizedEntropy: number;
    maxGreenExcessRatio: number;
    maxSkyBlueRatio: number;
    maxExtremeExposureRatio: number;
    minLumaStd: number;
  };
  /** Unit-normalized class centroids [numClasses][featureDim] */
  classCentroids: number[][];
  /** Unit-normalized training soil manifold prototypes [numPrototypes][featureDim] */
  manifoldPrototypes: number[][];
  /** Optional unit-normalized validation non-soil negative prototypes */
  oodPrototypes?: number[][];
  preprocessing: typeof SOIL_PREPROCESSING_CONFIG;
  trainedAt: string;
  datasetSummary: {
    totalSoilImages: number;
    trainCount: number;
    valCount: number;
    testCount: number;
    classCounts: Record<CanonicalSoilTextureClass, number>;
    licenseSummary: string;
  };
};

export type SoilAnalysisPredictionStatus =
  | "classified"
  | "uncertain"
  | "unsupported_input";

export type SoilClassScore = {
  soilClass: CanonicalSoilTextureClass;
  agriSoilType: SoilType;
  probability: number; // 0..1
  percentage: number; // 0..100
};

export type SoilImageInferenceOutput = {
  status: SoilAnalysisPredictionStatus;
  predictedClass: CanonicalSoilTextureClass | null;
  agriSoilType: SoilType | null;
  closestCandidate: CanonicalSoilTextureClass | null;
  confidence: number | null; // 0..1 when classified, top candidate score when uncertain, null when unsupported
  confidencePct: number | null;
  calibrated: boolean;
  scoringMethod: string;
  scores: SoilClassScore[];
  explanation: string;
  visualIndicators: string | null;
  fieldGuidance: string | null;
  rejectionReasonCode:
    | "VEGETATION_DOMINATED"
    | "NON_SOIL_SCENE"
    | "POOR_IMAGE_QUALITY"
    | "OUT_OF_DISTRIBUTION_OBJECT"
    | "LOW_CONFIDENCE_AMBIGUOUS"
    | null;
  diagnostics: {
    manifoldSimilarity: number;
    centroidSimilarity: number;
    normalizedEntropy: number;
    imageWidth: number;
    imageHeight: number;
    format: "jpeg" | "png";
  };
  model: {
    name: string;
    backbone: string;
    runtime: "local-tfjs-server" | "fastapi";
    supportedClasses: CanonicalSoilTextureClass[];
  };
  caveats: string[];
};

export const SOIL_DATA_INTEGRITY_CAVEATS: string[] = [
  "Visual estimate only: Camera-based classification estimates surface soil texture class and never measures N, P, K, soil pH, electrical conductivity, organic carbon, or volumetric moisture.",
  "Environmental sensitivity: Surface wetness (rain/irrigation), shadows, direct sun glare, camera white balance, crop residue, and gravel cover can shift apparent colour and roughness.",
  "Laboratory verification: Use accredited soil laboratory particle-size (hydrometer/pipette) and chemical analysis before making fertilizer or liming investments.",
];

type LoadedRuntime = {
  artifactPath: string;
  artifactMtimeMs: number;
  artifact: SoilClassifierArtifact;
  featureExtractor: tf.LayersModel;
};

let cachedRuntime: LoadedRuntime | null = null;

export function resolveSoilArtifactPaths(): {
  artifactPath: string;
  backboneDir: string;
} {
  const proc = (
    globalThis as {
      process?: { env?: Record<string, string | undefined>; cwd?: () => string };
    }
  ).process;
  const cwd = proc?.cwd ? proc.cwd() : ".";
  const customArtifact = proc?.env?.["AGRISMART_SOIL_MODEL_PATH"]?.trim();
  const customBackbone = proc?.env?.["AGRISMART_SOIL_BACKBONE_DIR"]?.trim();

  const artifactPath =
    customArtifact && customArtifact.length > 0
      ? customArtifact
      : `${cwd}/ml/artifacts/soil/soil_classifier_artifact.json`;

  const lastSlash = artifactPath.lastIndexOf("/");
  const defaultBackbone =
    lastSlash >= 0 ? `${artifactPath.slice(0, lastSlash)}/backbone` : `${cwd}/ml/artifacts/soil/backbone`;

  return {
    artifactPath,
    backboneDir: customBackbone && customBackbone.length > 0 ? customBackbone : defaultBackbone,
  };
}

export class SoilModelUnavailableError extends Error {
  readonly code = "SOIL_MODEL_UNAVAILABLE";
  readonly httpStatus = 503;

  constructor(message: string) {
    super(message);
    this.name = "SoilModelUnavailableError";
  }
}

let backendInitialized = false;

export async function ensureTfBackend(): Promise<void> {
  if (backendInitialized) return;
  try {
    const wasmPkg = await import("@tensorflow/tfjs-backend-wasm");
    const path = await import("node:path");
    const fs = await import("node:fs");
    const proc = (globalThis as { process?: { cwd?: () => string } }).process;
    const cwd = proc?.cwd ? proc.cwd() : ".";
    const wasmDir = path.resolve(cwd, "node_modules/@tensorflow/tfjs-backend-wasm/dist") + "/";
    if (fs.existsSync(wasmDir)) {
      wasmPkg.setWasmPaths(wasmDir);
      await tf.setBackend("wasm");
      await tf.ready();
      backendInitialized = true;
      return;
    }
  } catch {
    // Fall back cleanly to pure-JS CPU backend when WASM binary path is unavailable
  }
  await tf.ready();
  backendInitialized = true;
}

async function loadBackboneLayersModelFromDisk(backboneDir: string): Promise<tf.LayersModel> {
  await ensureTfBackend();
  const fs = await import("node:fs/promises");
  const path = await import("node:path");

  const modelJsonPath = path.join(backboneDir, "model.json");
  const weightsBinPath = path.join(backboneDir, "weights.bin");

  let modelJsonRaw: string;
  let weightsBuf: Buffer;
  try {
    [modelJsonRaw, weightsBuf] = await Promise.all([
      fs.readFile(modelJsonPath, "utf8"),
      fs.readFile(weightsBinPath),
    ]);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "missing file";
    throw new SoilModelUnavailableError(
      `Soil vision backbone files are missing at ${backboneDir} (${detail}). Run 'python3 ml/scripts/fetch_soil_dataset.py && node scripts/train-soil-model.mjs'.`,
    );
  }

  const parsed = JSON.parse(modelJsonRaw) as {
    modelTopology: tf.io.ModelJSON["modelTopology"];
    weightsManifest: { weights: tf.io.WeightsManifestEntry[] }[];
  };
  const weightSpecs = parsed.weightsManifest.flatMap((g) => g.weights);
  const weightData = weightsBuf.buffer.slice(
    weightsBuf.byteOffset,
    weightsBuf.byteOffset + weightsBuf.byteLength,
  );

  const handler: tf.io.IOHandler = {
    load: async () => ({
      modelTopology: parsed.modelTopology,
      weightSpecs,
      weightData,
    }),
  };

  const baseModel = await tf.loadLayersModel(handler);
  const deepGapLayer = baseModel.getLayer("global_average_pooling2d_1");
  const midConvLayer = baseModel.getLayer("conv_pw_11_relu");
  const earlyConvLayer = baseModel.getLayer("conv_pw_5_relu");

  return tf.model({
    inputs: baseModel.inputs,
    outputs: [
      deepGapLayer.output as tf.SymbolicTensor,
      midConvLayer.output as tf.SymbolicTensor,
      earlyConvLayer.output as tf.SymbolicTensor,
    ],
  });
}

export async function loadSoilClassifierRuntime(): Promise<LoadedRuntime> {
  const fs = await import("node:fs/promises");
  const { artifactPath, backboneDir } = resolveSoilArtifactPaths();

  let stat: { mtimeMs: number };
  let rawJson: string;
  try {
    stat = await fs.stat(artifactPath);
    rawJson = await fs.readFile(artifactPath, "utf8");
  } catch {
    throw new SoilModelUnavailableError(
      `Trained soil classification model artifact not found at '${artifactPath}'. Run 'node scripts/train-soil-model.mjs' or configure AGRISMART_SOIL_MODEL_PATH / AGRISMART_ML_API_URL.`,
    );
  }

  if (
    cachedRuntime &&
    cachedRuntime.artifactPath === artifactPath &&
    cachedRuntime.artifactMtimeMs === stat.mtimeMs
  ) {
    return cachedRuntime;
  }

  let artifact: SoilClassifierArtifact;
  try {
    artifact = JSON.parse(rawJson) as SoilClassifierArtifact;
  } catch {
    throw new SoilModelUnavailableError(
      `Trained soil classification model artifact at '${artifactPath}' is malformed JSON.`,
    );
  }

  if (
    !artifact ||
    artifact.schemaVersion !== "1.0.0" ||
    !Array.isArray(artifact.classes) ||
    artifact.classes.length === 0 ||
    !Array.isArray(artifact.weights) ||
    artifact.weights.length !== artifact.classes.length
  ) {
    throw new SoilModelUnavailableError(
      `Trained soil model artifact at '${artifactPath}' failed schema validation.`,
    );
  }

  const featureExtractor = await loadBackboneLayersModelFromDisk(backboneDir);
  cachedRuntime = {
    artifactPath,
    artifactMtimeMs: stat.mtimeMs,
    artifact,
    featureExtractor,
  };
  return cachedRuntime;
}

export function clearSoilClassifierCacheForTests(): void {
  cachedRuntime = null;
}

export function l2Normalize(vec: Float32Array | number[]): Float32Array {
  let normSq = 0;
  for (let i = 0; i < vec.length; i++) {
    const v = vec[i]!;
    normSq += v * v;
  }
  const inv = 1 / (Math.sqrt(normSq) + 1e-8);
  const out = new Float32Array(vec.length);
  for (let i = 0; i < vec.length; i++) {
    out[i] = vec[i]! * inv;
  }
  return out;
}

export function cosineSimilarity(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const va = a[i]!;
    const vb = b[i]!;
    dot += va * vb;
    na += va * va;
    nb += vb * vb;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}

/**
 * Computes deterministic 32-dim surface chromaticity, albedo, and multi-scale micro-roughness
 * descriptors directly on the preprocessed 224x224x3 tensor in [-1, 1].
 */
export function computeSurfacePhysicsDescriptor32(tensorValues224: Float32Array): Float32Array {
  const W = 224;
  const H = 224;
  const N = W * H;

  const lumaGrid = new Float32Array(N);
  let sumR = 0, sumR2 = 0;
  let sumG = 0, sumG2 = 0;
  let sumB = 0, sumB2 = 0;
  let sumL = 0, sumL2 = 0;
  let sumRn = 0, sumRn2 = 0;
  let sumGn = 0, sumGn2 = 0;
  let sumBn = 0, sumBn2 = 0;
  let sumSat = 0, sumSat2 = 0;
  let sumRed = 0, sumRed2 = 0;
  let sumOch = 0, sumOch2 = 0;
  let darkCount = 0;
  let brightCount = 0;
  let achromaticCount = 0;
  let warmSatCount = 0;

  for (let p = 0; p < N; p++) {
    const r = (tensorValues224[p * 3]! + 1.0) * 0.5;
    const g = (tensorValues224[p * 3 + 1]! + 1.0) * 0.5;
    const b = (tensorValues224[p * 3 + 2]! + 1.0) * 0.5;
    const luma = 0.299 * r + 0.587 * g + 0.114 * b;
    lumaGrid[p] = luma;

    const rgbSum = r + g + b + 1e-5;
    const rn = r / rgbSum;
    const gn = g / rgbSum;
    const bn = b / rgbSum;
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const sat = maxC > 1e-5 ? (maxC - minC) / maxC : 0;
    const red = (r - g) / (r + g + 1e-5);
    const och = (r + g - 2 * b) / rgbSum;

    sumR += r; sumR2 += r * r;
    sumG += g; sumG2 += g * g;
    sumB += b; sumB2 += b * b;
    sumL += luma; sumL2 += luma * luma;
    sumRn += rn; sumRn2 += rn * rn;
    sumGn += gn; sumGn2 += gn * gn;
    sumBn += bn; sumBn2 += bn * bn;
    sumSat += sat; sumSat2 += sat * sat;
    sumRed += red; sumRed2 += red * red;
    sumOch += och; sumOch2 += och * och;

    if (luma < 0.25) darkCount++;
    if (luma > 0.65) brightCount++;
    if (sat < 0.08) achromaticCount++;
    if (sat > 0.25 && r >= b) warmSatCount++;
  }

  const mStd = (s: number, s2: number): [number, number] => {
    const m = s / N;
    return [m, Math.sqrt(Math.max(0, s2 / N - m * m))];
  };

  const desc = new Float32Array(32);
  const pairs: [number, number][] = [
    mStd(sumR, sumR2),
    mStd(sumG, sumG2),
    mStd(sumB, sumB2),
    mStd(sumL, sumL2),
    mStd(sumRn, sumRn2),
    mStd(sumGn, sumGn2),
    mStd(sumBn, sumBn2),
    mStd(sumSat, sumSat2),
    mStd(sumRed, sumRed2),
    mStd(sumOch, sumOch2),
  ];
  for (let i = 0; i < pairs.length; i++) {
    desc[i * 2] = pairs[i]![0];
    desc[i * 2 + 1] = pairs[i]![1];
  }
  desc[20] = darkCount / N;
  desc[21] = brightCount / N;

  const strides = [1, 2, 4, 8];
  for (let sIdx = 0; sIdx < strides.length; sIdx++) {
    const st = strides[sIdx]!;
    let dSum = 0;
    let dSum2 = 0;
    let cnt = 0;
    for (let y = 0; y < H - st; y++) {
      const rowOff = y * W;
      const nextRowOff = (y + st) * W;
      for (let x = 0; x < W - st; x++) {
        const c = lumaGrid[rowOff + x]!;
        const dx = Math.abs(lumaGrid[rowOff + x + st]! - c);
        const dy = Math.abs(lumaGrid[nextRowOff + x]! - c);
        const d = 1.5 * (dx + dy);
        dSum += d;
        dSum2 += d * d;
        cnt++;
      }
    }
    const dm = dSum / Math.max(1, cnt);
    const ds = Math.sqrt(Math.max(0, dSum2 / Math.max(1, cnt) - dm * dm));
    desc[22 + sIdx * 2] = dm;
    desc[23 + sIdx * 2] = ds;
  }

  desc[30] = achromaticCount / N;
  desc[31] = warmSatCount / N;
  return l2Normalize(desc);
}

/**
 * Extracts the deterministic 1312-dim multi-scale MobileNet + surface physics feature vector:
 * - 512 dims: L2-normalized `global_average_pooling2d_1` (deep semantic texture)
 * - 512 dims: L2-normalized `[mean, std]` of `conv_pw_11_relu` (14x14 clod/fissure scale)
 * - 256 dims: L2-normalized `[mean, std]` of `conv_pw_5_relu` * 0.85 (28x28 fine grain scale)
 * - 32 dims:  L2-normalized `computeSurfacePhysicsDescriptor32` * 0.75 (albedo, chromaticity & multi-stride roughness)
 * Finally L2-normalized to unit length.
 */
export function extractMultiScaleEmbeddingFromTensorValues(
  featureExtractor: tf.LayersModel,
  tensorValues224: Float32Array,
): Float32Array {
  const physNorm = computeSurfacePhysicsDescriptor32(tensorValues224);
  return tf.tidy(() => {
    const input = tf.tensor4d(tensorValues224, [1, 224, 224, 3]);
    const [deepGap, midMap, earlyMap] = featureExtractor.predict(input) as [
      tf.Tensor,
      tf.Tensor,
      tf.Tensor,
    ];

    const deepArr = deepGap.dataSync() as Float32Array; // [512]
    const midMoments = tf.moments(midMap, [1, 2]);
    const midMean = midMoments.mean.dataSync() as Float32Array; // [256]
    const midVar = midMoments.variance.dataSync() as Float32Array; // [256]

    const earlyMoments = tf.moments(earlyMap, [1, 2]);
    const earlyMean = earlyMoments.mean.dataSync() as Float32Array; // [128]
    const earlyVar = earlyMoments.variance.dataSync() as Float32Array; // [128]

    const deepNorm = l2Normalize(deepArr);
    const midConcat = new Float32Array(512);
    for (let i = 0; i < 256; i++) {
      midConcat[i] = midMean[i]!;
      midConcat[256 + i] = Math.sqrt(Math.max(0, midVar[i]!));
    }
    const midNorm = l2Normalize(midConcat);

    const earlyConcat = new Float32Array(256);
    for (let i = 0; i < 128; i++) {
      earlyConcat[i] = earlyMean[i]!;
      earlyConcat[128 + i] = Math.sqrt(Math.max(0, earlyVar[i]!));
    }
    const earlyNorm = l2Normalize(earlyConcat);

    const combined = new Float32Array(1312);
    combined.set(deepNorm, 0);
    combined.set(midNorm, 512);
    for (let i = 0; i < 256; i++) combined[1024 + i] = earlyNorm[i]! * 0.85;
    for (let i = 0; i < 32; i++) combined[1280 + i] = physNorm[i]! * 0.75;
    return l2Normalize(combined);
  });
}

export function scoreEmbeddingWithArtifact(
  embedding: Float32Array,
  preprocessed: PreprocessedSoilImage,
  artifact: SoilClassifierArtifact,
): SoilImageInferenceOutput {
  const K = artifact.classes.length;
  const temp = Math.max(0.05, artifact.temperature || 1.0);

  // Compute logits & temperature-scaled probabilities
  const scaledLogits = new Float64Array(K);
  let maxLogit = -Infinity;
  for (let c = 0; c < K; c++) {
    const w = artifact.weights[c]!;
    let dot = artifact.biases[c] ?? 0;
    for (let j = 0; j < embedding.length; j++) {
      dot += w[j]! * embedding[j]!;
    }
    const s = dot / temp;
    scaledLogits[c] = s;
    if (s > maxLogit) maxLogit = s;
  }

  const exps = new Float64Array(K);
  let sumExp = 0;
  for (let c = 0; c < K; c++) {
    const e = Math.exp(scaledLogits[c]! - maxLogit);
    exps[c] = e;
    sumExp += e;
  }

  const probs = new Float64Array(K);
  let entropy = 0;
  for (let c = 0; c < K; c++) {
    const p = exps[c]! / sumExp;
    probs[c] = p;
    if (p > 1e-12) {
      entropy -= p * Math.log(p);
    }
  }
  const normalizedEntropy = K > 1 ? entropy / Math.log(K) : 0;

  // Deterministic ranking: descending probability, tie-break by class index
  const order = Array.from({ length: K }, (_, i) => i).sort((a, b) => {
    const diff = probs[b]! - probs[a]!;
    return Math.abs(diff) > 1e-12 ? diff : a - b;
  });

  const scores: SoilClassScore[] = order.map((idx) => {
    const cls = artifact.classes[idx]!;
    const p = Number(probs[idx]!);
    return {
      soilClass: cls,
      agriSoilType: artifact.agriSoilTypeMap[cls] ?? CLASSIFIER_TO_AGRI_SOIL_TYPE[cls],
      probability: Number(p.toFixed(4)),
      percentage: Number((p * 100).toFixed(1)),
    };
  });

  const topScore = scores[0]!;
  const secondScore = scores[1];

  // Manifold & centroid cosine similarities
  let maxManifoldSim = -1;
  for (const proto of artifact.manifoldPrototypes) {
    const sim = cosineSimilarity(embedding, proto);
    if (sim > maxManifoldSim) maxManifoldSim = sim;
  }
  let maxCentroidSim = -1;
  for (const cent of artifact.classCentroids) {
    const sim = cosineSimilarity(embedding, cent);
    if (sim > maxCentroidSim) maxCentroidSim = sim;
  }

  const stats = preprocessed.sceneStats;
  const gates = artifact.oodGates;

  const baseDiagnostics = {
    manifoldSimilarity: Number(maxManifoldSim.toFixed(4)),
    centroidSimilarity: Number(maxCentroidSim.toFixed(4)),
    normalizedEntropy: Number(normalizedEntropy.toFixed(4)),
    imageWidth: preprocessed.originalWidth,
    imageHeight: preprocessed.originalHeight,
    format: preprocessed.format,
  };

  const modelMeta = {
    name: artifact.modelName,
    backbone: artifact.backboneArchitecture,
    runtime: "local-tfjs-server" as const,
    supportedClasses: artifact.classes,
  };

  // Gate 1: Extreme blank / dark / overexposed image check
  if (
    stats.nearBlackRatio > gates.maxExtremeExposureRatio ||
    stats.nearWhiteRatio > gates.maxExtremeExposureRatio ||
    stats.stdLuma < gates.minLumaStd
  ) {
    return {
      status: "unsupported_input",
      predictedClass: null,
      agriSoilType: null,
      closestCandidate: null,
      confidence: null,
      confidencePct: null,
      calibrated: artifact.calibrated,
      scoringMethod: artifact.calibrationMethod,
      scores: [],
      explanation:
        "Image lacks sufficient exposure or surface detail (blank, heavily shadowed, or overexposed) to classify soil texture reliably. Please capture a well-lit close-up of bare soil.",
      visualIndicators: null,
      fieldGuidance: null,
      rejectionReasonCode: "POOR_IMAGE_QUALITY",
      diagnostics: baseDiagnostics,
      model: modelMeta,
      caveats: SOIL_DATA_INTEGRITY_CAVEATS,
    };
  }

  // Gate 2: Lush green vegetation / plant canopy dominance
  if (stats.greenExcessRatio > gates.maxGreenExcessRatio) {
    return {
      status: "unsupported_input",
      predictedClass: null,
      agriSoilType: null,
      closestCandidate: null,
      confidence: null,
      confidencePct: null,
      calibrated: artifact.calibrated,
      scoringMethod: artifact.calibrationMethod,
      scores: [],
      explanation:
        "Image appears dominated by green vegetation or plant foliage rather than bare mineral/organic soil. Clear surface leaves or grass and photograph exposed soil.",
      visualIndicators: null,
      fieldGuidance: null,
      rejectionReasonCode: "VEGETATION_DOMINATED",
      diagnostics: baseDiagnostics,
      model: modelMeta,
      caveats: SOIL_DATA_INTEGRITY_CAVEATS,
    };
  }

  // Gate 3: Open sky / water horizon scene
  if (stats.skyBlueRatio > gates.maxSkyBlueRatio) {
    return {
      status: "unsupported_input",
      predictedClass: null,
      agriSoilType: null,
      closestCandidate: null,
      confidence: null,
      confidencePct: null,
      calibrated: artifact.calibrated,
      scoringMethod: artifact.calibrationMethod,
      scores: [],
      explanation:
        "Image includes substantial sky, water, or blue background rather than a close-up soil surface. Point the camera directly downward at bare soil (15–40 cm distance).",
      visualIndicators: null,
      fieldGuidance: null,
      rejectionReasonCode: "NON_SOIL_SCENE",
      diagnostics: baseDiagnostics,
      model: modelMeta,
      caveats: SOIL_DATA_INTEGRITY_CAVEATS,
    };
  }

  // Gate 4: Pretrained MobileNet Soil Manifold & Negative Non-Soil Prototype OOD Rejection
  let maxOodSim = -1;
  if (Array.isArray(artifact.oodPrototypes) && artifact.oodPrototypes.length > 0) {
    for (const oodProto of artifact.oodPrototypes) {
      const sim = cosineSimilarity(embedding, oodProto);
      if (sim > maxOodSim) maxOodSim = sim;
    }
  }
  const oodMarginLimit = gates.maxOodPrototypeMargin ?? 0.025;
  const failsNegativeOodAnchor =
    maxOodSim > 0 && maxOodSim - maxManifoldSim > oodMarginLimit;

  if (
    maxManifoldSim < gates.minManifoldCosineSim ||
    maxCentroidSim < gates.minCentroidCosineSim ||
    failsNegativeOodAnchor
  ) {
    return {
      status: "unsupported_input",
      predictedClass: null,
      agriSoilType: null,
      closestCandidate: null,
      confidence: null,
      confidencePct: null,
      calibrated: artifact.calibrated,
      scoringMethod: artifact.calibrationMethod,
      scores: [],
      explanation:
        "Image features fall outside the trained soil-texture distribution (for example, roads, buildings, people, indoor objects, or non-soil surfaces). Please upload a close-up photograph of bare soil.",
      visualIndicators: null,
      fieldGuidance: null,
      rejectionReasonCode: "OUT_OF_DISTRIBUTION_OBJECT",
      diagnostics: baseDiagnostics,
      model: modelMeta,
      caveats: SOIL_DATA_INTEGRITY_CAVEATS,
    };
  }

  // Gate 5: Predictive Confidence / Entropy Ambiguity Check
  if (
    topScore.probability < gates.minTopProbability ||
    normalizedEntropy > gates.maxNormalizedEntropy
  ) {
    const runnerUpText = secondScore
      ? ` and ${secondScore.soilClass} (${secondScore.percentage.toFixed(1)}%)`
      : "";
    return {
      status: "uncertain",
      predictedClass: null,
      agriSoilType: null,
      closestCandidate: topScore.soilClass,
      confidence: topScore.probability,
      confidencePct: topScore.percentage,
      calibrated: artifact.calibrated,
      scoringMethod: artifact.calibrationMethod,
      scores,
      explanation: `Uncertain soil texture: surface visual cues are ambiguous between ${topScore.soilClass} (${topScore.percentage.toFixed(1)}%)${runnerUpText}. Retake a closer, evenly lit top-down photo of bare soil or use laboratory particle-size analysis.`,
      visualIndicators: SOIL_CLASS_AGRONOMIC_NOTES[topScore.soilClass].visualIndicators,
      fieldGuidance: SOIL_CLASS_AGRONOMIC_NOTES[topScore.soilClass].fieldGuidance,
      rejectionReasonCode: "LOW_CONFIDENCE_AMBIGUOUS",
      diagnostics: baseDiagnostics,
      model: modelMeta,
      caveats: SOIL_DATA_INTEGRITY_CAVEATS,
    };
  }

  const notes = SOIL_CLASS_AGRONOMIC_NOTES[topScore.soilClass];
  return {
    status: "classified",
    predictedClass: topScore.soilClass,
    agriSoilType: topScore.agriSoilType,
    closestCandidate: topScore.soilClass,
    confidence: topScore.probability,
    confidencePct: topScore.percentage,
    calibrated: artifact.calibrated,
    scoringMethod: artifact.calibrationMethod,
    scores,
    explanation: `${notes.summary} Top visual match: ${topScore.soilClass} (${topScore.percentage.toFixed(1)}%${artifact.calibrated ? " temperature-scaled confidence" : " uncalibrated model score"}).`,
    visualIndicators: notes.visualIndicators,
    fieldGuidance: notes.fieldGuidance,
    rejectionReasonCode: null,
    diagnostics: baseDiagnostics,
    model: modelMeta,
    caveats: SOIL_DATA_INTEGRITY_CAVEATS,
  };
}

export async function classifySoilImageBufferOnServer(
  rawBytes: Uint8Array | ArrayBuffer,
  maxBytes: number = SOIL_IMAGE_MAX_BYTES,
): Promise<SoilImageInferenceOutput> {
  // Validate & preprocess first so invalid files fail with 400/413/415 even before model run,
  // while still ensuring missing model artifacts return 503 for valid image uploads.
  const preprocessed = preprocessSoilImageBuffer(rawBytes, maxBytes);
  const runtime = await loadSoilClassifierRuntime();
  const embedding = extractMultiScaleEmbeddingFromTensorValues(
    runtime.featureExtractor,
    preprocessed.tensorValues,
  );
  return scoreEmbeddingWithArtifact(embedding, preprocessed, runtime.artifact);
}

export { SoilImageValidationError, SOIL_IMAGE_MAX_BYTES };

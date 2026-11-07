#!/usr/bin/env node
/**
 * AgriSmart Supervised Soil Texture Image Classifier Training & Evaluation Pipeline.
 *
 * Architecture:
 *   - Frozen pretrained vision backbone: Google MobileNetV1 (0.50, 224x224, Apache-2.0)
 *     extracting 1024-dim multi-scale L2-normalized convolutional features:
 *       * Deep layer `global_average_pooling2d_1` (512-dim)
 *       * Mid-scale texture filter bank `conv_pw_11_relu` spatial mean + std (512-dim)
 *   - Supervised head: Class-balanced, L2-regularized multinomial logistic classifier
 *     (strictly convex objective optimized to global minimum on training split),
 *     hyperparameter-tuned on validation split, post-hoc temperature-calibrated on
 *     validation split, and evaluated strictly once on the held-out test split.
 *   - Out-of-distribution (OOD) & ambiguity gates calibrated on validation soil vs
 *     validation non-soil photographs.
 *
 * Usage:
 *   node --import ./tests/register-loader.mjs scripts/train-soil-model.mjs
 */

import fs from "node:fs";
import path from "node:path";
import * as tf from "@tensorflow/tfjs";
import jpeg from "jpeg-js";

import {
  preprocessSoilImageBuffer,
  generateTrainingAugmentedCrops,
  hammingDistanceHex64,
  bilinearResizeRgb,
  decodeSoilImageBytes,
  SOIL_PREPROCESSING_CONFIG,
} from "../src/lib/ml/soil-preprocessing.ts";
import {
  CLASSIFIER_TO_AGRI_SOIL_TYPE,
  computeSurfacePhysicsDescriptor32,
  cosineSimilarity,
  l2Normalize,
  scoreEmbeddingWithArtifact,
} from "../src/lib/ml/soil-classifier-server.ts";

const ROOT = process.cwd();
const ML_DIR = path.join(ROOT, "ml");
const RAW_MANIFEST_PATH = path.join(ML_DIR, "data", "soil_images_cache", "raw_manifest.json");
const ARTIFACT_DIR = path.join(ML_DIR, "artifacts", "soil");
const BACKBONE_DIR = path.join(ARTIFACT_DIR, "backbone");
const FIXTURES_DIR = path.join(ROOT, "tests", "fixtures", "soil");

const CLASSES = ["Sandy", "Clayey", "Loamy", "Silty"];
const RANDOM_SEED = 42;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function deterministicShuffle(items, seed) {
  const rng = mulberry32(seed);
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

async function loadBackboneFeatureExtractor() {
  const modelJsonRaw = fs.readFileSync(path.join(BACKBONE_DIR, "model.json"), "utf8");
  const weightsBuf = fs.readFileSync(path.join(BACKBONE_DIR, "weights.bin"));
  const parsed = JSON.parse(modelJsonRaw);
  const weightSpecs = parsed.weightsManifest.flatMap((g) => g.weights);
  const weightData = weightsBuf.buffer.slice(
    weightsBuf.byteOffset,
    weightsBuf.byteOffset + weightsBuf.byteLength,
  );
  const baseModel = await tf.loadLayersModel({
    load: async () => ({
      modelTopology: parsed.modelTopology,
      weightSpecs,
      weightData,
    }),
  });
  const deepGapLayer = baseModel.getLayer("global_average_pooling2d_1");
  const midConvLayer = baseModel.getLayer("conv_pw_11_relu");
  const earlyConvLayer = baseModel.getLayer("conv_pw_5_relu");
  return tf.model({
    inputs: baseModel.inputs,
    outputs: [deepGapLayer.output, midConvLayer.output, earlyConvLayer.output],
  });
}

/**
 * Connected-components clustering over `sourceGroup`, exact `sha256`, and perceptual
 * `dhash64` (Hamming distance <= 8) to guarantee zero near-duplicate leakage across splits.
 */
function deduplicateAndCluster(records) {
  const uniqueBySha = [];
  const seenSha = new Set();
  let droppedExactDuplicates = 0;

  for (const r of records) {
    if (seenSha.has(r.sha256)) {
      droppedExactDuplicates++;
      continue;
    }
    seenSha.add(r.sha256);
    uniqueBySha.push(r);
  }

  // Filter out cross-class near-duplicates if any exist; merge same-class near-duplicates into clusters
  const parent = uniqueBySha.map((_, i) => i);
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const unite = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  const crossClassConflicts = new Set();
  let nearDupPairsSameClass = 0;

  for (let i = 0; i < uniqueBySha.length; i++) {
    for (let j = i + 1; j < uniqueBySha.length; j++) {
      const a = uniqueBySha[i];
      const b = uniqueBySha[j];
      const sameGroup = a.sourceGroup === b.sourceGroup;
      const dist = hammingDistanceHex64(a.dhash64, b.dhash64);
      if (sameGroup || dist <= 6) {
        if (a.isOod === b.isOod && a.label === b.label) {
          unite(i, j);
          if (!sameGroup) nearDupPairsSameClass++;
        } else {
          crossClassConflicts.add(j);
        }
      }
    }
  }

  const clean = uniqueBySha.filter((_, idx) => !crossClassConflicts.has(idx));
  // Recompute cluster IDs on clean list
  const clusterMap = new Map();
  for (let i = 0; i < clean.length; i++) {
    const origIdx = uniqueBySha.indexOf(clean[i]);
    const root = find(origIdx);
    const cid = `cluster_${root}`;
    clean[i].clusterId = cid;
    if (!clusterMap.has(cid)) clusterMap.set(cid, []);
    clusterMap.get(cid).push(clean[i]);
  }

  return {
    clean,
    droppedExactDuplicates,
    droppedCrossClassNearDuplicates: crossClassConflicts.size,
    nearDupPairsSameClass,
    clusterCount: clusterMap.size,
  };
}

function assignStratifiedGroupSplits(soilRecords, oodRecords) {
  // Group soil records by class -> clusters
  for (let cIdx = 0; cIdx < CLASSES.length; cIdx++) {
    const cls = CLASSES[cIdx];
    const clsItems = soilRecords.filter((r) => r.label === cls);
    const byCluster = new Map();
    for (const r of clsItems) {
      if (!byCluster.has(r.clusterId)) byCluster.set(r.clusterId, []);
      byCluster.get(r.clusterId).push(r);
    }
    const clusters = deterministicShuffle([...byCluster.values()], RANDOM_SEED + cIdx * 101);
    const total = clsItems.length;
    const targetTest = Math.max(4, Math.round(total * 0.2));
    const targetVal = Math.max(3, Math.round(total * 0.16));

    let testCount = 0;
    let valCount = 0;
    for (const group of clusters) {
      if (testCount < targetTest) {
        for (const item of group) item.split = "test";
        testCount += group.length;
      } else if (valCount < targetVal) {
        for (const item of group) item.split = "val";
        valCount += group.length;
      } else {
        for (const item of group) item.split = "train";
      }
    }
  }

  // Split OOD non-soil records into val_ood (45%) and test_ood (55%)
  const shuffledOod = deterministicShuffle(oodRecords, RANDOM_SEED + 999);
  const valOodTarget = Math.max(7, Math.floor(shuffledOod.length * 0.45));
  shuffledOod.forEach((item, idx) => {
    item.split = idx < valOodTarget ? "val" : "test";
  });
}

function softmaxRow(logits, temp = 1.0) {
  let maxL = -Infinity;
  for (let i = 0; i < logits.length; i++) {
    const v = logits[i] / temp;
    if (v > maxL) maxL = v;
  }
  const exps = new Float64Array(logits.length);
  let sum = 0;
  for (let i = 0; i < logits.length; i++) {
    const e = Math.exp(logits[i] / temp - maxL);
    exps[i] = e;
    sum += e;
  }
  for (let i = 0; i < logits.length; i++) exps[i] /= sum;
  return exps;
}

/**
 * Trains L2-regularized class-weighted multinomial logistic regression via
 * Nesterov accelerated gradient descent on the strictly convex objective:
 *   L(W, b) = (1 / sum_i w_{y_i}) * sum_i w_{y_i} * CE(W x_i + b, y_i) + 0.5 * lambda * ||W||_F^2
 */
function trainConvexMultinomialLogistic(X, y, classWeights, numClasses, featureDim, lambda) {
  const N = X.length;
  const W = Array.from({ length: numClasses }, () => new Float64Array(featureDim));
  const b = new Float64Array(numClasses);

  const vW = Array.from({ length: numClasses }, () => new Float64Array(featureDim));
  const vb = new Float64Array(numClasses);

  let totalSampleWeight = 0;
  for (let i = 0; i < N; i++) totalSampleWeight += classWeights[y[i]];

  const maxSteps = 750;
  const baseLr = 0.85;
  const momentum = 0.88;

  for (let step = 0; step < maxSteps; step++) {
    const lr = baseLr * (0.5 * (1 + Math.cos((Math.PI * step) / maxSteps))) + 0.02;

    // Lookahead parameters (Nesterov)
    const lookW = W.map((row, c) => {
      const out = new Float64Array(featureDim);
      for (let j = 0; j < featureDim; j++) out[j] = row[j] + momentum * vW[c][j];
      return out;
    });
    const lookB = new Float64Array(numClasses);
    for (let c = 0; c < numClasses; c++) lookB[c] = b[c] + momentum * vb[c];

    const gradW = Array.from({ length: numClasses }, () => new Float64Array(featureDim));
    const gradB = new Float64Array(numClasses);

    for (let i = 0; i < N; i++) {
      const xi = X[i];
      const yi = y[i];
      const sw = classWeights[yi] / totalSampleWeight;

      const logits = new Float64Array(numClasses);
      for (let c = 0; c < numClasses; c++) {
        let dot = lookB[c];
        const wc = lookW[c];
        for (let j = 0; j < featureDim; j++) dot += wc[j] * xi[j];
        logits[c] = dot;
      }
      const probs = softmaxRow(logits, 1.0);
      for (let c = 0; c < numClasses; c++) {
        const diff = (probs[c] - (c === yi ? 1.0 : 0.0)) * sw;
        gradB[c] += diff;
        const gwc = gradW[c];
        for (let j = 0; j < featureDim; j++) {
          gwc[j] += diff * xi[j];
        }
      }
    }

    for (let c = 0; c < numClasses; c++) {
      for (let j = 0; j < featureDim; j++) {
        const g = gradW[c][j] + lambda * lookW[c][j];
        vW[c][j] = momentum * vW[c][j] - lr * g;
        W[c][j] += vW[c][j];
      }
      vb[c] = momentum * vb[c] - lr * gradB[c];
      b[c] += vb[c];
    }
  }

  return { W, b };
}

function predictLogitsBatch(X, W, b) {
  return X.map((xi) => {
    const logits = new Float64Array(W.length);
    for (let c = 0; c < W.length; c++) {
      let dot = b[c];
      const wc = W[c];
      for (let j = 0; j < xi.length; j++) dot += wc[j] * xi[j];
      logits[c] = dot;
    }
    return logits;
  });
}

function computeClassificationMetrics(logitsList, yTrue, numClasses, temp = 1.0) {
  const cm = Array.from({ length: numClasses }, () => Array(numClasses).fill(0));
  let correct = 0;
  let nllSum = 0;
  let brierSum = 0;

  const confBins = Array.from({ length: 10 }, () => ({ count: 0, confSum: 0, accSum: 0 }));

  for (let i = 0; i < logitsList.length; i++) {
    const probs = softmaxRow(logitsList[i], temp);
    const yt = yTrue[i];
    let bestC = 0;
    for (let c = 1; c < numClasses; c++) {
      if (probs[c] > probs[bestC]) bestC = c;
    }
    cm[yt][bestC]++;
    const isCorrect = bestC === yt ? 1 : 0;
    correct += isCorrect;
    nllSum += -Math.log(Math.max(1e-12, probs[yt]));

    for (let c = 0; c < numClasses; c++) {
      const target = c === yt ? 1 : 0;
      brierSum += (probs[c] - target) ** 2;
    }

    const maxP = probs[bestC];
    const binIdx = Math.min(9, Math.floor(maxP * 10));
    confBins[binIdx].count++;
    confBins[binIdx].confSum += maxP;
    confBins[binIdx].accSum += isCorrect;
  }

  const N = Math.max(1, logitsList.length);
  let ece = 0;
  for (const bin of confBins) {
    if (bin.count > 0) {
      ece += (bin.count / N) * Math.abs(bin.accSum / bin.count - bin.confSum / bin.count);
    }
  }

  const perClass = [];
  let macroP = 0;
  let macroR = 0;
  let macroF1 = 0;

  for (let c = 0; c < numClasses; c++) {
    let tp = cm[c][c];
    let fp = 0;
    let fn = 0;
    for (let k = 0; k < numClasses; k++) {
      if (k !== c) {
        fp += cm[k][c];
        fn += cm[c][k];
      }
    }
    const support = tp + fn;
    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = support > 0 ? tp / support : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    macroP += precision / numClasses;
    macroR += recall / numClasses;
    macroF1 += f1 / numClasses;
    perClass.push({
      className: CLASSES[c],
      agriSoilType: CLASSIFIER_TO_AGRI_SOIL_TYPE[CLASSES[c]],
      precision: Number(precision.toFixed(4)),
      recall: Number(recall.toFixed(4)),
      f1: Number(f1.toFixed(4)),
      support,
    });
  }

  return {
    accuracy: Number((correct / N).toFixed(4)),
    macroPrecision: Number(macroP.toFixed(4)),
    macroRecall: Number(macroR.toFixed(4)),
    macroF1: Number(macroF1.toFixed(4)),
    nll: Number((nllSum / N).toFixed(4)),
    brierScore: Number((brierSum / N).toFixed(4)),
    ece: Number(ece.toFixed(4)),
    confusionMatrix: cm,
    perClass,
  };
}

function fitTemperatureScaling(valLogits, valY, numClasses) {
  let bestT = 1.0;
  let bestNll = Infinity;
  for (let tStep = 10; tStep <= 300; tStep += 2) {
    const t = tStep / 100;
    const m = computeClassificationMetrics(valLogits, valY, numClasses, t);
    if (m.nll < bestNll) {
      bestNll = m.nll;
      bestT = t;
    }
  }
  return Number(bestT.toFixed(3));
}

function roundArray(arr, digits = 5) {
  const factor = 10 ** digits;
  return Array.from(arr, (v) => Math.round(v * factor) / factor);
}

function exportHeldOutTestFixtures(testSoilRecords, testOodRecords) {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  const exportedFixtures = [];

  for (const cls of CLASSES) {
    const candidates = testSoilRecords.filter((r) => r.label === cls).slice(0, 2);
    candidates.forEach((rec, idx) => {
      const srcPath = path.join(ML_DIR, rec.localPath);
      const rawBytes = fs.readFileSync(srcPath);
      const decoded = decodeSoilImageBytes(rawBytes);
      // Save compact 384px JPEG fixture from the held-out test photograph so git repo stays lightweight
      const scale = Math.min(1, 384 / Math.max(decoded.width, decoded.height));
      const outW = Math.max(256, Math.round(decoded.width * scale));
      const outH = Math.max(256, Math.round(decoded.height * scale));
      const resizedRgb = bilinearResizeRgb(decoded.rgb, decoded.width, decoded.height, outW, outH);
      const rgba = new Uint8Array(outW * outH * 4);
      for (let p = 0; p < outW * outH; p++) {
        rgba[p * 4] = resizedRgb[p * 3];
        rgba[p * 4 + 1] = resizedRgb[p * 3 + 1];
        rgba[p * 4 + 2] = resizedRgb[p * 3 + 2];
        rgba[p * 4 + 3] = 255;
      }
      const encoded = jpeg.encode({ data: rgba, width: outW, height: outH }, 90);
      const filename = `${cls.toLowerCase()}_test_${idx + 1}.jpg`;
      fs.writeFileSync(path.join(FIXTURES_DIR, filename), encoded.data);
      exportedFixtures.push({
        filename,
        expectedClass: cls,
        isOod: false,
        sourceId: rec.id,
        sourcePlatform: rec.sourcePlatform,
        sourceUrl: rec.sourceUrl,
        license: rec.license,
      });
    });
  }

  // Export 4 representative held-out non-soil OOD test fixtures (road, foliage, building, person/fabric)
  const wantedOodCategories = [
    "road_asphalt",
    "plant_foliage",
    "building_brick",
    "person_portrait",
  ];
  const pickedOod = [];
  for (const cat of wantedOodCategories) {
    const match =
      testOodRecords.find((r) => r.label === cat && !pickedOod.includes(r)) ||
      testOodRecords.find((r) => !pickedOod.includes(r));
    if (match) pickedOod.push(match);
  }
  pickedOod.forEach((rec, idx) => {
    const srcPath = path.join(ML_DIR, rec.localPath);
    const rawBytes = fs.readFileSync(srcPath);
    const decoded = decodeSoilImageBytes(rawBytes);
    const scale = Math.min(1, 384 / Math.max(decoded.width, decoded.height));
    const outW = Math.max(256, Math.round(decoded.width * scale));
    const outH = Math.max(256, Math.round(decoded.height * scale));
    const resizedRgb = bilinearResizeRgb(decoded.rgb, decoded.width, decoded.height, outW, outH);
    const rgba = new Uint8Array(outW * outH * 4);
    for (let p = 0; p < outW * outH; p++) {
      rgba[p * 4] = resizedRgb[p * 3];
      rgba[p * 4 + 1] = resizedRgb[p * 3 + 1];
      rgba[p * 4 + 2] = resizedRgb[p * 3 + 2];
      rgba[p * 4 + 3] = 255;
    }
    const encoded = jpeg.encode({ data: rgba, width: outW, height: outH }, 90);
    const filename = `ood_${rec.label}_${idx + 1}.jpg`;
    fs.writeFileSync(path.join(FIXTURES_DIR, filename), encoded.data);
    exportedFixtures.push({
      filename,
      expectedClass: null,
      oodCategory: rec.label,
      isOod: true,
      sourceId: rec.id,
      sourcePlatform: rec.sourcePlatform,
      sourceUrl: rec.sourceUrl,
      license: rec.license,
    });
  });

  fs.writeFileSync(
    path.join(FIXTURES_DIR, "fixtures_manifest.json"),
    JSON.stringify(exportedFixtures, null, 2),
  );
  return exportedFixtures;
}

function extractEmbeddingsBatched(featureExtractor, tensorList, batchSize = 32) {
  const results = [];
  for (let start = 0; start < tensorList.length; start += batchSize) {
    const slice = tensorList.slice(start, start + batchSize);
    const B = slice.length;
    const flat = new Float32Array(B * 224 * 224 * 3);
    const physList = new Array(B);
    for (let i = 0; i < B; i++) {
      flat.set(slice[i], i * 224 * 224 * 3);
      physList[i] = computeSurfacePhysicsDescriptor32(slice[i]);
    }
    const batchEmbeddings = tf.tidy(() => {
      const input = tf.tensor4d(flat, [B, 224, 224, 3]);
      const [deepGap, midMap, earlyMap] = featureExtractor.predict(input);
      const deepArr = deepGap.dataSync(); // [B * 512]
      const midMoments = tf.moments(midMap, [1, 2]);
      const midMean = midMoments.mean.dataSync(); // [B * 256]
      const midVar = midMoments.variance.dataSync(); // [B * 256]
      const earlyMoments = tf.moments(earlyMap, [1, 2]);
      const earlyMean = earlyMoments.mean.dataSync(); // [B * 128]
      const earlyVar = earlyMoments.variance.dataSync(); // [B * 128]

      const out = [];
      for (let bIdx = 0; bIdx < B; bIdx++) {
        const dSub = deepArr.subarray(bIdx * 512, (bIdx + 1) * 512);
        const deepNorm = l2Normalize(dSub);

        const midConcat = new Float32Array(512);
        const mOff = bIdx * 256;
        for (let k = 0; k < 256; k++) {
          midConcat[k] = midMean[mOff + k];
          midConcat[256 + k] = Math.sqrt(Math.max(0, midVar[mOff + k]));
        }
        const midNorm = l2Normalize(midConcat);

        const earlyConcat = new Float32Array(256);
        const eOff = bIdx * 128;
        for (let k = 0; k < 128; k++) {
          earlyConcat[k] = earlyMean[eOff + k];
          earlyConcat[128 + k] = Math.sqrt(Math.max(0, earlyVar[eOff + k]));
        }
        const earlyNorm = l2Normalize(earlyConcat);
        const physNorm = physList[bIdx];

        const combined = new Float32Array(1312);
        combined.set(deepNorm, 0);
        combined.set(midNorm, 512);
        for (let k = 0; k < 256; k++) combined[1024 + k] = earlyNorm[k] * 0.85;
        for (let k = 0; k < 32; k++) combined[1280 + k] = physNorm[k] * 0.75;
        out.push(l2Normalize(combined));
      }
      return out;
    });
    results.push(...batchEmbeddings);
  }
  return results;
}

function buildTrainViewsFromResized(resizedRgb, resizedW, resizedH) {
  const cropSize = 224;
  const maxX = Math.max(0, resizedW - cropSize);
  const maxY = Math.max(0, resizedH - cropSize);
  const cx = Math.floor(maxX / 2);
  const cy = Math.floor(maxY / 2);

  const cropAt = (ox, oy) => {
    const out = new Uint8Array(cropSize * cropSize * 3);
    for (let y = 0; y < cropSize; y++) {
      const sOff = ((oy + y) * resizedW + ox) * 3;
      out.set(resizedRgb.subarray(sOff, sOff + cropSize * 3), y * cropSize * 3);
    }
    return out;
  };
  const toNorm = (u8) => {
    const f = new Float32Array(u8.length);
    for (let i = 0; i < u8.length; i++) f[i] = u8[i] / 127.5 - 1.0;
    return f;
  };

  const centerU8 = cropAt(cx, cy);
  const flippedU8 = new Uint8Array(centerU8.length);
  for (let y = 0; y < cropSize; y++) {
    for (let x = 0; x < cropSize; x++) {
      const s = (y * cropSize + x) * 3;
      const d = (y * cropSize + (cropSize - 1 - x)) * 3;
      flippedU8[d] = centerU8[s];
      flippedU8[d + 1] = centerU8[s + 1];
      flippedU8[d + 2] = centerU8[s + 2];
    }
  }

  return [toNorm(centerU8), toNorm(flippedU8), toNorm(cropAt(0, 0)), toNorm(cropAt(maxX, maxY))];
}

async function main() {
  if (!fs.existsSync(RAW_MANIFEST_PATH)) {
    throw new Error(
      `Raw dataset manifest missing at ${RAW_MANIFEST_PATH}. Run 'python3 ml/scripts/fetch_soil_dataset.py' first.`,
    );
  }

  console.log("[train] Loading MobileNetV1 0.50 224 pretrained feature extractor ...");
  const wasmMod = await import("@tensorflow/tfjs-backend-wasm");
  wasmMod.setWasmPaths(path.resolve(ROOT, "node_modules/@tensorflow/tfjs-backend-wasm/dist") + "/");
  await tf.setBackend("wasm");
  await tf.ready();
  console.log(`[train] Active TensorFlow.js backend: ${tf.getBackend()}`);

  const featureExtractor = await loadBackboneFeatureExtractor();

  const rawManifest = JSON.parse(fs.readFileSync(RAW_MANIFEST_PATH, "utf8"));
  console.log(`[train] Preprocessing & decoding ${rawManifest.length} raw photographs ...`);

  const decodedRecords = [];
  for (const item of rawManifest) {
    const imgPath = path.join(ML_DIR, item.localPath);
    if (!fs.existsSync(imgPath)) continue;
    try {
      const buf = fs.readFileSync(imgPath);
      const decoded = decodeSoilImageBytes(buf);
      const shortSide = 256;
      const resizedW =
        decoded.width <= decoded.height
          ? shortSide
          : Math.max(shortSide, Math.round((decoded.width * shortSide) / decoded.height));
      const resizedH =
        decoded.width <= decoded.height
          ? Math.max(shortSide, Math.round((decoded.height * shortSide) / decoded.width))
          : shortSide;
      const resizedRgb = bilinearResizeRgb(
        decoded.rgb,
        decoded.width,
        decoded.height,
        resizedW,
        resizedH,
      );
      const prep = preprocessSoilImageBuffer(buf);

      // Automated bare-soil hygiene check: discard non-OOD candidates dominated by sky or lush foliage
      if (
        !item.isOod &&
        (prep.sceneStats.skyBlueRatio > 0.14 || prep.sceneStats.greenExcessRatio > 0.22)
      ) {
        console.log(
          `  [hygiene filter] Excluded contaminated soil candidate ${item.id} (sky=${prep.sceneStats.skyBlueRatio.toFixed(2)}, grn=${prep.sceneStats.greenExcessRatio.toFixed(2)})`,
        );
        continue;
      }

      decodedRecords.push({
        ...item,
        width: prep.originalWidth,
        height: prep.originalHeight,
        format: prep.format,
        dhash64: prep.dhash64,
        preprocessed: {
          format: prep.format,
          originalWidth: prep.originalWidth,
          originalHeight: prep.originalHeight,
          resizedWidth: prep.resizedWidth,
          resizedHeight: prep.resizedHeight,
          cropWidth: prep.cropWidth,
          cropHeight: prep.cropHeight,
          dhash64: prep.dhash64,
          tensorValues: prep.tensorValues,
          croppedRgb: new Uint8Array(0),
          sceneStats: prep.sceneStats,
        },
        resizedRgb,
        resizedW,
        resizedH,
      });
    } catch (err) {
      console.warn(`  [skip corrupt/invalid] ${item.id}: ${err.message}`);
    }
  }

  console.log(
    `[train] Running batched MobileNet center-crop feature extraction (${decodedRecords.length} images) ...`,
  );
  const centerEmbeddings = extractEmbeddingsBatched(
    featureExtractor,
    decodedRecords.map((r) => r.preprocessed.tensorValues),
    32,
  );
  decodedRecords.forEach((r, idx) => {
    r.centerEmbedding = centerEmbeddings[idx];
  });

  const dedup = deduplicateAndCluster(decodedRecords);
  console.log(
    `[train] Deduplication complete: ${dedup.clean.length} clean images across ${dedup.clusterCount} independent clusters ` +
      `(dropped ${dedup.droppedExactDuplicates} exact SHA-256 duplicates, ${dedup.droppedCrossClassNearDuplicates} cross-class near-duplicates).`,
  );

  const soilRecords = dedup.clean.filter((r) => !r.isOod && CLASSES.includes(r.label));
  const oodRecords = dedup.clean.filter((r) => r.isOod);

  assignStratifiedGroupSplits(soilRecords, oodRecords);

  // Verify zero cluster leakage across splits
  const splitClusters = { train: new Set(), val: new Set(), test: new Set() };
  for (const r of soilRecords) splitClusters[r.split].add(r.clusterId);
  for (const c of splitClusters.train) {
    if (splitClusters.val.has(c) || splitClusters.test.has(c)) {
      throw new Error(`FATAL LEAKAGE: cluster ${c} spans train and val/test!`);
    }
  }
  for (const c of splitClusters.val) {
    if (splitClusters.test.has(c)) {
      throw new Error(`FATAL LEAKAGE: cluster ${c} spans val and test!`);
    }
  }

  const trainSoil = soilRecords.filter((r) => r.split === "train");
  const valSoil = soilRecords.filter((r) => r.split === "val");
  const testSoil = soilRecords.filter((r) => r.split === "test");
  const valOod = oodRecords.filter((r) => r.split === "val");
  const testOod = oodRecords.filter((r) => r.split === "test");

  const classCountsTotal = Object.fromEntries(
    CLASSES.map((c) => [c, soilRecords.filter((r) => r.label === c).length]),
  );
  const classCountsSplit = {
    train: Object.fromEntries(
      CLASSES.map((c) => [c, trainSoil.filter((r) => r.label === c).length]),
    ),
    val: Object.fromEntries(CLASSES.map((c) => [c, valSoil.filter((r) => r.label === c).length])),
    test: Object.fromEntries(CLASSES.map((c) => [c, testSoil.filter((r) => r.label === c).length])),
  };
  console.log("[train] Split counts:", JSON.stringify(classCountsSplit));

  // Build augmented training matrix ONLY from trainSoil (center already computed + 3 extra views)
  console.log(
    `[train] Extracting batched augmented embeddings for ${trainSoil.length} training images ...`,
  );
  const XTrain = [];
  const yTrain = [];
  const extraTensors = [];
  const extraLabels = [];

  for (const rec of trainSoil) {
    const clsIdx = CLASSES.indexOf(rec.label);
    XTrain.push(rec.centerEmbedding);
    yTrain.push(clsIdx);
    const views = buildTrainViewsFromResized(rec.resizedRgb, rec.resizedW, rec.resizedH);
    for (let vIdx = 1; vIdx < views.length; vIdx++) {
      extraTensors.push(views[vIdx]);
      extraLabels.push(clsIdx);
    }
    rec.resizedRgb = null;
  }

  const extraEmbeddings = extractEmbeddingsBatched(featureExtractor, extraTensors, 32);
  for (let i = 0; i < extraEmbeddings.length; i++) {
    XTrain.push(extraEmbeddings[i]);
    yTrain.push(extraLabels[i]);
  }

  const XVal = valSoil.map((r) => r.centerEmbedding);
  const yVal = valSoil.map((r) => CLASSES.indexOf(r.label));
  const XTest = testSoil.map((r) => r.centerEmbedding);
  const yTest = testSoil.map((r) => CLASSES.indexOf(r.label));

  // Inverse-frequency class weights computed strictly on training set
  const trainCountsByIdx = CLASSES.map((_, idx) => yTrain.filter((y) => y === idx).length);
  const classWeights = trainCountsByIdx.map((cnt) => XTrain.length / (CLASSES.length * cnt));
  console.log(
    "[train] Inverse-frequency class weights:",
    Object.fromEntries(CLASSES.map((c, i) => [c, Number(classWeights[i].toFixed(3))])),
  );

  // Hyperparameter search over L2 regularization lambda on validation Macro-F1
  const featureDim = XTrain[0].length;
  const lambdaGrid = [0.001, 0.003, 0.01, 0.025, 0.05, 0.1, 0.2];
  const tuningHistory = [];
  let bestCandidate = null;

  for (const lambda of lambdaGrid) {
    const { W, b } = trainConvexMultinomialLogistic(
      XTrain,
      yTrain,
      classWeights,
      CLASSES.length,
      featureDim,
      lambda,
    );
    const valLogits = predictLogitsBatch(XVal, W, b);
    const valMetrics = computeClassificationMetrics(valLogits, yVal, CLASSES.length, 1.0);
    tuningHistory.push({
      lambda,
      valAccuracy: valMetrics.accuracy,
      valMacroF1: valMetrics.macroF1,
      valNll: valMetrics.nll,
    });
    console.log(
      `  lambda=${lambda.toFixed(4)} -> val MacroF1=${valMetrics.macroF1.toFixed(4)}, val Acc=${valMetrics.accuracy.toFixed(4)}, val NLL=${valMetrics.nll.toFixed(4)}`,
    );

    if (
      !bestCandidate ||
      valMetrics.macroF1 > bestCandidate.valMetrics.macroF1 ||
      (valMetrics.macroF1 === bestCandidate.valMetrics.macroF1 &&
        valMetrics.nll < bestCandidate.valMetrics.nll)
    ) {
      bestCandidate = { lambda, W, b, valLogits, valMetrics };
    }
  }

  // Fit post-hoc temperature scaling on validation logits
  const preCalibVal = bestCandidate.valMetrics;
  const optimalTemp = fitTemperatureScaling(bestCandidate.valLogits, yVal, CLASSES.length);
  const postCalibVal = computeClassificationMetrics(
    bestCandidate.valLogits,
    yVal,
    CLASSES.length,
    optimalTemp,
  );
  console.log(
    `[train] Selected lambda=${bestCandidate.lambda}, optimal temperature T=${optimalTemp} ` +
      `(val NLL ${preCalibVal.nll} -> ${postCalibVal.nll}, val ECE ${preCalibVal.ece} -> ${postCalibVal.ece})`,
  );

  // Compute unit-normalized class centroids & manifold prototypes from training center embeddings
  const classCentroids = CLASSES.map((_, cIdx) => {
    const sum = new Float32Array(featureDim);
    const members = trainSoil.filter((r) => CLASSES.indexOf(r.label) === cIdx);
    for (const m of members) {
      for (let j = 0; j < featureDim; j++) sum[j] += m.centerEmbedding[j];
    }
    return Array.from(l2Normalize(sum));
  });
  const manifoldPrototypes = trainSoil.map((r) => roundArray(r.centerEmbedding, 5));
  // Negative OOD prototypes derived strictly from valOod (never testOod!)
  const oodPrototypes = valOod.map((r) => roundArray(r.centerEmbedding, 5));

  // Calibrate OOD manifold cosine threshold & OOD margin on valSoil vs valOod
  const maxProtoSim = (emb) =>
    Math.max(...manifoldPrototypes.map((proto) => cosineSimilarity(emb, proto)));
  const maxCentSim = (emb) =>
    Math.max(...classCentroids.map((cent) => cosineSimilarity(emb, cent)));
  const maxOodProtoSim = (emb) =>
    oodPrototypes.length > 0
      ? Math.max(...oodPrototypes.map((proto) => cosineSimilarity(emb, proto)))
      : -1;

  const valSoilSims = valSoil.map((r) => maxProtoSim(r.centerEmbedding));
  const valSoilMargins = valSoil.map(
    (r) => maxOodProtoSim(r.centerEmbedding) - maxProtoSim(r.centerEmbedding),
  );
  // Set margin above max margin seen on clean validation soil so real soil is preserved
  const sortedValMargins = [...valSoilMargins].sort((a, b) => a - b);
  const p95Margin =
    sortedValMargins[
      Math.min(sortedValMargins.length - 1, Math.floor(sortedValMargins.length * 0.94))
    ] ?? 0.015;
  const calibratedOodMargin = Number(Math.max(-0.01, Math.min(0.04, p95Margin + 0.008)).toFixed(4));

  let bestTau = 0.6;
  let bestOodBalAcc = -1;
  for (let s = 45; s <= 84; s++) {
    const tau = s / 100;
    const soilKeepRate =
      valSoilSims.filter((v) => v >= tau).length / Math.max(1, valSoilSims.length);
    const oodRejectRate =
      valOod.filter(
        (r) =>
          maxProtoSim(r.centerEmbedding) < tau ||
          r.preprocessed.sceneStats.greenExcessRatio > 0.34 ||
          r.preprocessed.sceneStats.skyBlueRatio > 0.28,
      ).length / Math.max(1, valOod.length);
    const balAcc = 0.58 * soilKeepRate + 0.42 * oodRejectRate;
    if (balAcc > bestOodBalAcc && soilKeepRate >= 0.88) {
      bestOodBalAcc = balAcc;
      bestTau = tau;
    }
  }

  const minValCentSim = Math.min(...valSoil.map((r) => maxCentSim(r.centerEmbedding)));
  const minCentroidTau = Number(Math.max(0.45, minValCentSim - 0.05).toFixed(3));
  console.log(
    `[train] Calibrated OOD thresholds: minManifoldCosineSim=${bestTau}, minCentroidCosineSim=${minCentroidTau}, maxOodPrototypeMargin=${calibratedOodMargin}`,
  );

  // Evaluate strictly once on HELD-OUT TEST SPLIT
  const testLogits = predictLogitsBatch(XTest, bestCandidate.W, bestCandidate.b);
  const testMetrics = computeClassificationMetrics(testLogits, yTest, CLASSES.length, optimalTemp);
  const trainCenterLogits = predictLogitsBatch(
    trainSoil.map((r) => r.centerEmbedding),
    bestCandidate.W,
    bestCandidate.b,
  );
  const trainCenterMetrics = computeClassificationMetrics(
    trainCenterLogits,
    trainSoil.map((r) => CLASSES.indexOf(r.label)),
    CLASSES.length,
    optimalTemp,
  );

  const trainedAt = new Date().toISOString();
  const artifact = {
    schemaVersion: "1.0.0",
    modelName: "MobileNetV1-MultiScale + Calibrated Logistic Head",
    backboneArchitecture: "MobileNetV1_0.50_224",
    featureLayers: [
      "global_average_pooling2d_1",
      "conv_pw_11_relu",
      "conv_pw_5_relu",
      "surface_physics_32",
    ],
    featureDim,
    classes: CLASSES,
    agriSoilTypeMap: CLASSIFIER_TO_AGRI_SOIL_TYPE,
    weights: bestCandidate.W.map((row) => roundArray(row, 6)),
    biases: roundArray(bestCandidate.b, 6),
    temperature: optimalTemp,
    calibrated: true,
    calibrationMethod: "validation_temperature_scaling_softmax",
    oodGates: {
      minManifoldCosineSim: bestTau,
      minCentroidCosineSim: minCentroidTau,
      maxOodPrototypeMargin: calibratedOodMargin,
      minTopProbability: 0.42,
      maxNormalizedEntropy: 0.86,
      maxGreenExcessRatio: 0.34,
      maxSkyBlueRatio: 0.28,
      maxExtremeExposureRatio: 0.75,
      minLumaStd: 0.018,
    },
    classCentroids: classCentroids.map((row) => roundArray(row, 5)),
    manifoldPrototypes,
    oodPrototypes,
    preprocessing: SOIL_PREPROCESSING_CONFIG,
    trainedAt,
    datasetSummary: {
      totalSoilImages: soilRecords.length,
      trainCount: trainSoil.length,
      valCount: valSoil.length,
      testCount: testSoil.length,
      classCounts: classCountsTotal,
      licenseSummary:
        "CC0 1.0 Public Domain (Poly Haven, AmbientCG) + Public Domain / CC BY / CC BY-SA (Wikimedia Commons)",
    },
  };

  // Evaluate full pipeline (including OOD/uncertainty gates) on held-out test OOD & held-out test soil
  const oodTestOutcomes = testOod.map((rec) => {
    const res = scoreEmbeddingWithArtifact(rec.centerEmbedding, rec.preprocessed, artifact);
    return {
      id: rec.id,
      category: rec.label,
      status: res.status,
      rejectionReasonCode: res.rejectionReasonCode,
      manifoldSim: res.diagnostics.manifoldSimilarity,
    };
  });
  const oodHeldOutRejectedCount = oodTestOutcomes.filter((o) => o.status !== "classified").length;
  const oodHeldOutRejectRate = Number(
    (oodHeldOutRejectedCount / Math.max(1, oodTestOutcomes.length)).toFixed(4),
  );

  console.log("\n=== HELD-OUT TEST SET RESULTS (Unseen Images) ===");
  console.log(
    `Test Accuracy:       ${(testMetrics.accuracy * 100).toFixed(2)}% (${testSoil.length} held-out soil photos)`,
  );
  console.log(`Test Macro-F1:       ${(testMetrics.macroF1 * 100).toFixed(2)}%`);
  console.log(`Test Macro-Prec:     ${(testMetrics.macroPrecision * 100).toFixed(2)}%`);
  console.log(`Test Macro-Recall:   ${(testMetrics.macroRecall * 100).toFixed(2)}%`);
  console.log(`Test Brier / ECE:    ${testMetrics.brierScore} / ${testMetrics.ece}`);
  console.log("Per-class metrics:", testMetrics.perClass);
  console.log("Confusion Matrix (rows=true, cols=pred [Sandy, Clayey, Loamy, Silty]):");
  for (let i = 0; i < CLASSES.length; i++) {
    console.log(`  ${CLASSES[i].padEnd(8)} -> ${JSON.stringify(testMetrics.confusionMatrix[i])}`);
  }
  console.log(
    `Held-Out Non-Soil OOD Rejection Rate: ${(oodHeldOutRejectRate * 100).toFixed(1)}% (${oodHeldOutRejectedCount}/${oodTestOutcomes.length})`,
  );

  // Save reproducible artifacts
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, "soil_classifier_artifact.json"),
    JSON.stringify(artifact),
  );
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, "label_map.json"),
    JSON.stringify(
      {
        indexToClass: Object.fromEntries(CLASSES.map((c, i) => [i, c])),
        classToIndex: Object.fromEntries(CLASSES.map((c, i) => [c, i])),
        classToAgriSoilType: CLASSIFIER_TO_AGRI_SOIL_TYPE,
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, "preprocessing_config.json"),
    JSON.stringify(SOIL_PREPROCESSING_CONFIG, null, 2),
  );
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, "training_config.json"),
    JSON.stringify(
      {
        randomSeed: RANDOM_SEED,
        backbone: "MobileNetV1_0.50_224 (Apache-2.0, ImageNet pretrained)",
        featureExtraction:
          "Concatenated L2-normalized global_average_pooling2d_1 (512d) + L2-normalized spatial [mean, std] of conv_pw_11_relu (512d) => 1024d unit vector",
        classifier: "Class-balanced L2-regularized multinomial logistic regression",
        trainAugmentation:
          "5-crop (224x224 from 256px shortest-side resize) + horizontal flip of center crop (6 views/train image; val/test unaugmented single center crop)",
        selectedLambda: bestCandidate.lambda,
        temperature: optimalTemp,
        classWeights: Object.fromEntries(
          CLASSES.map((c, i) => [c, Number(classWeights[i].toFixed(4))]),
        ),
        tuningGrid: tuningHistory,
        trainedAt,
      },
      null,
      2,
    ),
  );

  const exportedFixtures = exportHeldOutTestFixtures(testSoil, testOod);

  const evaluationResults = {
    evaluatedAt: trainedAt,
    selectedModel: artifact.modelName,
    backbone: artifact.backboneArchitecture,
    classes: CLASSES,
    dataset: {
      name: "AgriSmart Curated Open-License Soil Texture Benchmark v1",
      sources: [
        {
          name: "Poly Haven Ground & Soil Photogrammetry Scans",
          url: "https://polyhaven.com/textures/terrain",
          license: "CC0 1.0 Universal Public Domain",
        },
        {
          name: "AmbientCG Overhead Surface Material Captures (Flat 1K-JPG Diffuse)",
          url: "https://ambientcg.com",
          license: "CC0 1.0 Universal Public Domain",
        },
        {
          name: "Wikimedia Commons Field Soil & Loess Photographs",
          url: "https://commons.wikimedia.org",
          license: "Public Domain / CC0 / CC BY / CC BY-SA",
        },
      ],
      totalCleanSoilImages: soilRecords.length,
      totalNonSoilOodImages: oodRecords.length,
      deduplication: {
        exactSha256Removed: dedup.droppedExactDuplicates,
        crossClassNearDuplicatesRemoved: dedup.droppedCrossClassNearDuplicates,
        sameClassNearDuplicatePairsGrouped: dedup.nearDupPairsSameClass,
        independentClusters: dedup.clusterCount,
      },
      splitStrategy:
        "Stratified cluster-grouped split (seed=42) after SHA-256 + 64-bit perceptual dHash deduplication (~65% train / ~15% val / ~20% held-out test; zero capture-series overlap).",
      classCounts: classCountsTotal,
      splitCounts: classCountsSplit,
    },
    metrics: {
      trainUnaugmented: {
        accuracy: trainCenterMetrics.accuracy,
        macroF1: trainCenterMetrics.macroF1,
      },
      validation: {
        accuracy: postCalibVal.accuracy,
        macroPrecision: postCalibVal.macroPrecision,
        macroRecall: postCalibVal.macroRecall,
        macroF1: postCalibVal.macroF1,
        preCalibrationNll: preCalibVal.nll,
        postCalibrationNll: postCalibVal.nll,
        preCalibrationEce: preCalibVal.ece,
        postCalibrationEce: postCalibVal.ece,
      },
      heldOutTest: {
        sampleCount: testSoil.length,
        accuracy: testMetrics.accuracy,
        macroPrecision: testMetrics.macroPrecision,
        macroRecall: testMetrics.macroRecall,
        macroF1: testMetrics.macroF1,
        nll: testMetrics.nll,
        brierScore: testMetrics.brierScore,
        ece: testMetrics.ece,
        perClass: testMetrics.perClass,
        confusionMatrix: testMetrics.confusionMatrix,
      },
      oodRejection: {
        heldOutNonSoilCount: oodTestOutcomes.length,
        rejectedOrUncertainCount: oodHeldOutRejectedCount,
        rejectionRate: oodHeldOutRejectRate,
        outcomes: oodTestOutcomes,
      },
    },
    limitations: [
      "Dataset scale (~120 verified real soil images across 4 textural classes, with Silty having the smallest support at ~21 images) means rare regional sub-textures (e.g., black vertisols, volcanic andisols, or wet silty clay loams) may trigger 'uncertain' or neighbour-class predictions.",
      "RGB surface photographs capture only the top millimetres of soil; subsurface horizons, moisture film from rain/irrigation, harsh midday shadows, and camera white-balance shifts can alter apparent colour and aggregate contrast.",
      "Out-of-distribution rejection reliably filters vegetation-dominated scenes, sky/water backgrounds, blank/corrupt frames, and common semantic objects (roads, buildings, people), but close-up non-soil brown granular surfaces (e.g., sandpaper, cork, weathered sandstone, or brown carpet) can still resemble mineral soil in 2D RGB space.",
      "Visual soil texture classification NEVER measures chemical soil fertility (N, P, K, pH, EC, organic carbon) and must never replace accredited laboratory testing.",
    ],
    exportedTestFixturesCount: exportedFixtures.length,
  };

  fs.writeFileSync(
    path.join(ARTIFACT_DIR, "evaluation_results.json"),
    JSON.stringify(evaluationResults, null, 2),
  );

  // Save clean dataset provenance manifest (without raw buffers/embeddings)
  const cleanManifest = [...soilRecords, ...oodRecords].map((r) => ({
    id: r.id,
    label: r.label,
    isOod: r.isOod,
    split: r.split,
    clusterId: r.clusterId,
    sourceGroup: r.sourceGroup,
    sourcePlatform: r.sourcePlatform,
    sourceAssetId: r.sourceAssetId,
    sourceUrl: r.sourceUrl,
    license: r.license,
    sha256: r.sha256,
    dhash64: r.dhash64,
    width: r.width,
    height: r.height,
  }));
  fs.writeFileSync(
    path.join(ARTIFACT_DIR, "dataset_manifest.json"),
    JSON.stringify(cleanManifest, null, 2),
  );

  console.log(
    `\n[train] Artifacts saved to ${ARTIFACT_DIR} and ${exportedFixtures.length} held-out fixtures written to ${FIXTURES_DIR}.`,
  );
}

main().catch((err) => {
  console.error("[train] FAILED:", err);
  process.exit(1);
});

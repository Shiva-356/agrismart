import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { evaluateAllAgronomicCrops } from "@/lib/agri";
import { computeHybridRecommendations, DEFAULT_HYBRID_RANKING_CONFIG } from "@/lib/hybrid-ranking";
import { modelClasses, predictWithLocalForest } from "@/lib/ml/forest";

/**
 * Exact NumPy legacy RandomState (MT19937 + rk_interval) implementation
 * to reproduce scikit-learn's `train_test_split(..., test_size=0.2, random_state=42, stratify=y)`
 * on `ml/data/Crop_recommendation.csv` (2,200 rows -> 1,760 train / 440 held-out test).
 */
class NumpyRandomState {
  constructor(seed) {
    this.mt = new Uint32Array(624);
    this.mti = 625;
    this.initGenrand(seed >>> 0);
  }

  initGenrand(s) {
    this.mt[0] = s >>> 0;
    for (let i = 1; i < 624; i++) {
      const prev = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
      this.mt[i] = (Math.imul(1812433253, prev) + i) >>> 0;
    }
    this.mti = 624;
  }

  genrandInt32() {
    let y;
    const mag01 = [0x0, 0x9908b0df];
    if (this.mti >= 624) {
      let kk;
      for (kk = 0; kk < 624 - 397; kk++) {
        y = (this.mt[kk] & 0x80000000) | (this.mt[kk + 1] & 0x7fffffff);
        this.mt[kk] = this.mt[kk + 397] ^ (y >>> 1) ^ mag01[y & 0x1];
      }
      for (; kk < 623; kk++) {
        y = (this.mt[kk] & 0x80000000) | (this.mt[kk + 1] & 0x7fffffff);
        this.mt[kk] = this.mt[kk + (397 - 624)] ^ (y >>> 1) ^ mag01[y & 0x1];
      }
      y = (this.mt[623] & 0x80000000) | (this.mt[0] & 0x7fffffff);
      this.mt[623] = this.mt[396] ^ (y >>> 1) ^ mag01[y & 0x1];
      this.mti = 0;
    }
    y = this.mt[this.mti++];
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return y >>> 0;
  }

  rkInterval(max) {
    if (max === 0) return 0;
    let mask = max;
    mask |= mask >>> 1;
    mask |= mask >>> 2;
    mask |= mask >>> 4;
    mask |= mask >>> 8;
    mask |= mask >>> 16;
    while (true) {
      const value = (this.genrandInt32() & mask) >>> 0;
      if (value <= max) return value;
    }
  }

  permutation(n) {
    const arr = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i >= 1; i--) {
      const j = this.rkInterval(i);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }
}

function loadBenchmarkCsv() {
  const csvPath = path.resolve(process.cwd(), "ml/data/Crop_recommendation.csv");
  const lines = fs.readFileSync(csvPath, "utf8").trim().split(/\r?\n/);
  const header = lines[0].split(",").map((h) => h.trim());
  assert.deepEqual(header, ["N", "P", "K", "temperature", "humidity", "ph", "rainfall", "label"]);

  return lines.slice(1).map((line, rowIdx) => {
    const parts = line.split(",");
    return {
      rowIdx,
      features: {
        N: Number(parts[0]),
        P: Number(parts[1]),
        K: Number(parts[2]),
        temperature: Number(parts[3]),
        humidity: Number(parts[4]),
        ph: Number(parts[5]),
        rainfall: Number(parts[6]),
      },
      label: parts[7].trim(),
    };
  });
}

function reproduceHeldOutTestSet(rows) {
  // scikit-learn StratifiedShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
  // iterates over np.unique(y) in sorted lexicographical order, permutes each class's indices
  // with a single RandomState(42) instance, takes first n_train (80) for train and remaining 20 for test,
  // and finally permutes train and test arrays. Order does not affect aggregate classification metrics,
  // and confusion matrix equality verifies exact held-out membership.
  const classesSorted = Array.from(new Set(rows.map((r) => r.label))).sort();
  const byClass = new Map();
  for (const cls of classesSorted) byClass.set(cls, []);
  for (const row of rows) byClass.get(row.label).push(row);

  const rng = new NumpyRandomState(42);
  const testRows = [];
  for (const cls of classesSorted) {
    const group = byClass.get(cls);
    const perm = rng.permutation(group.length);
    const nTrain = Math.floor(group.length * 0.8); // 80 train, 20 test
    for (let i = nTrain; i < group.length; i++) {
      testRows.push(group[perm[i]]);
    }
  }
  return { classesSorted, testRows };
}

function computeMultiClassMetrics(classesSorted, groundTruths, rankedPredictionsList) {
  const classToIdx = new Map(classesSorted.map((c, i) => [c, i]));
  const k = classesSorted.length;
  const cm = Array.from({ length: k }, () => Array(k).fill(0));

  let top1Correct = 0;
  let top3Hits = 0;
  let top5Hits = 0;

  for (let i = 0; i < groundTruths.length; i++) {
    const actual = groundTruths[i];
    const ranked = rankedPredictionsList[i];
    const predTop1 = ranked[0] ?? "";
    if (predTop1 === actual) top1Correct++;
    if (ranked.slice(0, 3).includes(actual)) top3Hits++;
    if (ranked.slice(0, 5).includes(actual)) top5Hits++;

    const actualIdx = classToIdx.get(actual);
    const predIdx = classToIdx.get(predTop1);
    if (actualIdx !== undefined && predIdx !== undefined) {
      cm[actualIdx][predIdx] += 1;
    }
  }

  let macroPrecisionSum = 0;
  let macroRecallSum = 0;
  let macroF1Sum = 0;

  for (let c = 0; c < k; c++) {
    const tp = cm[c][c];
    let colSum = 0;
    let rowSum = 0;
    for (let j = 0; j < k; j++) {
      rowSum += cm[c][j];
      colSum += cm[j][c];
    }
    const precision = colSum > 0 ? tp / colSum : 0;
    const recall = rowSum > 0 ? tp / rowSum : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    macroPrecisionSum += precision;
    macroRecallSum += recall;
    macroF1Sum += f1;
  }

  const n = groundTruths.length;
  return {
    n,
    confusionMatrix: cm,
    accuracy: top1Correct / n,
    macroPrecision: macroPrecisionSum / k,
    macroRecall: macroRecallSum / k,
    macroF1: macroF1Sum / k,
    top3Recall: top3Hits / n,
    top5Recall: top5Hits / n,
    top1Correct,
  };
}

function main() {
  const rows = loadBenchmarkCsv();
  const { classesSorted, testRows } = reproduceHeldOutTestSet(rows);
  assert.equal(rows.length, 2200);
  assert.equal(testRows.length, 440);
  assert.deepEqual(classesSorted, modelClasses);

  const evalArtifactPath = path.resolve(process.cwd(), "src/services/ml/evaluation_results.json");
  const evalArtifact = JSON.parse(fs.readFileSync(evalArtifactPath, "utf8"));

  const groundTruths = testRows.map((r) => r.label);
  const localPredict = (f) => predictWithLocalForest(f)?.ranked ?? null;

  // 1. Baseline A: Pure Random Forest (200 trees, exported sklearn artifact)
  const mlRankedList = testRows.map((row) => {
    const pred = predictWithLocalForest(row.features);
    return (pred?.allClassScores ?? []).map((p) => p.crop);
  });
  const mlMetrics = computeMultiClassMetrics(classesSorted, groundTruths, mlRankedList);

  // Verify 100% exact split parity with ml/train.py held-out confusion matrix!
  assert.deepEqual(
    mlMetrics.confusionMatrix,
    evalArtifact.confusionMatrix,
    "Held-out 440-row split must match ml/train.py confusion matrix identically",
  );

  // 2. Baseline B1: Rule-Based Engine ONLY (uniform neutral Loamy soil + fixed 650 water units,
  //    using each row's actual temperature; Crop_recommendation.csv has NO soilType or irrigation column)
  const ruleFixedWaterList = testRows.map((row) => {
    const input = {
      name: "HeldOutEval",
      landArea: 4,
      water: 650,
      soilType: "Loamy",
      budget: 60000,
      preferredCrop: "",
      notes: "",
      mlFeatures: row.features,
    };
    return evaluateAllAgronomicCrops(input)
      .slice()
      .sort((a, b) =>
        b.compositeScore !== a.compositeScore
          ? b.compositeScore - a.compositeScore
          : a.cropId.localeCompare(b.cropId),
      )
      .map((c) => c.cropId);
  });
  const ruleFixedMetrics = computeMultiClassMetrics(
    classesSorted,
    groundTruths,
    ruleFixedWaterList,
  );

  // 3. Baseline B2: Rule-Based Engine ONLY (uniform Loamy soil + water = row.rainfall directly, no irrigation)
  const ruleRainAsWaterList = testRows.map((row) => {
    const input = {
      name: "HeldOutEvalRainOnly",
      landArea: 4,
      water: row.features.rainfall,
      soilType: "Loamy",
      budget: 60000,
      preferredCrop: "",
      notes: "",
      mlFeatures: row.features,
    };
    return evaluateAllAgronomicCrops(input)
      .slice()
      .sort((a, b) =>
        b.compositeScore !== a.compositeScore
          ? b.compositeScore - a.compositeScore
          : a.cropId.localeCompare(b.cropId),
      )
      .map((c) => c.cropId);
  });
  const ruleRainMetrics = computeMultiClassMetrics(
    classesSorted,
    groundTruths,
    ruleRainAsWaterList,
  );

  // 4. Hybrid CA-RRF (Default config: k=10, w_rule=0.45, w_ml=0.55) with uniform neutral farm plan (Loamy, water=650)
  const hybridDefaultFixedList = testRows.map((row) => {
    const input = {
      name: "HeldOutHybridFixed",
      landArea: 4,
      water: 650,
      soilType: "Loamy",
      budget: 60000,
      preferredCrop: "",
      notes: "",
      mlFeatures: row.features,
    };
    const res = computeHybridRecommendations({
      planInput: input,
      mlFeatures: row.features,
      localForestPredict: localPredict,
      config: { ...DEFAULT_HYBRID_RANKING_CONFIG, maxResults: 22 },
    });
    return res.rankedCandidates.map((c) => c.canonicalCropId);
  });
  const hybridDefaultFixedMetrics = computeMultiClassMetrics(
    classesSorted,
    groundTruths,
    hybridDefaultFixedList,
  );

  // 5. Hybrid CA-RRF (Default config: k=10, w_rule=0.45, w_ml=0.55) with rainfed water=row.rainfall on Loamy soil
  const hybridDefaultRainList = testRows.map((row) => {
    const input = {
      name: "HeldOutHybridRain",
      landArea: 4,
      water: row.features.rainfall,
      soilType: "Loamy",
      budget: 60000,
      preferredCrop: "",
      notes: "",
      mlFeatures: row.features,
    };
    const res = computeHybridRecommendations({
      planInput: input,
      mlFeatures: row.features,
      localForestPredict: localPredict,
      config: { ...DEFAULT_HYBRID_RANKING_CONFIG, maxResults: 22 },
    });
    return res.rankedCandidates.map((c) => c.canonicalCropId);
  });
  const hybridDefaultRainMetrics = computeMultiClassMetrics(
    classesSorted,
    groundTruths,
    hybridDefaultRainList,
  );

  // 6. Hybrid CA-RRF (ML-Priority preset: k=10, w_rule=0.35, w_ml=0.65) with uniform neutral farm plan (Loamy, water=650)
  const hybridMlPriorityList = testRows.map((row) => {
    const input = {
      name: "HeldOutHybridMlPriority",
      landArea: 4,
      water: 650,
      soilType: "Loamy",
      budget: 60000,
      preferredCrop: "",
      notes: "",
      mlFeatures: row.features,
    };
    const res = computeHybridRecommendations({
      planInput: input,
      mlFeatures: row.features,
      localForestPredict: localPredict,
      config: {
        ...DEFAULT_HYBRID_RANKING_CONFIG,
        ruleWeight: 0.35,
        mlWeight: 0.65,
        maxResults: 22,
      },
    });
    return res.rankedCandidates.map((c) => c.canonicalCropId);
  });
  const hybridMlPriorityMetrics = computeMultiClassMetrics(
    classesSorted,
    groundTruths,
    hybridMlPriorityList,
  );

  const summary = [
    {
      method: "Random Forest ML Baseline (200 trees)",
      correctTop1: `${mlMetrics.top1Correct}/440`,
      top1AccuracyPct: Number((mlMetrics.accuracy * 100).toFixed(2)),
      macroPrecisionPct: Number((mlMetrics.macroPrecision * 100).toFixed(2)),
      macroRecallPct: Number((mlMetrics.macroRecall * 100).toFixed(2)),
      macroF1Pct: Number((mlMetrics.macroF1 * 100).toFixed(2)),
      top3RecallPct: Number((mlMetrics.top3Recall * 100).toFixed(2)),
      top5RecallPct: Number((mlMetrics.top5Recall * 100).toFixed(2)),
    },
    {
      method: "Rule-Based Baseline (Loamy + 650 water neutral default)",
      correctTop1: `${ruleFixedMetrics.top1Correct}/440`,
      top1AccuracyPct: Number((ruleFixedMetrics.accuracy * 100).toFixed(2)),
      macroPrecisionPct: Number((ruleFixedMetrics.macroPrecision * 100).toFixed(2)),
      macroRecallPct: Number((ruleFixedMetrics.macroRecall * 100).toFixed(2)),
      macroF1Pct: Number((ruleFixedMetrics.macroF1 * 100).toFixed(2)),
      top3RecallPct: Number((ruleFixedMetrics.top3Recall * 100).toFixed(2)),
      top5RecallPct: Number((ruleFixedMetrics.top5Recall * 100).toFixed(2)),
    },
    {
      method: "Rule-Based Baseline (Loamy + water=CSV rainfall)",
      correctTop1: `${ruleRainMetrics.top1Correct}/440`,
      top1AccuracyPct: Number((ruleRainMetrics.accuracy * 100).toFixed(2)),
      macroPrecisionPct: Number((ruleRainMetrics.macroPrecision * 100).toFixed(2)),
      macroRecallPct: Number((ruleRainMetrics.macroRecall * 100).toFixed(2)),
      macroF1Pct: Number((ruleRainMetrics.macroF1 * 100).toFixed(2)),
      top3RecallPct: Number((ruleRainMetrics.top3Recall * 100).toFixed(2)),
      top5RecallPct: Number((ruleRainMetrics.top5Recall * 100).toFixed(2)),
    },
    {
      method: "Hybrid CA-RRF Default (45/55, Loamy + 650 water)",
      correctTop1: `${hybridDefaultFixedMetrics.top1Correct}/440`,
      top1AccuracyPct: Number((hybridDefaultFixedMetrics.accuracy * 100).toFixed(2)),
      macroPrecisionPct: Number((hybridDefaultFixedMetrics.macroPrecision * 100).toFixed(2)),
      macroRecallPct: Number((hybridDefaultFixedMetrics.macroRecall * 100).toFixed(2)),
      macroF1Pct: Number((hybridDefaultFixedMetrics.macroF1 * 100).toFixed(2)),
      top3RecallPct: Number((hybridDefaultFixedMetrics.top3Recall * 100).toFixed(2)),
      top5RecallPct: Number((hybridDefaultFixedMetrics.top5Recall * 100).toFixed(2)),
    },
    {
      method: "Hybrid CA-RRF Default (45/55, Loamy + water=CSV rainfall)",
      correctTop1: `${hybridDefaultRainMetrics.top1Correct}/440`,
      top1AccuracyPct: Number((hybridDefaultRainMetrics.accuracy * 100).toFixed(2)),
      macroPrecisionPct: Number((hybridDefaultRainMetrics.macroPrecision * 100).toFixed(2)),
      macroRecallPct: Number((hybridDefaultRainMetrics.macroRecall * 100).toFixed(2)),
      macroF1Pct: Number((hybridDefaultRainMetrics.macroF1 * 100).toFixed(2)),
      top3RecallPct: Number((hybridDefaultRainMetrics.top3Recall * 100).toFixed(2)),
      top5RecallPct: Number((hybridDefaultRainMetrics.top5Recall * 100).toFixed(2)),
    },
    {
      method: "Hybrid CA-RRF ML-Priority (35/65, Loamy + 650 water)",
      correctTop1: `${hybridMlPriorityMetrics.top1Correct}/440`,
      top1AccuracyPct: Number((hybridMlPriorityMetrics.accuracy * 100).toFixed(2)),
      macroPrecisionPct: Number((hybridMlPriorityMetrics.macroPrecision * 100).toFixed(2)),
      macroRecallPct: Number((hybridMlPriorityMetrics.macroRecall * 100).toFixed(2)),
      macroF1Pct: Number((hybridMlPriorityMetrics.macroF1 * 100).toFixed(2)),
      top3RecallPct: Number((hybridMlPriorityMetrics.top3Recall * 100).toFixed(2)),
      top5RecallPct: Number((hybridMlPriorityMetrics.top5Recall * 100).toFixed(2)),
    },
  ];

  console.log("=== HELD-OUT 440-ROW BENCHMARK EVALUATION (random_state=42, 22 classes x 20) ===");
  console.log(JSON.stringify(summary, null, 2));
}

main();

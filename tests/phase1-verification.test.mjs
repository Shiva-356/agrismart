import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it, beforeEach } from "node:test";

import {
  EXPECTED_ML_FEATURES,
  UNCALIBRATED_MODEL_SCORE_NOTE,
  isValidMlFeatureValue,
  localModelAvailable,
  modelClasses,
  modelFeatures,
  modelScoringMethod,
  predictWithLocalForest,
} from "@/lib/ml/forest";
import { handlePredictPost } from "@/lib/ml/predict-handler";
import {
  areMlFeaturesComplete,
  buildActivePlanFromSoilReport,
  clearActivePlan,
  deriveActivePlanSummary,
  derivePlanComparisonCrops,
  extractMlFeaturesFromSoilParameters,
  generateGeneralPlanningRecommendations,
  generateMlPrediction,
  loadActivePlan,
  saveActivePlan,
} from "@/lib/agri";
import { ApiError } from "@/services/api/client";
import { recommendationsService } from "@/services";

function installMockWindowStorage() {
  const store = new Map();
  const listeners = new Map();
  globalThis.window = {
    location: {
      hostname: "preview.run.app",
      protocol: "https:",
    },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    },
    addEventListener: (type, fn) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener: (type, fn) => {
      listeners.get(type)?.delete(fn);
    },
    dispatchEvent: (evt) => {
      const fns = listeners.get(evt.type);
      if (fns) {
        for (const fn of fns) fn(evt);
      }
      return true;
    },
  };
  return store;
}

describe("P0 — Seasonal rainfall isolation & input validation", () => {
  beforeEach(() => {
    installMockWindowStorage();
  });

  it("never populates seasonal rainfall from hourly weather precipitation in extractMlFeaturesFromSoilParameters", () => {
    const soilParams = [
      { key: "n", status: "available", value: 90 },
      { key: "p", status: "available", value: 42 },
      { key: "k", status: "available", value: 43 },
      { key: "ph", status: "available", value: 6.5 },
    ];
    const ambientWeather = {
      temperatureC: 24.6,
      humidityPct: 78,
      rainfallMm: 18.4, // 1-hour weather station precipitation — MUST NEVER populate seasonal rainfall
    };

    const { features, soilKeysLoaded, weatherKeysLoaded } = extractMlFeaturesFromSoilParameters(
      soilParams,
      ambientWeather,
      null,
    );

    assert.deepEqual(soilKeysLoaded, ["N", "P", "K", "ph"]);
    assert.deepEqual(weatherKeysLoaded, ["temperature", "humidity"]);
    assert.equal(features.N, 90);
    assert.equal(features.temperature, 24.6);
    assert.equal(features.humidity, 78);
    assert.equal(features.rainfall, undefined);
    assert.equal("rainfall" in features, false);
    assert.equal(areMlFeaturesComplete(features), false);
  });

  it("never leaks hourly rainfallMm into labFeatures.rainfall or FarmInput.weather in buildActivePlanFromSoilReport", () => {
    const report = {
      id: "sr-101",
      laboratory: "District Soil Testing Lab",
      sampleId: "SMP-2026-01",
      testDate: "2026-03-15",
      verified: true,
      parameters: [
        { key: "n", status: "available", value: 85 },
        { key: "p", status: "available", value: 40 },
        { key: "k", status: "available", value: 45 },
        { key: "ph", status: "available", value: 6.8 },
      ],
    };

    const nextPlan = buildActivePlanFromSoilReport({
      report,
      existingPlan: null,
      fallbackFarm: { name: "Green Valley", landAreaAcres: 4, currentCrop: "Maize" },
      ambientWeather: { temperatureC: 28.2, humidityPct: 71, rainfallMm: 12.5 },
    });

    assert.equal(nextPlan.labFeatures?.rainfall, undefined);
    assert.equal(nextPlan.input.mlFeatures?.rainfall, undefined);
    assert.equal("rainfall" in (nextPlan.input.weather ?? {}), false);
    assert.equal(nextPlan.input.weather?.temperature, 28.2);
    assert.equal(nextPlan.input.weather?.humidity, 71);
  });

  it("distinguishes missing seasonal rainfall from a genuine zero seasonal rainfall (0.0 mm)", () => {
    const incomplete = {
      N: 90,
      P: 42,
      K: 43,
      temperature: 21,
      humidity: 82,
      ph: 6.5,
    };
    assert.equal(areMlFeaturesComplete(incomplete), false);
    assert.equal(predictWithLocalForest(incomplete), null);

    const zeroSeasonalRainfall = {
      ...incomplete,
      rainfall: 0,
    };
    assert.equal(isValidMlFeatureValue("rainfall", 0), true);
    assert.equal(areMlFeaturesComplete(zeroSeasonalRainfall), true);
    const pred = predictWithLocalForest(zeroSeasonalRainfall);
    assert.ok(pred !== null, "Genuine 0.0 mm seasonal rainfall must be accepted");
    assert.equal(pred.treeCount, 200);
  });

  it("rejects missing, out-of-range, non-finite, and extra-field payloads on POST /api/predict with 400 INVALID_ML_INPUT", async () => {
    // 1. Missing seasonal rainfall
    const missingRainRes = await handlePredictPost(
      new Request("http://localhost:3000/api/predict", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ N: 90, P: 42, K: 43, temperature: 21, humidity: 82, ph: 6.5 }),
      }),
    );
    assert.equal(missingRainRes.status, 400);
    const missingRainBody = await missingRainRes.json();
    assert.equal(missingRainBody.errorCode, "INVALID_ML_INPUT");

    // 2. Extra hourly rainfallMm field rejected by strict schema
    const extraFieldRes = await handlePredictPost(
      new Request("http://localhost:3000/api/predict", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          N: 90,
          P: 42,
          K: 43,
          temperature: 21,
          humidity: 82,
          ph: 6.5,
          rainfall: 202,
          rainfallMm: 4.2,
        }),
      }),
    );
    assert.equal(extraFieldRes.status, 400);
    const extraFieldBody = await extraFieldRes.json();
    assert.equal(extraFieldBody.errorCode, "INVALID_ML_INPUT");

    // 3. Out-of-range pH rejected with 400 (never 500/502/503)
    const outOfRangeRes = await handlePredictPost(
      new Request("http://localhost:3000/api/predict", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          N: 90,
          P: 42,
          K: 43,
          temperature: 21,
          humidity: 82,
          ph: 15.2,
          rainfall: 202,
        }),
      }),
    );
    assert.equal(outOfRangeRes.status, 400);

    // 4. Genuine 0.0 mm seasonal rainfall succeeds with 200
    const zeroRainRes = await handlePredictPost(
      new Request("http://localhost:3000/api/predict", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          N: 40,
          P: 65,
          K: 80,
          temperature: 19,
          humidity: 16,
          ph: 7.2,
          rainfall: 0,
        }),
      }),
    );
    assert.equal(zeroRainRes.status, 200);
    const zeroRainBody = await zeroRainRes.json();
    assert.equal(zeroRainBody.calibrated, false);
    assert.equal(zeroRainBody.scoringMethod, "predict_proba_mean_leaf_distribution");
  });

  it("requires explicit seasonalRainfallMm in recommendationsService and classifies missing rainfall as 422 unprocessable (not service outage)", async () => {
    await assert.rejects(
      () => recommendationsService.get("farm-1"),
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.status, 422);
        assert.equal(err.errorCode, "SEASONAL_RAINFALL_REQUIRED");
        assert.equal(err.isUnprocessable, true);
        assert.equal(err.isUnavailable, false);
        return true;
      },
    );
  });
});

describe("P1 — Python & TypeScript Random Forest inference alignment", () => {
  it("exports identical full-precision predict_proba artifacts in ml/artifacts and src/services/ml", () => {
    const mlArtifactPath = path.resolve("ml/artifacts/model_export.json");
    const tsArtifactPath = path.resolve("src/services/ml/model_export.json");
    const mlRaw = fs.readFileSync(mlArtifactPath, "utf8");
    const tsRaw = fs.readFileSync(tsArtifactPath, "utf8");
    assert.equal(
      mlRaw,
      tsRaw,
      "ml/artifacts/model_export.json and src/services/ml/model_export.json must match byte-for-byte",
    );

    const parsed = JSON.parse(tsRaw);
    assert.equal(parsed.supported, true);
    assert.equal(parsed.kind, "random_forest_predict_proba");
    assert.equal(parsed.scoringMethod, "predict_proba_mean_leaf_distribution");
    assert.equal(parsed.calibrated, false);
    assert.deepEqual(parsed.features, [...EXPECTED_ML_FEATURES]);
    assert.equal(parsed.classes.length, 22);
    assert.equal(parsed.trees.length, 200);

    // Confirm full IEEE-754 threshold precision is preserved (not rounded to 6 decimals)
    let highPrecisionThresholds = 0;
    for (const tree of parsed.trees) {
      for (let i = 0; i < tree.l.length; i++) {
        if (tree.l[i] !== -1) {
          const thresh = tree.t[i];
          if (Math.abs(thresh - Number(thresh.toFixed(6))) > 0) {
            highPrecisionThresholds++;
          }
        } else {
          const dist = tree.d[i];
          assert.ok(Array.isArray(dist) && dist.length > 0);
          const sum = dist.reduce((acc, pair) => acc + pair[1], 0);
          assert.ok(Math.abs(sum - 1.0) < 1e-12);
        }
      }
    }
    assert.ok(
      highPrecisionThresholds > 1000,
      `Expected >1000 full-precision split thresholds, found ${highPrecisionThresholds}`,
    );
  });

  it("computes normalized predict_proba class distributions, deterministic tie-breaking, and uncalibrated score labels", () => {
    assert.equal(localModelAvailable, true);
    assert.equal(modelFeatures.length, 7);
    assert.equal(modelClasses.length, 22);
    assert.equal(modelScoringMethod, "predict_proba_mean_leaf_distribution");

    const pred = predictWithLocalForest({
      N: 90,
      P: 42,
      K: 43,
      temperature: 20.879744,
      humidity: 82.002744,
      ph: 6.502985,
      rainfall: 202.935536,
    });
    assert.ok(pred !== null);
    assert.equal(pred.crop, "rice");
    assert.equal(pred.calibrated, false);
    const totalScore = pred.allClassScores.reduce((acc, c) => acc + c.probability, 0);
    assert.ok(Math.abs(totalScore - 1.0) < 1e-12, `Expected total score 1.0, got ${totalScore}`);

    // Verify ascending-class-index tie-breaking on zero-score classes
    const zeroClasses = pred.allClassScores.filter((c) => c.probability === 0).map((c) => c.crop);
    const sortedZeroClasses = [...zeroClasses].sort();
    assert.deepEqual(zeroClasses, sortedZeroClasses);

    // Verify invalid inputs are rejected
    assert.equal(
      predictWithLocalForest({
        N: NaN,
        P: 42,
        K: 43,
        temperature: 21,
        humidity: 82,
        ph: 6.5,
        rainfall: 202,
      }),
      null,
    );
    assert.equal(
      predictWithLocalForest({
        N: true,
        P: 42,
        K: 43,
        temperature: 21,
        humidity: 82,
        ph: 6.5,
        rainfall: 202,
      }),
      null,
    );

    // Verify generateMlPrediction labels outputs as uncalibrated model scores
    const recs = generateMlPrediction({
      N: 90,
      P: 42,
      K: 43,
      temperature: 21,
      humidity: 82,
      ph: 6.5,
      rainfall: 202,
    });
    assert.ok(recs && recs.length > 0);
    assert.match(recs[0].rationale, /uncalibrated model score/i);
    assert.match(recs[0].note ?? "", /uncalibrated/i);
    assert.doesNotMatch(UNCALIBRATED_MODEL_SCORE_NOTE, /calibrated confidence/i);
  });
});

describe("P1 — Dashboard, Recommendations & Compare active-plan consistency", () => {
  beforeEach(() => {
    installMockWindowStorage();
    clearActivePlan();
  });

  it("keeps Dashboard, Recommendations, and Compare Crops consistent when ML inputs are incomplete (Rule-Based active)", () => {
    // Apply a soil report with N, P, K, pH + live weather (with 1-hour rainfallMm=8.5, NO seasonal rainfall)
    const appliedPlan = buildActivePlanFromSoilReport({
      report: {
        id: "sr-demo-1",
        laboratory: "State Agri Lab",
        sampleId: "SAL-88",
        testDate: "2026-04-01",
        verified: true,
        parameters: [
          { key: "n", status: "available", value: 110 },
          { key: "p", status: "available", value: 48 },
          { key: "k", status: "available", value: 52 },
          { key: "ph", status: "available", value: 6.7 },
        ],
      },
      existingPlan: {
        input: {
          name: "Sunrise Plot",
          landArea: 6,
          water: 280,
          soilType: "Sandy",
          budget: 45000,
          preferredCrop: "",
          notes: "",
        },
        submittedAt: "2026-04-01T09:00:00.000Z",
      },
      ambientWeather: { temperatureC: 30, humidityPct: 55, rainfallMm: 8.5 },
    });
    saveActivePlan(appliedPlan);

    // Simulate reload
    const reloaded = loadActivePlan();
    assert.ok(reloaded !== null);

    // 1. Dashboard summary
    const dashboardSummary = deriveActivePlanSummary({
      activePlan: reloaded,
      farm: { name: "Sunrise Plot", landAreaAcres: 6, currentCrop: null },
      weather: { temperatureC: 30, humidityPct: 55, rainfallMm: 8.5 },
      soil: null,
    });

    // 2. Recommendations page rule engine
    const recPageRule = generateGeneralPlanningRecommendations(reloaded.input);

    // 3. Compare page rule engine
    const compareRule = derivePlanComparisonCrops({
      planInput: reloaded.input,
      labFeatures: reloaded.labFeatures,
      isDemoProfile: reloaded.isDemoProfile,
      mode: "rule",
    });

    assert.equal(dashboardSummary.mlComplete, false);
    assert.equal(dashboardSummary.primaryEngine, "rule");
    assert.deepEqual(dashboardSummary.missingMlLabels, ["Seasonal rainfall"]);
    assert.equal(dashboardSummary.primaryRecs[0].crop, recPageRule[0].crop);
    assert.equal(dashboardSummary.primaryRecs[0].crop, compareRule[0].crop);
    assert.deepEqual(
      dashboardSummary.primaryRecs.map((r) => r.crop),
      compareRule.map((c) => c.crop),
    );
  });

  it("keeps Dashboard, Recommendations, and Compare Crops consistent when all 7 ML features are valid (and separates demo vs verified)", () => {
    const verifiedFeatures = {
      N: 22,
      P: 68,
      K: 20,
      temperature: 27.5,
      humidity: 64.0,
      ph: 6.8,
      rainfall: 510.0,
    };

    saveActivePlan({
      input: {
        name: "Riverbend Farm",
        landArea: 4,
        water: 600,
        soilType: "Clay Loam",
        budget: 60000,
        preferredCrop: "",
        notes: "",
        mlFeatures: verifiedFeatures,
      },
      labFeatures: verifiedFeatures,
      isDemoProfile: false,
      submittedAt: "2026-04-02T10:00:00.000Z",
    });

    const reloaded = loadActivePlan();
    const dashboardSummary = deriveActivePlanSummary({ activePlan: reloaded });
    const recPageMl = generateMlPrediction(verifiedFeatures);
    const compareHybrid = derivePlanComparisonCrops({
      planInput: reloaded.input,
      labFeatures: reloaded.labFeatures,
      isDemoProfile: reloaded.isDemoProfile,
      mode: "hybrid",
    });
    const compareMl = derivePlanComparisonCrops({
      planInput: reloaded.input,
      labFeatures: reloaded.labFeatures,
      isDemoProfile: reloaded.isDemoProfile,
      mode: "ml",
    });

    assert.equal(dashboardSummary.mlComplete, true);
    assert.equal(dashboardSummary.primaryEngine, "hybrid");
    assert.equal(dashboardSummary.missingMlLabels.length, 0);
    assert.equal(dashboardSummary.primaryRecs[0].source, "HYBRID");
    assert.deepEqual(
      dashboardSummary.primaryRecs.map((r) => r.crop),
      compareHybrid.map((c) => c.crop),
    );
    assert.equal(dashboardSummary.mlRecs[0].crop, recPageMl[0].crop);
    assert.deepEqual(
      dashboardSummary.mlRecs.map((r) => r.crop),
      compareMl.map((c) => c.crop),
    );

    // Now test Demo Profile labelling consistency
    saveActivePlan({
      ...reloaded,
      isDemoProfile: true,
    });
    const demoReloaded = loadActivePlan();
    const demoDashboard = deriveActivePlanSummary({ activePlan: demoReloaded });
    const demoCompareHybrid = derivePlanComparisonCrops({
      planInput: demoReloaded.input,
      labFeatures: demoReloaded.labFeatures,
      isDemoProfile: demoReloaded.isDemoProfile,
      mode: "hybrid",
    });
    const demoCompareMl = derivePlanComparisonCrops({
      planInput: demoReloaded.input,
      labFeatures: demoReloaded.labFeatures,
      isDemoProfile: demoReloaded.isDemoProfile,
      mode: "ml",
    });

    assert.equal(demoDashboard.primaryEngine, "demo-hybrid");
    assert.equal(demoDashboard.primaryRecs[0].source, "DEMO / ILLUSTRATIVE");
    assert.equal(demoCompareHybrid[0].source, "DEMO / ILLUSTRATIVE");
    assert.equal(demoCompareMl[0].source, "DEMO / ILLUSTRATIVE");
  });
});

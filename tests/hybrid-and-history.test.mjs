import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import {
  clearActivePlan,
  deleteHistoryRecord,
  deriveActivePlanSummary,
  derivePlanComparisonCrops,
  extractMlFeaturesFromSoilParameters,
  loadActivePlan,
  loadHistory,
  saveActivePlan,
  saveHistoryEntry,
} from "@/lib/agri";
import {
  computeHybridRecommendations,
  normalizeMlCandidates,
  resolveCanonicalCropId,
} from "@/lib/hybrid-ranking";
import { predictWithLocalForest } from "@/lib/ml/forest";
import { handlePredictPost } from "@/lib/ml/predict-handler";
import { historyService } from "@/services";

function installMockWindowStorage() {
  const store = new Map();
  const listeners = new Map();
  let dispatchedEvents = [];

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
      dispatchedEvents.push(evt.type);
      const fns = listeners.get(evt.type);
      if (fns) {
        for (const fn of fns) fn(evt);
      }
      return true;
    },
  };

  if (typeof globalThis.Event === "undefined") {
    globalThis.Event = class Event {
      constructor(type) {
        this.type = type;
      }
    };
  }

  return {
    store,
    getDispatchedEvents: () => [...dispatchedEvents],
    resetDispatchedEvents: () => {
      dispatchedEvents = [];
    },
  };
}

describe("Part A — Hybrid Crop Recommendation Engine (CA-RRF)", () => {
  beforeEach(() => {
    installMockWindowStorage();
    clearActivePlan();
    delete process.env.AGRISMART_ML_API_URL;
  });

  it("1. ranks consensus crop #1 when both Rule-Based and ML sources agree, without averaging incompatible score scales", async () => {
    const features = {
      N: 90,
      P: 42,
      K: 43,
      temperature: 23.5,
      humidity: 82.0,
      ph: 6.5,
      rainfall: 225.0,
    };
    const planInput = {
      name: "Kaveri Delta Plot",
      landArea: 5,
      water: 1600,
      soilType: "Clay",
      budget: 95000,
      preferredCrop: "",
      notes: "",
      mlFeatures: features,
    };

    const apiResponse = await handlePredictPost(
      new Request("http://localhost/api/predict", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(features),
      }),
    );
    assert.equal(apiResponse.status, 200);
    const mlPrediction = await apiResponse.json();
    assert.equal(mlPrediction.crop, "rice");

    const hybrid = computeHybridRecommendations({
      planInput,
      mlFeatures: features,
      mlPrediction,
      allowLocalForestFallback: false,
    });

    assert.equal(hybrid.hybridActive, true);
    assert.equal(hybrid.mode, "hybrid");
    assert.deepEqual(hybrid.sourcesUsed, ["RULE-BASED", "ML MODEL"]);

    const top = hybrid.rankedCandidates[0];
    assert.ok(top);
    assert.equal(top.overallRank, 1);
    assert.equal(top.canonicalCropId, "rice");
    assert.equal(top.source, "HYBRID");
    assert.equal(top.hardConstraintTriggered, false);
    assert.equal(top.agreementState, "strong_agreement");

    assert.ok(top.ruleAssessment);
    assert.ok(top.mlAssessment);
    assert.equal(typeof top.ruleAssessment.compatibilityPct, "number");
    assert.equal(typeof top.mlAssessment.uncalibratedScorePct, "number");

    const topRec = hybrid.recommendations[0];
    assert.equal(topRec.suitabilityScore, top.ruleAssessment.compatibilityPct);
    assert.equal(topRec.voteSharePct, top.mlAssessment.uncalibratedScorePct);
    assert.match(top.hybridRationale, /cross-engine consensus|Supported by both/i);
  });

  it("2. handles source disagreements and hard physical constraints explicitly by demoting agronomically unviable ML picks", () => {
    const features = {
      N: 88,
      P: 44,
      K: 41,
      temperature: 26.0,
      humidity: 80.0,
      ph: 6.6,
      rainfall: 210.0,
    };
    const planInput = {
      name: "Dryland Sandy Block",
      landArea: 3,
      water: 220,
      soilType: "Sandy",
      budget: 45000,
      preferredCrop: "",
      notes: "",
      mlFeatures: features,
    };

    const mlPrediction = {
      crop: "rice",
      probability: 0.92,
      runtime: "exported-forest",
      modelVersion: "test-rf",
      ranked: [
        { crop: "rice", probability: 0.92 },
        { crop: "watermelon", probability: 0.05 },
        { crop: "mothbeans", probability: 0.03 },
      ],
    };

    const hybrid = computeHybridRecommendations({
      planInput,
      mlFeatures: features,
      mlPrediction,
      allowLocalForestFallback: false,
      config: { maxResults: 22 },
    });

    assert.equal(hybrid.hybridActive, true);
    const riceCandidate = hybrid.rankedCandidates.find((c) => c.canonicalCropId === "rice");
    assert.ok(
      riceCandidate,
      "Expected rice to remain visible with warning in expanded candidate list",
    );
    assert.equal(riceCandidate.hardConstraintTriggered, true);
    assert.equal(riceCandidate.agreementState, "ml_favored_agronomic_warning");
    assert.ok(
      riceCandidate.overallRank > 1,
      "Hard-constrained rice must be demoted below agronomically viable dryland/sandy candidates",
    );
    assert.equal(
      hybrid.rankedCandidates[0].hardConstraintTriggered,
      false,
      "Rank #1 candidate must satisfy physical soil and water constraints",
    );
    assert.match(riceCandidate.hybridRationale, /Constraint conflict|demoted/i);
  });

  it("3. falls back cleanly to Rule-Based recommendations when ML inputs are incomplete and never claims HYBRID", () => {
    const partialFeatures = {
      N: 60,
      P: 45,
      K: 40,
      temperature: 27.0,
      humidity: 65.0,
      ph: 6.7,
    };
    const planInput = {
      name: "Monsoon Pending Plot",
      landArea: 4,
      water: 650,
      soilType: "Loamy",
      budget: 70000,
      preferredCrop: "",
      notes: "",
      mlFeatures: partialFeatures,
    };

    const result = computeHybridRecommendations({
      planInput,
      mlFeatures: partialFeatures,
      localForestPredict: (f) => predictWithLocalForest(f)?.ranked ?? null,
    });

    assert.equal(result.hybridActive, false);
    assert.equal(result.mode, "rule-only");
    assert.equal(result.mlStatus, "missing_inputs");
    assert.deepEqual(result.sourcesUsed, ["RULE-BASED"]);
    assert.ok(result.missingMlLabels.some((label) => /rainfall/i.test(label)));
    assert.ok(result.recommendations.length > 0);
    for (const rec of result.recommendations) {
      assert.equal(rec.source, "RULE-BASED");
      assert.notEqual(rec.source, "HYBRID");
    }
  });

  it("4. rejects invalid / out-of-range ML inputs and never claims HYBRID", () => {
    const invalidFeatures = {
      N: 50,
      P: 40,
      K: 40,
      temperature: 26.0,
      humidity: 60.0,
      ph: 15.5,
      rainfall: 400.0,
    };
    const planInput = {
      name: "Invalid pH Sensor Plot",
      landArea: 3,
      water: 600,
      soilType: "Clay Loam",
      budget: 50000,
      preferredCrop: "",
      notes: "",
      mlFeatures: invalidFeatures,
    };

    const result = computeHybridRecommendations({
      planInput,
      mlFeatures: invalidFeatures,
      localForestPredict: (f) => predictWithLocalForest(f)?.ranked ?? null,
    });

    assert.equal(result.hybridActive, false);
    assert.equal(result.mode, "rule-only");
    assert.equal(result.mlStatus, "invalid_inputs");
    assert.deepEqual(result.sourcesUsed, ["RULE-BASED"]);
    assert.ok(result.outOfRangeMlLabels.some((label) => /ph/i.test(label)));
    for (const rec of result.recommendations) {
      assert.equal(rec.source, "RULE-BASED");
    }
  });

  it("5. never substitutes hourly weather precipitation for seasonal rainfall", () => {
    const labParams = [
      { key: "nitrogen", status: "available", value: 75 },
      { key: "phosphorus", status: "available", value: 48 },
      { key: "potassium", status: "available", value: 42 },
      { key: "ph", status: "available", value: 6.8 },
    ];
    const liveHourlyWeather = {
      temperatureC: 28.4,
      humidityPct: 71,
      rainfallMm: 12.6,
    };
    const { features: mergedFeatures } = extractMlFeaturesFromSoilParameters(
      labParams,
      liveHourlyWeather,
      null,
    );
    assert.equal(mergedFeatures.rainfall, undefined);

    const summary = deriveActivePlanSummary({
      activePlan: null,
      fallbackSoilType: "Loamy",
      fallbackLandArea: 4,
      fallbackFeatures: mergedFeatures,
      weatherTempC: liveHourlyWeather.temperatureC,
    });

    assert.equal(summary.mlComplete, false);
    assert.equal(summary.primaryEngine, "rule");
    assert.ok(summary.missingMlLabels.some((l) => /rainfall/i.test(l)));
  });

  it("6. deduplicates duplicate/alias ML crop candidates by canonical crop ID", () => {
    assert.equal(resolveCanonicalCropId("Rice (Paddy)"), "rice");
    assert.equal(resolveCanonicalCropId("paddy"), "rice");
    assert.equal(resolveCanonicalCropId("Pigeonpea (Red Gram / Arhar / Tur)"), "pigeonpeas");

    const normalized = normalizeMlCandidates(
      [
        { crop: "rice", probability: 0.31 },
        { crop: "Rice (Paddy)", probability: 0.64 },
        { crop: "paddy", probability: 0.52 },
        { crop: "maize", probability: 0.22 },
        { crop: "Maize (Corn)", probability: 0.19 },
        { crop: "unknown_fictional_crop", probability: 0.99 },
        { crop: "cotton", probability: Number.NaN },
      ],
      0.01,
    );

    assert.equal(normalized.length, 2);
    assert.deepEqual(normalized[0], { canonicalId: "rice", probability: 0.64, rank: 1 });
    assert.deepEqual(normalized[1], { canonicalId: "maize", probability: 0.22, rank: 2 });
  });

  it("7. breaks exact ordinal RRF ties deterministically", () => {
    const features = {
      N: 45,
      P: 55,
      K: 45,
      temperature: 26.0,
      humidity: 66.0,
      ph: 6.7,
      rainfall: 650.0,
    };
    const planInput = {
      name: "Tie Break Farm",
      landArea: 4,
      water: 650,
      soilType: "Loamy",
      budget: 65000,
      preferredCrop: "",
      notes: "",
      mlFeatures: features,
    };

    const ruleOnly = computeHybridRecommendations({
      planInput,
      mlFeatures: {},
      config: { maxResults: 22 },
    });
    const ruleRank1 = ruleOnly.rankedCandidates[0];
    // Pick a second viable crop with strictly lower Rule compatibilityPct, or verify ML tie-break when compatibilityPct is equal
    const ruleRank2 = ruleOnly.rankedCandidates[1];

    const mlPrediction = {
      crop: ruleRank2.canonicalCropId,
      probability: 0.55,
      runtime: "exported-forest",
      modelVersion: "tie-test",
      ranked: [
        { crop: ruleRank2.canonicalCropId, probability: 0.55 },
        { crop: ruleRank1.canonicalCropId, probability: 0.45 },
      ],
    };

    const runA = computeHybridRecommendations({
      planInput,
      mlFeatures: features,
      mlPrediction,
      allowLocalForestFallback: false,
      config: { ruleWeight: 0.5, mlWeight: 0.5, rrfK: 10 },
    });
    const runB = computeHybridRecommendations({
      planInput,
      mlFeatures: features,
      mlPrediction,
      allowLocalForestFallback: false,
      config: { ruleWeight: 0.5, mlWeight: 0.5, rrfK: 10 },
    });

    assert.deepEqual(
      runA.rankedCandidates.map((c) => c.canonicalCropId),
      runB.rankedCandidates.map((c) => c.canonicalCropId),
    );
    assert.equal(runA.rankedCandidates[0].fusionIndex, runA.rankedCandidates[1].fusionIndex);

    const expectedFirst =
      ruleRank1.ruleAssessment.compatibilityPct > ruleRank2.ruleAssessment.compatibilityPct
        ? ruleRank1.canonicalCropId
        : ruleRank2.canonicalCropId;
    assert.equal(runA.rankedCandidates[0].canonicalCropId, expectedFirst);
  });

  it("8. degrades transparently to Rule-Based recommendations when the ML prediction API fails", () => {
    const features = {
      N: 60,
      P: 50,
      K: 45,
      temperature: 26.5,
      humidity: 68.0,
      ph: 6.7,
      rainfall: 580.0,
    };
    const planInput = {
      name: "API Outage Test Farm",
      landArea: 5,
      water: 700,
      soilType: "Loamy",
      budget: 80000,
      preferredCrop: "",
      notes: "",
      mlFeatures: features,
    };

    const degraded = computeHybridRecommendations({
      planInput,
      mlFeatures: features,
      mlPrediction: null,
      mlServiceError: "Prediction service error (503)",
      allowLocalForestFallback: false,
      localForestPredict: (f) => predictWithLocalForest(f)?.ranked ?? null,
    });

    assert.equal(degraded.hybridActive, false);
    assert.equal(degraded.mode, "rule-only");
    assert.equal(degraded.mlStatus, "service_error");
    assert.match(degraded.mlStatusMessage, /503/);
    assert.deepEqual(degraded.sourcesUsed, ["RULE-BASED"]);
    assert.ok(degraded.recommendations.length > 0);
    for (const rec of degraded.recommendations) {
      assert.equal(rec.source, "RULE-BASED");
    }
  });

  it("9. produces identical hybrid rankings across Dashboard, Recommendations, and Compare Crops for the active farm plan", async () => {
    const features = {
      N: 42,
      P: 62,
      K: 52,
      temperature: 25.0,
      humidity: 63.0,
      ph: 6.8,
      rainfall: 490.0,
    };
    const planInput = {
      name: "Unified Consistency Farm",
      landArea: 6,
      water: 650,
      soilType: "Clay Loam",
      budget: 85000,
      preferredCrop: "",
      notes: "",
      mlFeatures: features,
    };

    const apiResponse = await handlePredictPost(
      new Request("http://localhost/api/predict", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(features),
      }),
    );
    const livePrediction = await apiResponse.json();

    saveActivePlan({
      input: planInput,
      labFeatures: features,
      isDemoProfile: false,
      submittedAt: "2026-04-05T08:30:00.000Z",
    });

    const activePlan = loadActivePlan();
    const dashboardSummary = deriveActivePlanSummary({
      activePlan,
      mlPrediction: livePrediction,
    });
    const recommendationsHybrid = computeHybridRecommendations({
      planInput: activePlan.input,
      mlFeatures: activePlan.labFeatures,
      mlPrediction: livePrediction,
      allowLocalForestFallback: false,
    });
    const compareHybrid = derivePlanComparisonCrops({
      planInput: activePlan.input,
      labFeatures: activePlan.labFeatures,
      isDemoProfile: activePlan.isDemoProfile,
      mode: "hybrid",
      mlPrediction: livePrediction,
    });

    assert.equal(dashboardSummary.primaryEngine, "hybrid");
    assert.equal(recommendationsHybrid.mode, "hybrid");
    assert.deepEqual(
      dashboardSummary.primaryRecs.map((r) => r.crop),
      recommendationsHybrid.recommendations.map((r) => r.crop),
    );
    assert.deepEqual(
      dashboardSummary.primaryRecs.map((r) => r.crop),
      compareHybrid.map((c) => c.crop),
    );
    assert.deepEqual(
      dashboardSummary.primaryRecs.map((r) => r.overallRank),
      compareHybrid.map((c) => c.overallRank),
    );
  });
});

describe("Part B — Individual History Deletion & Storage Integrity", () => {
  let harness;

  beforeEach(() => {
    harness = installMockWindowStorage();
  });

  function makeEntry(id, name, createdAt) {
    return {
      id,
      createdAt,
      input: {
        name,
        landArea: 4,
        water: 600,
        soilType: "Loamy",
        budget: 50000,
        preferredCrop: "",
        notes: "",
      },
      recommendations: [
        {
          crop: "Maize (Corn)",
          source: "HYBRID",
          overallRank: 1,
          confidence: 88,
          ruleScorePct: 88,
          mlScorePct: 74,
          rationale: "Balanced hybrid recommendation.",
        },
      ],
    };
  }

  it("1. deletes only the selected history record while preserving all other records in exact order", async () => {
    const user = { id: "user-101", email: "farmer@agrismart.example", fullName: "Ramesh" };
    historyService.save(makeEntry("h-3", "South Orchard", "2026-04-01T09:00:00.000Z"), user);
    historyService.save(makeEntry("h-2", "Middle Paddy Field", "2026-04-02T09:00:00.000Z"), user);
    historyService.save(makeEntry("h-1", "North Canal Plot", "2026-04-03T09:00:00.000Z"), user);

    assert.deepEqual(
      historyService.list().map((e) => e.id),
      ["h-1", "h-2", "h-3"],
    );

    const result = await historyService.deleteRecord("h-2", user);
    assert.equal(result.ok, true);
    assert.deepEqual(
      result.remaining.map((e) => e.id),
      ["h-1", "h-3"],
    );

    const persisted = JSON.parse(globalThis.window.localStorage.getItem("agrismart.history"));
    assert.deepEqual(
      persisted.map((e) => e.id),
      ["h-1", "h-3"],
    );
    assert.equal(persisted[0].input.name, "North Canal Plot");
    assert.equal(persisted[1].input.name, "South Orchard");
  });

  it("2. returns an error without mutating remaining records when deleting a non-existent ID", async () => {
    const user = { id: "user-101", email: "farmer@agrismart.example" };
    saveHistoryEntry(makeEntry("h-b", "Plot B", "2026-04-01T10:00:00.000Z"), user);
    saveHistoryEntry(makeEntry("h-a", "Plot A", "2026-04-02T10:00:00.000Z"), user);
    harness.resetDispatchedEvents();

    const res = await historyService.deleteRecord("non-existent-id", user);
    assert.equal(res.ok, false);
    assert.match(res.error ?? "", /no longer exists|not found/i);
    assert.deepEqual(
      loadHistory().map((e) => e.id),
      ["h-a", "h-b"],
    );
    assert.equal(harness.getDispatchedEvents().includes("agrismart:history"), false);
  });

  it("3. does not falsely report success or dispatch sync events when localStorage write fails", () => {
    const user = { id: "user-101", email: "farmer@agrismart.example" };
    saveHistoryEntry(makeEntry("h-2", "Plot 2", "2026-04-01T10:00:00.000Z"), user);
    saveHistoryEntry(makeEntry("h-1", "Plot 1", "2026-04-02T10:00:00.000Z"), user);
    harness.resetDispatchedEvents();

    const originalSetItem = globalThis.window.localStorage.setItem;
    globalThis.window.localStorage.setItem = () => {
      throw new Error("QuotaExceededError: storage write blocked");
    };

    try {
      const res = deleteHistoryRecord("h-1", user);
      assert.equal(res.ok, false);
      assert.match(res.error ?? "", /QuotaExceededError|Failed to update/i);
      assert.deepEqual(
        res.remaining.map((e) => e.id),
        ["h-1", "h-2"],
      );
      assert.equal(harness.getDispatchedEvents().includes("agrismart:history"), false);
      assert.deepEqual(
        loadHistory().map((e) => e.id),
        ["h-1", "h-2"],
      );
    } finally {
      globalThis.window.localStorage.setItem = originalSetItem;
    }
  });

  it("4. enforces record ownership when ownerKey is recorded on a history entry", async () => {
    const ownerUser = { id: "owner-1", email: "owner@agrismart.example" };
    const otherUser = { id: "intruder-2", email: "other@agrismart.example" };

    historyService.save(
      makeEntry("owned-1", "Owner Private Plot", "2026-04-03T12:00:00.000Z"),
      ownerUser,
    );

    const denied = await historyService.deleteRecord("owned-1", otherUser);
    assert.equal(denied.ok, false);
    assert.match(denied.error ?? "", /different user|cannot delete/i);
    assert.equal(historyService.list().length, 1);

    const allowed = await historyService.deleteRecord("owned-1", ownerUser);
    assert.equal(allowed.ok, true);
    assert.equal(historyService.list().length, 0);
  });
});

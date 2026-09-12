import type {
  Appointment,
  CultivationStage,
  Farm,
  MlEvaluation,
  Notification,
  Provider,
  RecommendationResult,
  SoilReport,
  Weather,
} from "./types";

/**
 * DEMO ADAPTER DATA.
 * Everything exported here is clearly-labelled placeholder data used until real
 * APIs are wired in. Never present it to the user without a "Demo data" marker.
 */

export const demoFarm: Farm = {
  id: "farm-demo-1",
  name: "Demo Farm",
  ownerName: "Farmer",
  location: "Demo village, Demo mandal",
  district: "Demo district",
  landAreaAcres: 5,
  currentCrop: "Groundnut",
  irrigation: "Borewell",
};

export const demoWeather: Weather = {
  temperatureC: 29,
  humidityPct: 68,
  rainfallMm: 4,
  condition: "Partly cloudy",
  observedAt: new Date().toISOString(),
  forecast: [
    { day: "Tomorrow", condition: "Light rain", maxC: 30, minC: 23 },
    { day: "Day 3", condition: "Cloudy", maxC: 31, minC: 24 },
    { day: "Day 4", condition: "Sunny", maxC: 33, minC: 24 },
  ],
};

export const demoProviders: Provider[] = [
  {
    id: "provider-demo-1",
    name: "Demo Soil Testing Centre A",
    type: "Government laboratory",
    distanceKm: 6.2,
    address: "Demo address, Demo town",
    phone: null,
    verified: true,
    acceptingSamples: true,
    services: ["Soil sampling guidance", "Macro nutrient panel", "Soil health card"],
    testTypes: ["N-P-K", "pH", "EC", "Organic carbon"],
    openingHours: "Mon–Sat, 09:00–17:00",
    reportTimeDays: 5,
    lat: 17.42,
    lng: 78.45,
  },
  {
    id: "provider-demo-2",
    name: "Demo Agri Lab B",
    type: "Private laboratory",
    distanceKm: 12.8,
    address: "Demo address, Demo city",
    phone: null,
    verified: false,
    acceptingSamples: true,
    services: ["Doorstep sample collection", "Micro nutrient panel"],
    testTypes: ["N-P-K", "pH", "Micronutrients"],
    openingHours: "Mon–Fri, 10:00–18:00",
    reportTimeDays: 3,
    lat: 17.46,
    lng: 78.39,
  },
  {
    id: "provider-demo-3",
    name: "Demo Krishi Vigyan Centre C",
    type: "Extension centre",
    distanceKm: 21.4,
    address: "Demo address, Demo district",
    phone: null,
    verified: true,
    acceptingSamples: false,
    services: ["Advisory", "Sample drop-off"],
    testTypes: ["pH", "EC"],
    openingHours: "Mon–Sat, 10:00–16:00",
    reportTimeDays: null,
    lat: 17.36,
    lng: 78.52,
  },
];

export const demoAppointments: Appointment[] = [
  {
    id: "appt-demo-1",
    providerId: "provider-demo-1",
    providerName: "Demo Soil Testing Centre A",
    method: "sample_collection",
    date: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10),
    time: "10:30",
    farmName: "Demo Farm",
    notes: "Field near the canal.",
    status: "confirmed",
    history: [
      { status: "booked", at: new Date(Date.now() - 2 * 864e5).toISOString() },
      { status: "confirmed", at: new Date(Date.now() - 1 * 864e5).toISOString() },
    ],
  },
];

export const demoReports: SoilReport[] = [
  {
    id: "report-demo-1",
    laboratory: "Demo Soil Testing Centre A",
    sampleId: "DEMO-SMP-0001",
    testDate: new Date(Date.now() - 20 * 864e5).toISOString().slice(0, 10),
    verified: true,
    status: "ready",
    parameters: [
      { key: "n", label: "Nitrogen", status: "available", value: 268, unit: "kg/ha", rating: "low" },
      { key: "p", label: "Phosphorus", status: "available", value: 24, unit: "kg/ha", rating: "optimal" },
      { key: "k", label: "Potassium", status: "available", value: 190, unit: "kg/ha", rating: "optimal" },
      { key: "ph", label: "pH", status: "available", value: 6.8, unit: null, rating: "optimal" },
      { key: "ec", label: "Electrical conductivity", status: "not_tested", value: null, unit: "dS/m" },
      { key: "oc", label: "Organic carbon", status: "not_tested", value: null, unit: "%" },
    ],
  },
];

export const demoRecommendation: RecommendationResult = {
  top: {
    crop: "Maize",
    confidencePct: 92,
    suitability: "High",
    waterRequirement: "Medium (500–600 mm)",
    growthDurationDays: 110,
    complexity: "Moderate",
    weatherSuitability: "High",
    soilSuitability: "High",
  },
  alternatives: [
    {
      crop: "Soybean",
      confidencePct: 81,
      suitability: "Medium",
      waterRequirement: "Medium (450–550 mm)",
      growthDurationDays: 95,
      complexity: "Moderate",
      weatherSuitability: "Medium",
      soilSuitability: "High",
    },
    {
      crop: "Groundnut",
      confidencePct: 74,
      suitability: "Medium",
      waterRequirement: "Low (400–500 mm)",
      growthDurationDays: 120,
      complexity: "Low",
      weatherSuitability: "Medium",
      soilSuitability: "Medium",
    },
  ],
  dataCompletenessPct: 78,
  reliability: "Moderate",
  explanation:
    "Based on the available soil, weather and farm conditions, this crop matched the observed rainfall and temperature range while staying within the nutrient levels reported for your field.",
  factors: [
    { feature: "Rainfall", contribution: 0.32 },
    { feature: "Temperature", contribution: 0.27 },
    { feature: "Humidity", contribution: 0.18 },
    { feature: "Soil pH", contribution: 0.14 },
    { feature: "Nutrient status", contribution: 0.09 },
  ],
  dataUsed: ["Rainfall", "Temperature", "Humidity", "Soil pH", "Nitrogen", "Phosphorus", "Potassium"],
  dataMissing: ["Soil organic carbon not tested", "Electrical conductivity not tested"],
};

export const demoCultivation = (crop: string): CultivationStage[] => {
  const stages: Omit<CultivationStage, "index">[] = [
    {
      title: "Land preparation",
      what: `Plough to a fine tilth and level the field before sowing ${crop}.`,
      when: "2–3 weeks before sowing",
      why: "A level, well-aerated seedbed improves germination and water distribution.",
      caution: "Avoid working the soil when it is waterlogged — it causes compaction.",
    },
    {
      title: "Seed selection",
      what: "Choose a certified variety suited to your season and soil.",
      when: "1–2 weeks before sowing",
      why: "Certified seed gives predictable germination and disease tolerance.",
      caution: "Do not reuse saved hybrid seed; yields drop sharply.",
    },
    {
      title: "Sowing",
      what: "Sow at the recommended depth and row spacing for your variety.",
      when: "At the start of the sowing window for your region",
      why: "Correct spacing sets plant population, the biggest driver of yield.",
      caution: "Sowing too deep delays emergence.",
    },
    {
      title: "Early growth",
      what: "Check emergence, gap-fill and thin overcrowded spots.",
      when: "7–20 days after sowing",
      why: "Uniform stands avoid competition and patchy maturity.",
      caution: "Do not apply heavy irrigation on very young seedlings.",
    },
    {
      title: "Irrigation",
      what: "Irrigate at the critical moisture stages for the crop.",
      when: "Through the season, based on rainfall",
      why: "Water stress at flowering causes the largest yield loss.",
      caution: "Avoid standing water; most field crops do not tolerate it.",
    },
    {
      title: "Nutrient management",
      what: "Split-apply nutrients according to your soil report.",
      when: "Basal dose plus 1–2 top dressings",
      why: "Split doses reduce loss and match crop demand.",
      caution: "Do not guess doses without a soil report — book a soil test first.",
    },
    {
      title: "Weed management",
      what: "Keep the field weed-free during the early critical period.",
      when: "15–45 days after sowing",
      why: "Weeds compete hardest for nutrients while the crop canopy is open.",
      caution: "Follow label rates and waiting periods for any herbicide.",
    },
    {
      title: "Pest / disease monitoring",
      what: "Scout the field weekly and record what you find.",
      when: "Weekly, whole season",
      why: "Early detection keeps control cheap and effective.",
      caution: "Avoid calendar spraying; treat only on observed thresholds.",
    },
    {
      title: "Harvest",
      what: "Harvest at physiological maturity and dry to safe moisture.",
      when: "End of season",
      why: "Correct timing protects grain quality and market price.",
      caution: "Delayed harvest raises shattering and pest damage risk.",
    },
  ];
  return stages.map((s, i) => ({ ...s, index: i + 1 }));
};

export const demoMlEvaluation: MlEvaluation = {
  benchmarks: [
    { model: "Random Forest", accuracy: 0.94, precision: 0.93, recall: 0.94, macroF1: 0.93, crossValidation: 0.92 },
    { model: "Gradient Boosting", accuracy: 0.93, precision: 0.92, recall: 0.92, macroF1: 0.92, crossValidation: 0.91 },
    { model: "SVM", accuracy: 0.9, precision: 0.89, recall: 0.9, macroF1: 0.89, crossValidation: 0.88 },
    { model: "Decision Tree", accuracy: 0.87, precision: 0.86, recall: 0.87, macroF1: 0.86, crossValidation: 0.84 },
    { model: "KNN", accuracy: 0.85, precision: 0.84, recall: 0.85, macroF1: 0.84, crossValidation: 0.83 },
    { model: "Logistic Regression", accuracy: 0.82, precision: 0.81, recall: 0.82, macroF1: 0.81, crossValidation: 0.8 },
  ],
  classes: ["Maize", "Rice", "Soybean", "Groundnut"],
  confusionMatrix: [
    [42, 2, 1, 1],
    [3, 39, 2, 1],
    [1, 2, 40, 3],
    [2, 1, 3, 38],
  ],
  featureImportance: [
    { feature: "Rainfall", importance: 0.26 },
    { feature: "Temperature", importance: 0.21 },
    { feature: "Humidity", importance: 0.16 },
    { feature: "pH", importance: 0.14 },
    { feature: "Nitrogen", importance: 0.09 },
    { feature: "Potassium", importance: 0.08 },
    { feature: "Phosphorus", importance: 0.06 },
  ],
  shap: [
    { feature: "Rainfall", value: 0.31 },
    { feature: "Temperature", value: 0.22 },
    { feature: "Humidity", value: -0.12 },
    { feature: "pH", value: 0.1 },
    { feature: "Nitrogen", value: -0.06 },
  ],
  lime: [
    { feature: "Rainfall > 800mm", weight: 0.28 },
    { feature: "Temp 24–30°C", weight: 0.19 },
    { feature: "pH 6.5–7.2", weight: 0.12 },
    { feature: "Humidity < 70%", weight: -0.09 },
    { feature: "N low", weight: -0.05 },
  ],
  missingDataExperiment: [
    { scenario: "Complete data", accuracy: 0.94, macroF1: 0.93 },
    { scenario: "Missing NPK", accuracy: 0.88, macroF1: 0.86 },
    { scenario: "Missing pH", accuracy: 0.91, macroF1: 0.9 },
    { scenario: "Missing all soil data", accuracy: 0.79, macroF1: 0.76 },
  ],
};

export const demoNotifications: Notification[] = [
  {
    id: "n1",
    title: "Soil test appointment confirmed",
    body: "Demo Soil Testing Centre A confirmed your sample collection.",
    at: new Date(Date.now() - 36e5).toISOString(),
    read: false,
  },
  {
    id: "n2",
    title: "Rain expected tomorrow",
    body: "Light rain is forecast for your area — plan field work accordingly.",
    at: new Date(Date.now() - 9 * 36e5).toISOString(),
    read: true,
  },
];

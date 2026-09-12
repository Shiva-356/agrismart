/** "artifact" = real results/model produced by the ml/ pipeline and shipped with the app. */
export type DataSource = "demo" | "api" | "artifact";

export type CropPrediction = {
  crop: string;
  ranked: { crop: string; probability: number }[];
  model: string | null;
  runtime: "fastapi" | "exported-forest";
  treeCount?: number;
  note?: string;
};

export type Envelope<T> = {
  data: T;
  source: DataSource;
  fetchedAt: string;
};

export type Farm = {
  id: string;
  name: string;
  ownerName: string;
  location: string;
  district: string;
  landAreaAcres: number;
  currentCrop: string | null;
  irrigation: string;
};

export type Weather = {
  temperatureC: number | null;
  humidityPct: number | null;
  rainfallMm: number | null;
  condition: string | null;
  observedAt: string;
  forecast: { day: string; condition: string; maxC: number | null; minC: number | null }[];
};

export type ParameterStatus = "available" | "not_tested" | "not_available";

export type SoilParameter = {
  key: string;
  label: string;
  status: ParameterStatus;
  value: number | null;
  unit: string | null;
  rating?: "low" | "optimal" | "high" | null;
};

export type SoilStatus = {
  hasReport: boolean;
  latestReportId: string | null;
  parameters: SoilParameter[];
};

export type Provider = {
  id: string;
  name: string;
  type: string;
  distanceKm: number | null;
  address: string;
  phone: string | null;
  verified: boolean;
  acceptingSamples: boolean;
  services: string[];
  testTypes: string[];
  openingHours: string | null;
  reportTimeDays: number | null;
  lat: number;
  lng: number;
};

export type AppointmentStatus =
  | "booked"
  | "confirmed"
  | "sample_collected"
  | "testing"
  | "report_ready"
  | "completed";

export type Appointment = {
  id: string;
  providerId: string;
  providerName: string;
  method: "lab_visit" | "sample_collection";
  date: string;
  time: string;
  farmName: string;
  notes: string;
  status: AppointmentStatus;
  history: { status: AppointmentStatus; at: string }[];
};

export type SoilReport = {
  id: string;
  laboratory: string;
  sampleId: string;
  testDate: string;
  verified: boolean;
  status: "ready" | "pending";
  parameters: SoilParameter[];
};

export type FeatureContribution = { feature: string; contribution: number };

export type CropRecommendation = {
  crop: string;
  confidencePct: number | null;
  suitability: string;
  waterRequirement: string | null;
  growthDurationDays: number | null;
  complexity: string | null;
  weatherSuitability: string | null;
  soilSuitability: string | null;
};

export type RecommendationResult = {
  top: CropRecommendation;
  alternatives: CropRecommendation[];
  dataCompletenessPct: number | null;
  reliability: "High" | "Moderate" | "Low" | null;
  explanation: string;
  factors: FeatureContribution[];
  dataUsed: string[];
  dataMissing: string[];
};

export type CultivationStage = {
  index: number;
  title: string;
  what: string;
  when: string;
  why: string;
  caution: string;
};

export type ModelBenchmark = {
  model: string;
  accuracy: number;
  precision: number;
  recall: number;
  macroF1: number;
  crossValidation: number;
  /** Std-dev of the CV score. Only set when the artifact reports it. */
  crossValidationStd?: number | null;
};

/** Dataset provenance. Every field is nullable — nothing is inferred. */
export type DatasetMeta = {
  name: string | null;
  source: string | null;
  samples: number | null;
  classCount: number | null;
  features: string[];
  split: string | null;
  crossValidation: string | null;
  license: string | null;
  evaluatedAt: string | null;
};

export type PerClassMetric = {
  className: string;
  precision: number | null;
  recall: number | null;
  f1: number | null;
  support: number | null;
};

export type AblationResult = {
  featureSet: string;
  accuracy: number | null;
  macroF1: number | null;
  crossValidation: number | null;
};

export type TuningResult = {
  model: string;
  parametersEvaluated: string[];
  bestParams: Record<string, string | number>;
  bestCvScore: number | null;
};

export type MlEvaluation = {
  /** Present only when the evaluation artifact carries dataset metadata. */
  dataset?: DatasetMeta;
  /** Present only when a classification report artifact exists. */
  perClass?: PerClassMetric[];
  /** Present only when feature-subset experiments were actually run. */
  ablation?: AblationResult[];
  /** Present only when hyperparameter search results were stored. */
  tuning?: TuningResult[];
  /** Present only when permutation importance was computed. */
  permutationImportance?: { feature: string; importance: number }[];
  benchmarks: ModelBenchmark[];
  classes: string[];
  confusionMatrix: number[][];
  featureImportance: { feature: string; importance: number }[];
  shap: { feature: string; value: number }[];
  lime: { feature: string; weight: number }[];
  missingDataExperiment: { scenario: string; accuracy: number; macroF1: number }[];
};

export type Notification = {
  id: string;
  title: string;
  body: string;
  at: string;
  read: boolean;
};

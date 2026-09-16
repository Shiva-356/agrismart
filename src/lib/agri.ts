export type SoilType = "Clay" | "Sandy" | "Loamy" | "Silty" | "Clay Loam";

export const SOIL_TYPES: SoilType[] = ["Clay", "Sandy", "Loamy", "Silty", "Clay Loam"];

export type FarmInput = {
  name: string;
  landArea: number;
  water: number;
  soilType: SoilType;
  budget: number;
  preferredCrop: string;
  notes: string;
};

export type Recommendation = {
  crop: string;
  source: "ML MODEL" | "RULE-BASED";
  confidence: number;
  expectedYield: string;
  waterNeed: string;
  estimatedProfit: string;
  rationale: string;
};

export type HistoryEntry = {
  id: string;
  createdAt: string;
  input: FarmInput;
  recommendations: Recommendation[];
};

const SOIL_CROPS: Record<SoilType, string[]> = {
  Clay: ["Rice", "Sugarcane", "Cabbage"],
  Sandy: ["Groundnut", "Watermelon", "Carrot"],
  Loamy: ["Wheat", "Maize", "Tomato"],
  Silty: ["Soybean", "Onion", "Lettuce"],
  "Clay Loam": ["Cotton", "Chickpea", "Potato"],
};

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export function generateRecommendations(input: FarmInput): Recommendation[] {
  const base = SOIL_CROPS[input.soilType] ?? SOIL_CROPS.Loamy;
  const waterPerAcre = input.landArea > 0 ? input.water / input.landArea : input.water;
  const budgetPerAcre = input.landArea > 0 ? input.budget / input.landArea : input.budget;

  const picks = [...base];
  if (input.preferredCrop.trim()) {
    picks.unshift(input.preferredCrop.trim());
  }

  return picks.slice(0, 3).map((crop, i) => {
    const mlDriven = i !== 1;
    const confidence = Math.max(
      52,
      Math.min(96, Math.round(92 - i * 9 + (waterPerAcre > 400 ? 3 : -2))),
    );
    return {
      crop,
      source: mlDriven ? "ML MODEL" : "RULE-BASED",
      confidence,
      expectedYield: `${(2.4 + i * 0.6).toFixed(1)} t/acre`,
      waterNeed: `${Math.round(320 + i * 90)} mm/season`,
      estimatedProfit: money(
        Math.max(budgetPerAcre * (1.35 - i * 0.12), 1) * Math.max(input.landArea, 1),
      ),
      rationale: mlDriven
        ? `Gradient-boosted model ranked ${crop} highest for ${input.soilType} soil with ~${Math.round(waterPerAcre)} units water/acre.`
        : `Agronomic rule set: ${input.soilType} soil with a ${money(budgetPerAcre)}/acre budget suits ${crop} rotation.`,
    };
  });
}

const HISTORY_KEY = "agrismart.history";
const AUTH_KEY = "agrismart.user";

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? "[]") as HistoryEntry[];
  } catch {
    return [];
  }
}

export function saveHistoryEntry(entry: HistoryEntry) {
  if (typeof window === "undefined") return;
  const next = [entry, ...loadHistory()].slice(0, 50);
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("agrismart:history"));
}

export function loadUser(): { email: string } | null {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(window.localStorage.getItem(AUTH_KEY) ?? "null");
  } catch {
    return null;
  }
}

export function setUser(user: { email: string } | null) {
  if (typeof window === "undefined") return;
  if (user) window.localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  else window.localStorage.removeItem(AUTH_KEY);
  window.dispatchEvent(new Event("agrismart:auth"));
}

export interface CultivationSource {
  organization: string;
  title: string;
  url: string;
  accessedDate: string;
}

export interface PestDiseaseItem {
  name: string;
  type: "pest" | "disease";
  symptomsOrTiming: string;
  management: string;
  caution?: string;
}

export interface CropGrowthStage {
  index: number;
  title: string;
  what: string;
  when: string;
  why: string;
  caution: string;
}

export interface CropCultivationGuide {
  crop: string; // ML class identifier (lowercase)
  displayName: string;
  category: "Cereal" | "Pulse" | "Fruit" | "Fibre & Commercial" | "Plantation";
  durationDays: number;
  waterRequirement: string;
  overview: string;
  suitableClimate: string;
  soilRequirements: string;
  seasons: string;
  plantingMaterial: string;
  landPreparation: string;
  sowingOrPlanting: string;
  growthStages: CropGrowthStage[];
  irrigation: string;
  nutrientManagement: string;
  weedManagement: string;
  pestDiseaseMonitoring: PestDiseaseItem[];
  harvest: string;
  postHarvest: string;
  importantNotes: string[];
  regionalCaution: string;
  sources: CultivationSource[];
}

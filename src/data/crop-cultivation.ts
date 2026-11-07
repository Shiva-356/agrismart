import type { CropCultivationGuide } from "./crops/types";
import { cerealsGuides } from "./crops/cereals";
import { pulsesGuides } from "./crops/pulses";
import { fruitsGuides } from "./crops/fruits";
import { commercialGuides } from "./crops/commercial";

export * from "./crops/types";

/**
 * Complete, authoritative cultivation knowledge base for all 22 ML crop classes.
 * Covers: apple, banana, blackgram, chickpea, coconut, coffee, cotton, grapes, jute,
 * kidneybeans, lentil, maize, mango, mothbeans, mungbean, muskmelon, orange, papaya,
 * pigeonpeas, pomegranate, rice, watermelon.
 *
 * Notice: Soybean and groundnut are strictly excluded as they are not ML classes.
 */
export const CROP_CULTIVATION_DATABASE: Record<string, CropCultivationGuide> = {
  ...cerealsGuides,
  ...pulsesGuides,
  ...fruitsGuides,
  ...commercialGuides,
};

export const ALL_ML_CROPS: string[] = [
  "apple",
  "banana",
  "blackgram",
  "chickpea",
  "coconut",
  "coffee",
  "cotton",
  "grapes",
  "jute",
  "kidneybeans",
  "lentil",
  "maize",
  "mango",
  "mothbeans",
  "mungbean",
  "muskmelon",
  "orange",
  "papaya",
  "pigeonpeas",
  "pomegranate",
  "rice",
  "watermelon",
];

export const ALL_CULTIVATION_GUIDES: CropCultivationGuide[] = ALL_ML_CROPS.map(
  (id) => CROP_CULTIVATION_DATABASE[id]!,
);

/**
 * Resolves a crop cultivation guide by id or common name (case-insensitive).
 * Returns null if the crop is not part of the 22 supported ML classes.
 */
export function getCropCultivationGuide(cropNameOrId: string): CropCultivationGuide | null {
  if (!cropNameOrId) return null;

  const aliasMap: Record<string, string> = {
    paddy: "rice",
    chana: "chickpea",
    chickpeas: "chickpea",
    bengalgram: "chickpea",
    arhar: "pigeonpeas",
    tur: "pigeonpeas",
    redgram: "pigeonpeas",
    pigeonpea: "pigeonpeas",
    urad: "blackgram",
    uradbean: "blackgram",
    blackgrams: "blackgram",
    moong: "mungbean",
    mungbeans: "mungbean",
    greengram: "mungbean",
    matki: "mothbeans",
    mothbean: "mothbeans",
    masoor: "lentil",
    lentils: "lentil",
    rajma: "kidneybeans",
    rajmash: "kidneybeans",
    kidneybean: "kidneybeans",
    corn: "maize",
    cantaloupe: "muskmelon",
    kharbooja: "muskmelon",
    kharbooza: "muskmelon",
    santra: "orange",
    mandarin: "orange",
    anar: "pomegranate",
    tarbooz: "watermelon",
    kapas: "cotton",
    pat: "jute",
    grape: "grapes",
  };

  const candidates = [cropNameOrId, cropNameOrId.split("(")[0] ?? ""];
  for (const raw of candidates) {
    const normalized = raw
      .trim()
      .toLowerCase()
      .replace(/[^a-z]/g, "");
    if (!normalized) continue;

    if (CROP_CULTIVATION_DATABASE[normalized]) {
      return CROP_CULTIVATION_DATABASE[normalized];
    }

    const mapped = aliasMap[normalized];
    if (mapped && CROP_CULTIVATION_DATABASE[mapped]) {
      return CROP_CULTIVATION_DATABASE[mapped];
    }

    const byDisplay = ALL_CULTIVATION_GUIDES.find(
      (g) => g.displayName.toLowerCase().replace(/[^a-z]/g, "") === normalized,
    );
    if (byDisplay) {
      return byDisplay;
    }
  }

  return null;
}

/**
 * Returns the canonical URL slug for `/cultivation/$crop` for any crop id or display name.
 */
export function getCropGuideSlug(cropNameOrId: string): string {
  const guide = getCropCultivationGuide(cropNameOrId);
  if (guide) return guide.crop;
  return (
    (cropNameOrId.split("(")[0] ?? cropNameOrId)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "") || cropNameOrId.toLowerCase()
  );
}

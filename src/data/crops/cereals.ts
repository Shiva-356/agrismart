import type { CropCultivationGuide } from "./types";

export const cerealsGuides: Record<"rice" | "maize", CropCultivationGuide> = {
  rice: {
    crop: "rice",
    displayName: "Rice (Paddy)",
    category: "Cereal",
    durationDays: 130,
    waterRequirement: "High (1100–1400 mm)",
    overview:
      "Rice (Oryza sativa) is the staple food grain of India, grown predominantly under irrigated transplanted or direct-seeded lowland and upland ecologies.",
    suitableClimate:
      "Warm, humid tropical/subtropical climate with daytime temperatures of 25–35°C. Prolonged sunshine during ripening promotes high grain yield.",
    soilRequirements:
      "Heavy clay loam or clay soils with high water retention capacity and slightly acidic to neutral pH (5.5–7.2).",
    seasons:
      "Kharif (June–November), Rabi/Boro (November–April), and Summer across different agro-climatic zones of India.",
    plantingMaterial:
      "Certified seed of HYVs or hybrids (e.g., MTU 1010, BPT 5204, Swarna, IR 64). Seed rate: 20–25 kg/ha for transplanted paddy, 40–50 kg/ha for direct-seeded.",
    landPreparation:
      "Puddle the field thoroughly 2–3 times followed by perfect leveling to ensure uniform standing water depth and reduce percolation loss.",
    sowingOrPlanting:
      "Raise nursery for 21–25 days. Transplant 2–3 seedlings per hill at 20 cm × 15 cm or 15 cm × 15 cm spacing at a shallow depth of 2–3 cm.",
    growthStages: [
      {
        index: 1,
        title: "Nursery & Seedling Establishment",
        what: "Treat seeds with Carbendazim (2g/kg seed) or Pseudomonas fluorescens (10g/kg). Maintain thin water film in nursery.",
        when: "Days 1–25 from seed soaking",
        why: "Robust, disease-free seedlings establish faster after transplanting shock.",
        caution:
          "Avoid overgrown seedlings (>30 days old) as tillering capacity drops drastically.",
      },
      {
        index: 2,
        title: "Tillering & Vegetative Phase",
        what: "Maintain 2–3 cm shallow water depth. Apply first split of nitrogenous fertilizer.",
        when: "Days 20–45 after transplanting (DAT)",
        why: "Maximum tillering stage determines panicle density per square meter.",
        caution: "Do not submerge seedlings deeply; excessive water impedes productive tillering.",
      },
      {
        index: 3,
        title: "Panicle Initiation & Stem Elongation",
        what: "Apply second top dressing of nitrogen and potassium. Maintain 5 cm water.",
        when: "Days 45–65 DAT",
        why: "Pollen mother cell formation and spikelet count per panicle are fixed during this stage.",
        caution: "Water stress during panicle initiation leads to high spikelet sterility.",
      },
      {
        index: 4,
        title: "Heading & Flowering",
        what: "Maintain continuous 3–5 cm water layer. Monitor for sheath blight and stem borer.",
        when: "Days 65–85 DAT",
        why: "Flowering requires steady moisture and moderate temperature to prevent floral abortion.",
        caution:
          "Do not apply chemical pesticide sprays during morning peak anthesis (9 AM–11 AM).",
      },
      {
        index: 5,
        title: "Grain Filling & Milk Stage",
        what: "Adopt alternate wetting and drying (AWD) with cyclic shallow irrigation.",
        when: "Days 85–110 DAT",
        why: "Starch translocates from flag leaves and stems into developing endosperm.",
        caution: "Avoid complete desiccation before dough stage to prevent chalky grain formation.",
      },
      {
        index: 6,
        title: "Physiological Maturity & Harvest",
        what: "Drain water 7–10 days before harvest. Harvest when 80–85% of grains turn golden yellow.",
        when: "Days 115–135 DAT",
        why: "Optimal moisture content (20–22%) prevents shattering and milling breakages.",
        caution:
          "Delayed harvest under hot sun causes grain cracking and lower head rice recovery.",
      },
    ],
    irrigation:
      "Maintain shallow water (2–3 cm) until panicle initiation, then 5 cm until hard dough. Alternate Wetting and Drying (AWD) saves 25–30% water without yield reduction.",
    nutrientManagement:
      "Follow soil-test-based nutrient recommendations and locally recommended crop practices. Standard guideline: N:P2O5:K2O @ 100-120:50-60:50-60 kg/ha in 3 split doses of Nitrogen.",
    weedManagement:
      "Pre-emergence application of Pretilachlor @ 0.75 kg a.i./ha within 3–5 DAT or hand weeding at 20 and 40 DAT.",
    pestDiseaseMonitoring: [
      {
        name: "Yellow Stem Borer (Scirpophaga incertulas)",
        type: "pest",
        symptomsOrTiming: "Dead hearts in vegetative stage; White ears at flowering.",
        management:
          "Install pheromone traps @ 5/ha; spray Chlorantraniliprole 18.5% SC @ 0.3 ml/L on threshold (1 egg mass/m2).",
      },
      {
        name: "Blast (Magnaporthe oryzae)",
        type: "disease",
        symptomsOrTiming: "Spindle-shaped lesions with ash-colored centers on leaves or neck rot.",
        management:
          "Avoid excessive nitrogen; spray Tricyclazole 75% WP @ 0.6 g/L on initial symptom appearance.",
      },
    ],
    harvest:
      "Harvest crop when 85% grains turn straw yellow and grain moisture is around 20–22%. Thresh promptly.",
    postHarvest:
      "Sun dry paddy on tarpaulin to bring moisture down to 12–14% before bagging and safe storage to prevent fungal rot and grain moth.",
    importantNotes: [
      "Zinc deficiency is common in submerged soils; apply Zinc Sulphate @ 25 kg/ha basal or foliar spray 0.5% ZnSO4.",
      "Green manuring with Dhaincha (Sesbania) prior to paddy transplantation enriches organic carbon and saves 25% inorganic N.",
    ],
    regionalCaution:
      "Fertilizer dose, nursery timing, and water requirement vary significantly between coastal deltas, borewell irrigated zones, and rainfed uplands. Follow SAU recommendations.",
    sources: [
      {
        organization: "ICAR - Indian Institute of Rice Research (IIRR)",
        title: "Standard Package of Practices for Rice Cultivation",
        url: "https://www.icar-iirr.org",
        accessedDate: "2026-09-15",
      },
      {
        organization: "TNAU Agritech Portal",
        title: "Crop Production Guide: Paddy",
        url: "https://agritech.tnau.ac.in/agriculture/agri_crop_production_cereals_paddy.html",
        accessedDate: "2026-09-15",
      },
    ],
  },

  maize: {
    crop: "maize",
    displayName: "Maize (Corn)",
    category: "Cereal",
    durationDays: 105,
    waterRequirement: "Medium (500–650 mm)",
    overview:
      "Maize (Zea mays) is an efficient C4 cereal crop grown for grain, feed, silage, and industrial starch with high yield responsiveness to fertility and moisture.",
    suitableClimate:
      "Warm temperate to tropical climates with 21–30°C daytime temperature. Susceptible to frost and prolonged waterlogging.",
    soilRequirements:
      "Deep, fertile, well-drained loamy or sandy loam soils with pH 6.0–7.5 and high organic matter content.",
    seasons:
      "Kharif (June–July sowing), Rabi (October–November sowing, highest yield), and Spring in northern plains.",
    plantingMaterial:
      "Certified single-cross hybrid seed (e.g., DHM 117, PMH 1, Bio 9681, Pioneer varieties). Seed rate: 18–20 kg/ha for grain maize.",
    landPreparation:
      "Deep ploughing followed by 2 harrowing passes and ridging. Raised bed or ridge-and-furrow method is strongly recommended for drainage.",
    sowingOrPlanting:
      "Sow on sides of ridges at 4–5 cm depth with 60 cm row-to-row and 20 cm plant-to-plant spacing to achieve ~83,333 plants/ha.",
    growthStages: [
      {
        index: 1,
        title: "Seed Sowing & Emergence (VE–V2)",
        what: "Treat seeds with Thiram + Carbendazim (2g/kg) and Imidacloprid (4ml/kg). Ensure moist seedbed.",
        when: "Days 1–10 after sowing",
        why: "Rapid emergence prevents soil-borne seedling rots and wireworm damage.",
        caution: "Sowing deeper than 5 cm causes erratic emergence and weak stands.",
      },
      {
        index: 2,
        title: "Early Vegetative & Knee-High (V4–V8)",
        what: "Thin out to one seedling per hill at 12–15 DAS. Side-dress first 1/3 nitrogen and earth up.",
        when: "Days 15–35 after sowing",
        why: "Knee-high is the critical root development and ear primordia differentiation stage.",
        caution:
          "Severe weed competition during the first 30 days causes irreversible yield reduction.",
      },
      {
        index: 3,
        title: "Tasseling & Silking (VT–R1)",
        what: "Critical irrigation window. Ensure adequate soil moisture; side-dress remaining nitrogen.",
        when: "Days 45–60 after sowing",
        why: "Pollen shedding and silk emergence must coincide for complete kernel set.",
        caution: "Moisture stress at silking delays silk emergence and causes barren cobs.",
      },
      {
        index: 4,
        title: "Grain Filling & Blister/Milk Stage (R2–R3)",
        what: "Maintain moisture at 60% available water capacity. Scout for Fall Armyworm on cobs.",
        when: "Days 60–80 after sowing",
        why: "Kernel weight and starch accumulation proceed rapidly during grain fill.",
        caution: "Avoid water stagnation in furrows; ensure quick drainage after heavy showers.",
      },
      {
        index: 5,
        title: "Dent & Physiological Maturity (R5–R6)",
        what: "Check for black layer formation at the tip of the kernel base. Stop irrigation.",
        when: "Days 85–105 after sowing",
        why: "Black layer indicates dry matter accumulation is complete.",
        caution:
          "Bird damage risk is high during late maturity; install reflective ribbons or bird scarers.",
      },
    ],
    irrigation:
      "Critical moisture periods: Knee-high, Tasseling/Silking, and Grain filling. Provide 4–6 irrigations in Rabi and need-based life-saving irrigation in Kharif.",
    nutrientManagement:
      "Follow soil-test-based nutrient recommendations and locally recommended crop practices. Standard hybrid guideline: N:P2O5:K2O @ 120-150:60:40 kg/ha, with N in 3 equal splits (basal, knee-high, tasseling).",
    weedManagement:
      "Apply Atrazine 50% WP @ 1.0–1.25 kg a.i./ha as pre-emergence within 2 days of sowing, followed by hand weeding or intercultivation at 25 DAS.",
    pestDiseaseMonitoring: [
      {
        name: "Fall Armyworm (Spodoptera frugiperda)",
        type: "pest",
        symptomsOrTiming: "Pin holes and windowing on whorl leaves with sawdust-like frass.",
        management:
          "Whorl application of neem cake or spray Spinetoram 11.7% SC @ 0.5 ml/L or Chlorantraniliprole 18.5% SC @ 0.4 ml/L.",
      },
      {
        name: "Turcicum Leaf Blight (Exserohilum turcicum)",
        type: "disease",
        symptomsOrTiming: "Long elliptical grayish-green or tan lesions on lower leaves.",
        management: "Spray Mancozeb 75% WP @ 2.5 g/L on early detection.",
      },
    ],
    harvest:
      "Harvest when husk leaves turn paper-dry and white, and grain moisture is 18–20% with visible black layer at the kernel hilum.",
    postHarvest:
      "De-husk, dry cobs in sun to 12% grain moisture, shell with mechanical maize sheller, and store in moisture-proof bins with aluminium phosphide protection against weevils.",
    importantNotes: [
      "Maize is highly sensitive to waterlogging. Ridges and furrows enhance root aeration and reduce seedling death.",
      "Balanced application of Zinc Sulphate @ 25 kg/ha prevents 'white bud' physiological disorder in zinc-deficient soils.",
    ],
    regionalCaution:
      "Rabi maize produces substantially higher yields than Kharif maize due to disease-free cooler nights and prolonged solar radiation. Adjust sowing dates to escape winter frost in North India.",
    sources: [
      {
        organization: "ICAR - Indian Institute of Maize Research (IIMR)",
        title: "Maize Production Technologies in India",
        url: "https://iimr.icar.gov.in",
        accessedDate: "2026-09-15",
      },
      {
        organization: "TNAU Agritech Portal",
        title: "Crop Production Guide: Maize",
        url: "https://agritech.tnau.ac.in/agriculture/agri_crop_production_cereals_maize.html",
        accessedDate: "2026-09-15",
      },
    ],
  },
};

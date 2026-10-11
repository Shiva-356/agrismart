import type { CropCultivationGuide } from "./types";

export const pulsesGuides: Record<
  "chickpea" | "pigeonpeas" | "blackgram" | "mungbean" | "mothbeans" | "lentil" | "kidneybeans",
  CropCultivationGuide
> = {
  chickpea: {
    crop: "chickpea",
    displayName: "Chickpea (Bengal Gram / Chana)",
    category: "Pulse",
    durationDays: 105,
    waterRequirement: "Low (250–350 mm)",
    overview:
      "Chickpea (Cicer arietinum) is the premier pulse crop of India, primarily cultivated as a post-monsoon (Rabi) crop relying largely on conserved soil moisture.",
    suitableClimate:
      "Cool and dry winter climate (optimum 15–25°C). Frost at flowering causes severe flower drop and pod abortion.",
    soilRequirements:
      "Well-drained deep clay loam, silt loam, or black cotton soils with pH 6.0–7.5. Avoid saline/alkaline or waterlogged soils.",
    seasons:
      "Rabi (sown mid-October to mid-November across Central, Southern, and Northern India).",
    plantingMaterial:
      "Certified seed of Desi (e.g., JG 11, JAKI 9218) or Kabuli (e.g., KAK 2, MNK 1) varieties. Seed rate: 65–75 kg/ha for Desi, 100–120 kg/ha for bold Kabuli.",
    landPreparation:
      "Prepare a rough, well-pulverized seedbed with 1 deep ploughing and 2 harrowings. Avoid overly fine dust tilth which causes soil capping.",
    sowingOrPlanting:
      "Drill seed at 7–10 cm depth to place seed in moist soil layer. Spacing: 30 cm × 10 cm for Desi, 45 cm × 10 cm for Kabuli.",
    growthStages: [
      {
        index: 1,
        title: "Seed Treatment & Sowing",
        what: "Inoculate seed with Rhizobium and PSB culture (250g/10kg) and Trichoderma viride (4g/kg) to control wilt.",
        when: "At sowing (mid-Oct to mid-Nov)",
        why: "Symbiotic nitrogen fixation meets up to 75% of chickpea nitrogen requirements.",
        caution: "Deep sowing ensures adequate moisture for germination in rainfed soil.",
      },
      {
        index: 2,
        title: "Vegetative Growth & Branching",
        what: "Perform manual weeding or light inter-cultivation at 25–30 DAS. Nipping of terminal shoot at 35–40 DAS induces profuse branching.",
        when: "Days 20–45 after sowing",
        why: "Nipping breaks apical dominance and increases pod-bearing branches.",
        caution: "Do not irrigate if vegetative growth is overly luxuriant.",
      },
      {
        index: 3,
        title: "Flower Initiation & Pod Set",
        what: "Critical irrigation stage if winter rains fail. Monitor for Helicoverpa pod borer larvae.",
        when: "Days 50–75 after sowing",
        why: "Moisture stress during flowering causes flower drop; moisture excess causes collar rot.",
        caution:
          "Never flood fields; use furrow irrigation or sprinkler to avoid root aeration loss.",
      },
      {
        index: 4,
        title: "Pod Filling & Maturity",
        what: "Pods swell and change from bright green to brownish yellow. Leaves begin to dry and drop.",
        when: "Days 80–110 after sowing",
        why: "Grain dry matter accumulation peaks.",
        caution: "Watch for late pod borer damage inside maturing pods.",
      },
    ],
    irrigation:
      "Requires 1–2 irrigations depending on winter rain. Critical stages: Pre-flowering (45 DAS) and Pod development (70 DAS). Avoid irrigation at peak flowering.",
    nutrientManagement:
      "Follow soil-test-based nutrient recommendations and locally recommended crop practices. Standard guideline: N:P2O5:K2O @ 20:40:20 kg/ha + 20 kg Sulphur/ha as basal dressing.",
    weedManagement:
      "Pre-emergence application of Pendimethalin 30% EC @ 1.0 kg a.i./ha within 3 days of sowing + one hand weeding at 30 DAS.",
    pestDiseaseMonitoring: [
      {
        name: "Gram Pod Borer (Helicoverpa armigera)",
        type: "pest",
        symptomsOrTiming:
          "Caterpillars feed on foliage and defoliate; drill holes into pods and eat seeds.",
        management:
          "Install pheromone traps @ 5/ha; spray Emamectin Benzoate 5% SG @ 0.4 g/L or Chlorantraniliprole 18.5% SC @ 0.3 ml/L at threshold (1 larva/meter row).",
      },
      {
        name: "Fusarium Wilt (Fusarium oxysporum f. sp. ciceris)",
        type: "disease",
        symptomsOrTiming:
          "Drooping of leaves and wilting of plants in patches; internal vascular browning.",
        management:
          "Grow wilt-resistant varieties (JG 11, JAKI 9218); seed treatment with Trichoderma viride.",
      },
    ],
    harvest:
      "Harvest when leaves turn reddish-brown/straw color and pods rattle when shaken. Cut close to ground in early morning to prevent pod shattering.",
    postHarvest:
      "Sun dry plants for 3–4 days on threshing floor, thresh mechanically, winnow, and dry grain to 9–10% moisture before bagging with neem leaves.",
    importantNotes: [
      "Chickpea fixes atmospheric nitrogen; leaves 20–30 kg N/ha residual fertility for following crops.",
      "Sulphur application (20 kg/ha via gypsum or SSP) significantly boosts protein content and grain yield.",
    ],
    regionalCaution:
      "Excessive irrigation or high humidity promotes Botrytis grey mould in North India and root rot in South India. Adjust irrigation strictly to soil type.",
    sources: [
      {
        organization: "ICAR - Indian Institute of Pulses Research (IIPR)",
        title: "Chickpea Cultivation Technology",
        url: "https://iipr.icar.gov.in",
        accessedDate: "2026-09-15",
      },
    ],
  },

  pigeonpeas: {
    crop: "pigeonpeas",
    displayName: "Pigeonpea (Red Gram / Arhar / Tur)",
    category: "Pulse",
    durationDays: 160,
    waterRequirement: "Medium (500–650 mm)",
    overview:
      "Pigeonpea (Cajanus cajan) is a vital deep-rooted, drought-hardy legume providing protein-rich dal, soil conservation, and organic matter across dryland India.",
    suitableClimate:
      "Tropical and subtropical climate with warm, humid weather during vegetative growth and dry sunny weather at flowering/pod setting (20–32°C).",
    soilRequirements:
      "Deep, well-drained loamy to black clay soils with pH 6.5–7.5. Extremely sensitive to water stagnation during early growth.",
    seasons: "Kharif (June–July sowing with onset of southwest monsoon).",
    plantingMaterial:
      "Certified seeds of short-duration (e.g., ICPL 87, Pusa 992) or medium/long-duration (e.g., Asha / ICPL 87119, PRG 176, Maruti) varieties. Seed rate: 10–12 kg/ha.",
    landPreparation:
      "One deep summer ploughing (25–30 cm) to break hardpan and allow deep taproot development, followed by 2 cross harrowings and broad-bed furrowing.",
    sowingOrPlanting:
      "Sow on ridges or broad beds. Spacing: 90–120 cm row-to-row and 20–30 cm plant-to-plant depending on variety and branching habit.",
    growthStages: [
      {
        index: 1,
        title: "Establishment & Slow Vegetative Growth",
        what: "Seed treatment with Rhizobium and Trichoderma. Intercrop with soybean, green gram or groundnut.",
        when: "Days 1–45 after sowing",
        why: "Early taproot development dominates; canopy growth is slow.",
        caution: "Water stagnation for even 24–48 hours causes Phytophthora stem blight.",
      },
      {
        index: 2,
        title: "Rapid Branching & Canopy Expansion",
        what: "Nipping or tipping of apical shoot at 45–50 DAS promotes secondary and tertiary productive branches.",
        when: "Days 45–90 after sowing",
        why: "Number of pod clusters is directly proportional to productive branch density.",
        caution: "Keep field completely weed-free through the first 60 days.",
      },
      {
        index: 3,
        title: "Flowering & Pod Initiation",
        what: "Critical stage for moisture and pest management. Spray prophylactic neem oil for pod borer complex.",
        when: "Days 90–125 after sowing",
        why: "Profuse flowering occurs; up to 80% natural flower drop occurs if moisture or nutrient stress occurs.",
        caution: "Ensure soil moisture at pod initiation; do not let soil crack severely.",
      },
      {
        index: 4,
        title: "Pod Maturity & Harvest",
        what: "Pods turn brown and dry. Stop all spray applications 15 days before harvest.",
        when: "Days 140–180 after sowing",
        why: "Seeds harden and reach physiological maturity.",
        caution: "Harvest promptly when 80% pods are ripe to avoid pod shattering.",
      },
    ],
    irrigation:
      "Largely rainfed. Protective irrigation at flower initiation and pod development stages boosts yield by 30–40% during dry spells.",
    nutrientManagement:
      "Follow soil-test-based nutrient recommendations and locally recommended crop practices. Standard guideline: N:P2O5:K2O @ 20:50:20 kg/ha as basal plus 20 kg Sulphur/ha.",
    weedManagement:
      "Pendimethalin 30% EC @ 1.0 kg a.i./ha as pre-emergence followed by hand weeding or harrowing at 30 and 50 DAS.",
    pestDiseaseMonitoring: [
      {
        name: "Pod Borer Complex (Helicoverpa & Maruca vitrata)",
        type: "pest",
        symptomsOrTiming: "Webbed flowers and pods with circular entrance holes eaten by larvae.",
        management:
          "Spray Chlorantraniliprole 18.5% SC @ 0.3 ml/L or Flubendiamide 39.35% SC @ 0.2 ml/L at flower bud initiation.",
      },
      {
        name: "Fusarium Wilt (Fusarium udum)",
        type: "disease",
        symptomsOrTiming: "Purple band on main stem and gradual wilting of branches.",
        management:
          "Grow resistant varieties (Asha, Maruti); adopt 3-year crop rotation with sorghum or maize.",
      },
    ],
    harvest:
      "Cut mature plants with sickle when 80–85% of pods turn golden-brown. Stack in bundles for sun drying.",
    postHarvest:
      "Thresh by beating with sticks or using mechanical pulse thresher. Dry grain to 9–10% moisture.",
    importantNotes: [
      "Deep taproots (up to 2 meters) break soil compaction and recycle deep subsoil nutrients.",
      "Foliar spray of 2% Urea or DAP at flowering improves pod setting.",
    ],
    regionalCaution:
      "Duration varies dramatically from 120 days (extra-early) to over 200 days (traditional long-duration). Select varieties matching local frost and rain schedules.",
    sources: [
      {
        organization: "ICAR - Indian Institute of Pulses Research (IIPR)",
        title: "Pigeonpea Production Technologies",
        url: "https://iipr.icar.gov.in",
        accessedDate: "2026-09-15",
      },
    ],
  },

  blackgram: {
    crop: "blackgram",
    displayName: "Blackgram (Urad Bean)",
    category: "Pulse",
    durationDays: 75,
    waterRequirement: "Low (300–400 mm)",
    overview:
      "Blackgram (Vigna mungo) is an essential short-duration pulse crop widely grown as sole, catch, or relay crop (rice-fallows) rich in phosphoric acid.",
    suitableClimate:
      "Warm and humid climate with 25–35°C temperature. Cannot tolerate severe frost or waterlogging.",
    soilRequirements:
      "Well-drained loam or heavy clay loam soils with good moisture retentivity and neutral pH (6.5–7.5).",
    seasons:
      "Kharif (June–July), Rabi (October–November), and Summer (February–March) in irrigated belts.",
    plantingMaterial:
      "Certified seeds of varieties such as T-9, WBU-108, PU-31, VBN 6, Shekhar-2. Seed rate: 15–20 kg/ha for sole Kharif, 25–30 kg/ha for rice-fallow relay.",
    landPreparation:
      "2 harrowings followed by planking to obtain a firm, pulverized seedbed. In rice-fallows, seed is broadcast directly into standing paddy 2–3 days before harvest.",
    sowingOrPlanting: "Sow in lines at 30 cm × 10 cm spacing at 3–4 cm depth.",
    growthStages: [
      {
        index: 1,
        title: "Seedling Emergence & Nodulation",
        what: "Seed treatment with Rhizobium and Trichoderma. Monitor for seedling blight.",
        when: "Days 1–15 after sowing",
        why: "Rapid emergence and active nodule initiation ensure early nitrogen self-sufficiency.",
        caution:
          "Avoid crust formation; light harrowing may be required if rain falls immediately after sowing.",
      },
      {
        index: 2,
        title: "Vegetative & Flowering",
        what: "Weeding at 20 DAS. Spray 2% DAP or 1% pulse wonder at flower initiation.",
        when: "Days 20–45 after sowing",
        why: "Foliar nutrition reduces flower drop and boosts pod number.",
        caution: "Watch for whiteflies which transmit Yellow Mosaic Virus.",
      },
      {
        index: 3,
        title: "Pod Development & Maturity",
        what: "Pods turn from green to black. Stop irrigation 10 days before harvest.",
        when: "Days 50–75 after sowing",
        why: "Seeds achieve uniform black sheen and dry down.",
        caution: "Harvest before complete shattering during intense heat.",
      },
    ],
    irrigation:
      "Needs 2–3 irrigations if rain is insufficient: at branching (20–25 DAS) and pod filling (45–50 DAS).",
    nutrientManagement:
      "Follow soil-test-based nutrient recommendations. Standard guideline: N:P2O5:K2O @ 20:40:20 kg/ha basal + 20 kg Sulphur/ha.",
    weedManagement:
      "Pre-emergence Pendimethalin @ 1.0 kg a.i./ha within 3 DAS + one hand weeding at 25 DAS.",
    pestDiseaseMonitoring: [
      {
        name: "Yellow Mosaic Virus (MYMV) / Whitefly vector",
        type: "disease",
        symptomsOrTiming: "Irregular yellow patches on leaves alternating with green tissue.",
        management:
          "Grow YMV-tolerant varieties (PU 31, VBN 6); spray Thiamethoxam 25% WG @ 0.3 g/L to control whiteflies.",
      },
    ],
    harvest:
      "Pick pods when 80% turn black or cut whole plant when mature. Sun dry on threshing floor.",
    postHarvest:
      "Thresh, clean, and store grain at 8–9% moisture with edible oil coating (5 ml/kg) to deter pulse beetle.",
    importantNotes: ["Short duration makes it an ideal catch crop between major cereals."],
    regionalCaution: "Rice-fallow broadcast crops depend entirely on residual subsoil moisture.",
    sources: [
      {
        organization: "ICAR - Indian Institute of Pulses Research (IIPR)",
        title: "Urad Bean Cultivation",
        url: "https://iipr.icar.gov.in",
        accessedDate: "2026-09-15",
      },
    ],
  },

  mungbean: {
    crop: "mungbean",
    displayName: "Mungbean (Green Gram / Moong)",
    category: "Pulse",
    durationDays: 68,
    waterRequirement: "Low (250–350 mm)",
    overview:
      "Mungbean (Vigna radiata) is an extra-short duration, easily digestible pulse crop grown in Kharif, Summer, and Spring catch cropping.",
    suitableClimate:
      "Warm tropical/subtropical climate (27–35°C). Sensitive to cloudy weather and frost.",
    soilRequirements: "Fertile, well-drained loams and sandy loams with neutral pH (6.2–7.2).",
    seasons:
      "Kharif (June–July), Summer/Spring (March–April following potato, wheat, or sugarcane).",
    plantingMaterial:
      "Certified seeds of varieties such as Samrat, IPM 2-3, Virat, SML 668, Pusa Vishal. Seed rate: 15–20 kg/ha in Kharif, 25–30 kg/ha in Summer.",
    landPreparation:
      "1 ploughing followed by 2 harrowings and planking to conserve seedbed moisture.",
    sowingOrPlanting: "Sow at 25–30 cm row spacing and 10 cm plant spacing at 3–4 cm depth.",
    growthStages: [
      {
        index: 1,
        title: "Emergence & Early Growth",
        what: "Seed treatment with Rhizobium and PSB. Keep seedbed moist.",
        when: "Days 1–15 after sowing",
        why: "Rapid emergence avoids seedling rot and establishes weed suppression.",
        caution: "Do not sow too deep in heavy soil.",
      },
      {
        index: 2,
        title: "Flowering & Pod Setting",
        what: "Foliar spray of 2% DAP at early flowering. Irrigate if rain fails.",
        when: "Days 25–45 after sowing",
        why: "Synchronous flowering enhances uniform pod development.",
        caution: "Water stress at flowering causes severe flower shed.",
      },
      {
        index: 3,
        title: "Pod Ripening & Harvest",
        what: "Pods turn dark brown/black. Ready for single or split hand pickings.",
        when: "Days 55–70 after sowing",
        why: "Harvesting at physiological maturity preserves seed viability.",
        caution: "Avoid harvesting during wet spells which causes pre-harvest sprouting in pod.",
      },
    ],
    irrigation: "3–4 irrigations during summer: at 20–25 DAS, flowering, and pod development.",
    nutrientManagement:
      "Follow soil-test-based nutrient recommendations. Standard guideline: N:P2O5:K2O @ 20:40:20 kg/ha basal.",
    weedManagement: "Pendimethalin @ 1.0 kg a.i./ha pre-emergence + hand weeding at 20 DAS.",
    pestDiseaseMonitoring: [
      {
        name: "Cercospora Leaf Spot (Cercospora canescens)",
        type: "disease",
        symptomsOrTiming: "Brown circular to irregular spots with grey centers on leaves.",
        management: "Spray Carbendazim 50% WP @ 1 g/L or Mancozeb @ 2 g/L on early symptoms.",
      },
    ],
    harvest: "Pick pods when 80% turn dark brown or harvest whole plant with sickle.",
    postHarvest: "Thresh after 2–3 days sun drying. Store at 8% moisture in hermetic bags.",
    importantNotes: ["Shortest duration pulse in India; highly suitable for summer fallows."],
    regionalCaution: "Ensure irrigation water availability before planning summer mungbean.",
    sources: [
      {
        organization: "ICAR - Indian Institute of Pulses Research (IIPR)",
        title: "Mungbean Package of Practices",
        url: "https://iipr.icar.gov.in",
        accessedDate: "2026-09-15",
      },
    ],
  },

  mothbeans: {
    crop: "mothbeans",
    displayName: "Mothbean (Matki)",
    category: "Pulse",
    durationDays: 75,
    waterRequirement: "Very Low (200–300 mm)",
    overview:
      "Mothbean (Vigna aconitifolia) is the most drought-hardy grain legume grown in arid and semi-arid tracts of Rajasthan and Gujarat.",
    suitableClimate:
      "Hot arid/semi-arid climate (30–40°C daytime temperature). Highly drought tolerant.",
    soilRequirements:
      "Light sandy to sandy loam soils with good drainage; tolerates low fertility.",
    seasons: "Kharif (sown with the first monsoon showers in July).",
    plantingMaterial:
      "Certified seed of improved varieties (e.g., RMO 40, RMO 257, RMO 435, Maru Moth). Seed rate: 10–12 kg/ha.",
    landPreparation:
      "Minimal tillage; 1 ploughing followed by planking is sufficient in light desert soils.",
    sowingOrPlanting: "Sow at 30–45 cm row spacing and 10–15 cm plant spacing at 3–4 cm depth.",
    growthStages: [
      {
        index: 1,
        title: "Germination & Soil Cover",
        what: "Sprouts rapidly within 3–4 days; forms a dense spreading mat that protects soil from wind erosion.",
        when: "Days 1–20 after sowing",
        why: "Prostrate spreading habit conserves desert soil moisture.",
        caution: "Avoid standing water; vulnerable to waterlogging.",
      },
      {
        index: 2,
        title: "Flowering & Pod Filling",
        what: "Small yellow flowers produced in clusters followed by slender cylindrical pods.",
        when: "Days 30–60 after sowing",
        why: "Drought escape mechanism through rapid flowering.",
        caution: "Monitor for sucking pests during dry spells.",
      },
      {
        index: 3,
        title: "Maturity & Harvest",
        what: "Pods turn yellowish brown. Harvest entire vine.",
        when: "Days 65–80 after sowing",
        why: "Leaves dry down completely.",
        caution: "Over-drying causes pod shattering.",
      },
    ],
    irrigation:
      "Purely rainfed; requires 1 life-saving irrigation only during extended desert droughts.",
    nutrientManagement:
      "Follow soil-test-based nutrient recommendations. Standard guideline: N:P2O5 @ 10:20 kg/ha as basal.",
    weedManagement: "One manual weeding/hoeing at 20–25 DAS.",
    pestDiseaseMonitoring: [
      {
        name: "Jassids / Whiteflies",
        type: "pest",
        symptomsOrTiming: "Leaf curling and yellowing in dry conditions.",
        management: "Spray Dimethoate 30% EC @ 1.5 ml/L on threshold.",
      },
    ],
    harvest: "Cut plants when pods turn brown; dry on threshing floor for 3–4 days.",
    postHarvest: "Thresh by trampling or mechanical thresher; clean and store at 8–9% moisture.",
    importantNotes: [
      "Exceptional drought tolerance; excellent soil cover in erosion-prone sandy soils.",
    ],
    regionalCaution: "Restricted primarily to arid and semi-arid zones with rainfall below 400 mm.",
    sources: [
      {
        organization: "ICAR - Central Arid Zone Research Institute (CAZRI)",
        title: "Cultivation of Mothbean in Arid Zones",
        url: "https://cazri.icar.gov.in",
        accessedDate: "2026-09-15",
      },
    ],
  },

  lentil: {
    crop: "lentil",
    displayName: "Lentil (Masoor)",
    category: "Pulse",
    durationDays: 120,
    waterRequirement: "Low (200–300 mm)",
    overview:
      "Lentil (Lens culinaris) is an important cool-season grain legume grown in North, Central, and Eastern India with high protein and prebiotic content.",
    suitableClimate:
      "Cool winter climate (18–25°C). Tolerates cold and light frost better than chickpea.",
    soilRequirements:
      "Loam to clay loam soils with neutral to slightly alkaline pH (6.5–7.8). Avoid acid soils.",
    seasons: "Rabi (sown late October to mid-November).",
    plantingMaterial:
      "Certified seed of small-seeded or bold-seeded varieties (e.g., DPL 62, KLS 218, HUL 57, Pant L 406). Seed rate: 30–40 kg/ha for small seed, 40–50 kg/ha for bold seed.",
    landPreparation:
      "1 deep ploughing and 2 harrowings followed by planking to create a firm, fine seedbed.",
    sowingOrPlanting: "Sow at 25–30 cm row spacing at 3–4 cm depth.",
    growthStages: [
      {
        index: 1,
        title: "Seed Sowing & Emergence",
        what: "Seed treatment with Rhizobium leguminosarum and PSB. Ensure uniform sowing depth.",
        when: "Days 1–15 after sowing",
        why: "Adequate stand density is vital as lentil has limited tillering capacity.",
        caution: "Deep sowing (>5 cm) delays emergence and weakens seedlings.",
      },
      {
        index: 2,
        title: "Branching & Canopy Development",
        what: "Weeding at 25–30 DAS. Light inter-cultivation to aerate root zone.",
        when: "Days 20–55 after sowing",
        why: "Weed competition in early stages severely suppresses lentil.",
        caution: "Avoid heavy irrigation that induces root rots.",
      },
      {
        index: 3,
        title: "Flowering & Pod Formation",
        what: "Critical irrigation if soil is dry. Monitor for rust and aphids.",
        when: "Days 60–90 after sowing",
        why: "Pods develop 1–2 seeds each; moisture stress causes flower shed.",
        caution: "High humidity and rain at flowering favor rust epidemics.",
      },
      {
        index: 4,
        title: "Pod Ripening & Harvest",
        what: "Leaves turn yellow and drop; pods turn brown.",
        when: "Days 105–130 after sowing",
        why: "Optimal maturity for harvesting with minimum shattering.",
        caution: "Harvest in morning when dew softens pods to prevent shattering.",
      },
    ],
    irrigation:
      "1–2 irrigations: at branching (40 DAS) and pod formation (70 DAS) if winter rains fail.",
    nutrientManagement:
      "Follow soil-test-based nutrient recommendations. Standard guideline: N:P2O5:K2O @ 20:40:20 kg/ha basal + 20 kg S/ha.",
    weedManagement: "Pendimethalin @ 1.0 kg a.i./ha as pre-emergence + one hand weeding at 30 DAS.",
    pestDiseaseMonitoring: [
      {
        name: "Lentil Rust (Uromyces viciae-fabae)",
        type: "disease",
        symptomsOrTiming: "Brown to dark brown pustules on leaves and stems.",
        management: "Spray Mancozeb 75% WP @ 2 g/L on initial disease appearance.",
      },
    ],
    harvest: "Harvest with sickle when plants turn golden-yellow and lower pods dry.",
    postHarvest: "Dry on threshing floor for 3–5 days, thresh gently, and store at 9–10% moisture.",
    importantNotes: [
      "Extremely valuable in rice-fallow sequence (paira / utera cropping) in Eastern India.",
    ],
    regionalCaution:
      "In North-East India, sow as a relay crop in standing rice 10–12 days before harvest.",
    sources: [
      {
        organization: "ICAR - Indian Institute of Pulses Research (IIPR)",
        title: "Lentil Production Guide",
        url: "https://iipr.icar.gov.in",
        accessedDate: "2026-09-15",
      },
    ],
  },

  kidneybeans: {
    crop: "kidneybeans",
    displayName: "Kidney Beans (Rajmash)",
    category: "Pulse",
    durationDays: 115,
    waterRequirement: "Medium (400–500 mm)",
    overview:
      "Kidney bean (Phaseolus vulgaris) is a high-value pulse requiring high soil fertility and moisture management. Unlike other pulses, it lacks efficient native nodulation in Indian plains.",
    suitableClimate:
      "Mild cool weather without frost or high heat (15–25°C). Extremely sensitive to both frost and water stagnation.",
    soilRequirements:
      "Deep, fertile, well-drained silt loams or clay loams with pH 6.0–7.2. Sensitive to salinity.",
    seasons:
      "Rabi in Northern & Central Indian plains (sown late October to early November); Kharif in Himalayan hills.",
    plantingMaterial:
      "Certified seeds of varieties such as HUR 15, HUR 137, Amber, Utkarsh, PDR 14. Seed rate: 90–100 kg/ha for bold seeds.",
    landPreparation:
      "Deep ploughing followed by 2–3 harrowings and planking to create a deep, friable, uncompacted seedbed.",
    sowingOrPlanting: "Sow in lines at 40 cm row spacing and 10 cm plant spacing at 5–6 cm depth.",
    growthStages: [
      {
        index: 1,
        title: "Emergence & Early Stand",
        what: "Ensure moist seedbed. Treat seeds with Carbendazim (2g/kg).",
        when: "Days 1–15 after sowing",
        why: "Uniform stand density is critical for high yield.",
        caution: "Crusted soil prevents emergence; irrigate lightly if surface crusts.",
      },
      {
        index: 2,
        title: "Vegetative Growth & Nitrogen Top Dressing",
        what: "Apply split dose of nitrogen. Weeding at 25 and 45 DAS.",
        when: "Days 20–50 after sowing",
        why: "Rajmash lacks native nodulation in plains and requires substantial inorganic nitrogen.",
        caution: "Do not neglect nitrogen; deficiency causes severe stunting.",
      },
      {
        index: 3,
        title: "Flowering & Pod Setting",
        what: "Critical irrigation stage. Maintain uniform soil moisture.",
        when: "Days 55–80 after sowing",
        why: "Moisture stress causes severe flower drop and curved, empty pods.",
        caution: "Avoid water stagnation in furrows.",
      },
      {
        index: 4,
        title: "Pod Maturity & Harvest",
        what: "Pods turn creamy white or brown and dry out.",
        when: "Days 90–120 after sowing",
        why: "Grain achieves full size and characteristic kidney shape.",
        caution: "Harvest before pods split in the field.",
      },
    ],
    irrigation:
      "Needs 3–4 irrigations at 25-day intervals: early vegetative, pre-flowering, and pod development.",
    nutrientManagement:
      "Follow soil-test-based nutrient recommendations. Standard guideline: N:P2O5:K2O @ 100:60:40 kg/ha (apply N in 2 splits: 50% basal + 50% at 30 DAS) + 20 kg S/ha.",
    weedManagement: "Pendimethalin @ 1.0 kg a.i./ha as pre-emergence + hand weeding at 25 DAS.",
    pestDiseaseMonitoring: [
      {
        name: "Anthracnose (Colletotrichum lindemuthianum)",
        type: "disease",
        symptomsOrTiming: "Dark brown sunken circular spots on pods and black veins on leaves.",
        management: "Use disease-free seed; spray Carbendazim 50% WP @ 1 g/L or Mancozeb @ 2 g/L.",
      },
    ],
    harvest: "Harvest plants with sickle when pods turn yellow-brown. Dry in sun for 3–4 days.",
    postHarvest: "Thresh gently to avoid seed coat cracking. Store grain at 9–10% moisture.",
    importantNotes: [
      "Crucial distinction: Rajmash does NOT nodulate with native Indian Rhizobium in plains; it requires 100 kg N/ha like a cereal crop.",
    ],
    regionalCaution:
      "Grown as Rabi crop in plains, but strictly as Kharif/Spring crop in Himalayan valleys.",
    sources: [
      {
        organization: "ICAR - Indian Institute of Pulses Research (IIPR)",
        title: "Rajmash Production Technology",
        url: "https://iipr.icar.gov.in",
        accessedDate: "2026-09-15",
      },
    ],
  },
};

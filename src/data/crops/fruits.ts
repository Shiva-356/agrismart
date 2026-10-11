import type { CropCultivationGuide } from "./types";

export const fruitsGuides: Record<
  | "apple"
  | "banana"
  | "grapes"
  | "mango"
  | "muskmelon"
  | "orange"
  | "papaya"
  | "pomegranate"
  | "watermelon",
  CropCultivationGuide
> = {
  apple: {
    crop: "apple",
    displayName: "Apple",
    category: "Fruit",
    durationDays: 150,
    waterRequirement: "Medium (750–1000 mm)",
    overview:
      "Apple (Malus domestica) is the premier temperate fruit crop grown in high altitude valleys of Jammu & Kashmir, Himachal Pradesh, and Uttarakhand requiring winter chilling.",
    suitableClimate:
      "Temperate climate with 1000–1500 hours of chilling (<7°C) for dormancy breaking. Mild summer temperatures (20–25°C) during fruit development.",
    soilRequirements:
      "Deep, rich, well-drained loamy soils (minimum 1.5 m depth) with high organic matter, pH 5.5–6.8, and water table below 2 meters.",
    seasons: "Planting in dormant winter (December–February). Harvesting July to October.",
    plantingMaterial:
      "Budded/grafted plants on standard seedling rootstocks or clonal rootstocks (M.9 for high density, MM.106 for semi-dwarf). Varieties: Royal Delicious, Red Delicious, Gala, Fuji.",
    landPreparation:
      "Terrace slopes if hilly; dig pits of 1m × 1m × 1m during October–November, expose to sun, and fill with FYM and topsoil mixed with single superphosphate.",
    sowingOrPlanting:
      "Plant during winter dormancy. Spacing: 5 m × 5 m for standard, 3 m × 1.5 m to 2.5 m × 1 m for high density trellised orchards. Ensure 15–20% pollinizer varieties (Golden Delicious, Granny Smith).",
    growthStages: [
      {
        index: 1,
        title: "Dormancy & Winter Pruning",
        what: "Prune trees to open-centre or modified central leader. Apply dormant copper / tree spray oil.",
        when: "December–February (dormant phase)",
        why: "Pruning balances vegetative shoot growth and fruit spur formation.",
        caution: "Sterilize pruning shears between trees to prevent spread of cankers.",
      },
      {
        index: 2,
        title: "Bud Break & Flowering (Pink Bud to Bloom)",
        what: "Place bee hives @ 3–5 hives/ha. Spray boron (0.1%) at pink bud stage to improve pollen germination.",
        when: "March–April",
        why: "Cross-pollination by honeybees is mandatory for commercial fruit set in Delicious apples.",
        caution:
          "Strictly prohibit any synthetic insecticide sprays during bloom to protect pollinators.",
      },
      {
        index: 3,
        title: "Fruit Set & Chemical / Hand Thinning",
        what: "Thin fruitlets to 1 fruit per cluster at marble stage (10–14 days after petal fall).",
        when: "May–June",
        why: "Prevents alternate bearing and improves market fruit size and color.",
        caution: "Overcropping leads to broken branches and complete absence of crop next year.",
      },
      {
        index: 4,
        title: "Fruit Development & Maturity",
        what: "Maintain drip irrigation and summer pruning for sunlight penetration. Install hail nets.",
        when: "June–August",
        why: "Sunlight is essential for anthocyanin red color development in fruit skin.",
        caution: "Watch for Apple Scab following frequent summer rains.",
      },
      {
        index: 5,
        title: "Harvesting & Grading",
        what: "Harvest with stalk intact when ground color changes from green to pale yellow/red.",
        when: "July–October depending on altitude",
        why: "Starch-to-sugar conversion reaches optimum flavor and shelf life.",
        caution: "Do not pull fruit roughly; spur damage eliminates next year's bearing site.",
      },
    ],
    irrigation:
      "Drip irrigation is ideal, particularly during April–June dry spell. Critical stages: Petal fall and fruit development.",
    nutrientManagement:
      "Follow soil and leaf-analysis-based recommendations. Standard bearing tree (10+ years): 500g N, 250g P2O5, 750g K2O + 50 kg FYM per tree per year applied during winter dormancy.",
    weedManagement:
      "Mulching with black plastic or dry grass in tree basin (1 m radius) + mechanical mowing between rows.",
    pestDiseaseMonitoring: [
      {
        name: "Apple Scab (Venturia inaequalis)",
        type: "disease",
        symptomsOrTiming: "Olive-green velvety spots on leaves and scabby lesions on fruit.",
        management:
          "Spray Difenoconazole 25% EC @ 0.5 ml/L or Captan 50% WP @ 2 g/L following Mills infection periods.",
      },
      {
        name: "San Jose Scale (Quadraspidiotus perniciosus)",
        type: "pest",
        symptomsOrTiming: "Grey scale encrustation on bark and red halos on fruit skin.",
        management: "Apply 2% Horticultural Mineral Oil (HMO) during dormant winter.",
      },
    ],
    harvest:
      "Pick fruit carefully by twisting gently upward with stalk attached. Grade into Extra Fancy, Fancy, and Standard.",
    postHarvest:
      "Pre-cool within 24 hours of harvest; store at 0–2°C and 90–95% RH in controlled atmosphere (CA) storage for up to 6–8 months.",
    importantNotes: [
      "Commercial Delicious varieties are self-incompatible; planting 15–20% compatible pollinizer varieties is non-negotiable.",
    ],
    regionalCaution:
      "Strictly limited to temperate hill regions with adequate winter chilling hours (>1000–1200 m MSL).",
    sources: [
      {
        organization: "ICAR - Central Institute of Temperate Horticulture (CITH), Srinagar",
        title: "Apple Production Technology in India",
        url: "https://cith.icar.gov.in",
        accessedDate: "2026-09-15",
      },
    ],
  },

  banana: {
    crop: "banana",
    displayName: "Banana",
    category: "Fruit",
    durationDays: 330,
    waterRequirement: "High (1500–2000 mm)",
    overview:
      "Banana (Musa acuminata / paradisiaca) is the premier tropical fruit in India, grown under high-input intensive management with rapid cash returns.",
    suitableClimate:
      "Warm, humid tropical climate with 20–35°C temperature. Frost or temperatures below 12°C arrest growth and damage foliage.",
    soilRequirements:
      "Deep, well-drained, fertile loamy soil with minimum 1 m depth, rich in organic matter, pH 6.5–7.5. Susceptible to waterlogging.",
    seasons: "Planting done in May–June or September–October depending on state.",
    plantingMaterial:
      "Disease-free tissue culture plantlets or sword suckers (1.5–2.0 kg). Varieties: Grand Naine (G9), Robusta, Poovan, Rasthali, Nendran.",
    landPreparation:
      "Deep ploughing (30–40 cm) and harrowing. Dig pits of 45 cm × 45 cm × 45 cm or open trenches for drip fertigation.",
    sowingOrPlanting:
      "Plant tissue culture plantlets in pits. Spacing: 1.8 m × 1.8 m (3086 plants/ha) or high-density 1.5 m × 1.5 m (4444 plants/ha).",
    growthStages: [
      {
        index: 1,
        title: "Planting & Vegetative Emergence",
        what: "Harden and plant healthy tissue culture plants. Basin application of neem cake and Trichoderma.",
        when: "Months 1–4 after planting",
        why: "Rapid root anchorage and pseudostem development occur.",
        caution: "Prevent water stagnation around pseudostem to stop collar rot.",
      },
      {
        index: 2,
        title: "Active Pseudostem Growth & Desuckering",
        what: "Apply scheduled drip fertigation. Remove all emerging side suckers (desuckering) until shooting.",
        when: "Months 4–7 after planting",
        why: "Diverting nutrients to main pseudostem ensures large bunch size.",
        caution:
          "Allowing suckers to grow during vegetative phase reduces bunch weight by up to 35%.",
      },
      {
        index: 3,
        title: "Shooting (Inflorescence Emergence) & Earthing Up",
        what: "Bunch emerges from crown. Earth up roots and provide bamboo or rope propping against lodging.",
        when: "Months 7–9 after planting",
        why: "Heavy bunches (25–35 kg) cause pseudostem to bend and topple without propping.",
        caution: "Propping is critical before wind storms.",
      },
      {
        index: 4,
        title: "Denavelling & Bunch Bagging",
        what: "Remove male bud (denavelling) after last hand opens. Cover bunch with blue non-woven polypropylene sleeve.",
        when: "Months 9–10 after planting",
        why: "Denavelling diverts energy to fingers; bunch covers protect against thrips, sunscald and dust.",
        caution:
          "Spray bunch with potassium sulphate (0.5%) before bagging for uniform finger fill.",
      },
      {
        index: 5,
        title: "Bunch Maturity & Harvest",
        what: "Harvest when fingers turn light green and angles become rounded.",
        when: "Months 11–13 after planting",
        why: "Optimal maturity (75–80%) for distance transport.",
        caution: "Avoid dropping bunches on bare soil during cutting.",
      },
    ],
    irrigation:
      "Drip irrigation @ 15–20 litres/plant/day during winter and 25–30 litres/plant/day during summer. Never allow drought.",
    nutrientManagement:
      "Follow soil-test-based nutrient recommendations. Standard G9 guideline: 200g N, 60g P2O5, 300g K2O per plant per crop cycle, applied primarily through weekly drip fertigation.",
    weedManagement:
      "Maintain clean basin with regular shallow hoeing or organic mulching. Glyphosate spot application with protective hood for inter-row weeds.",
    pestDiseaseMonitoring: [
      {
        name: "Panama Wilt (Fusarium oxysporum f. sp. cubense / TR4)",
        type: "disease",
        symptomsOrTiming: "Yellowing of lower leaves and vascular discoloration in pseudostem.",
        management:
          "Strict quarantine; use certified TC plants; apply biocontrol Trichoderma harzianum; avoid susceptible cultivars in infected fields.",
      },
      {
        name: "Sigatoka Leaf Spot (Mycosphaerella musicola)",
        type: "disease",
        symptomsOrTiming: "Spindle-shaped spots with grey centers and yellow halos on leaves.",
        management:
          "Remove and burn diseased leaves; spray Propiconazole 25% EC @ 1 ml/L with mineral oil (1%).",
      },
    ],
    harvest: "Cut bunch leaving 30 cm stalk. Carry on foam-padded trays to packing shed.",
    postHarvest:
      "De-hand, wash in alum/chlorinated water, air dry, grade, pack in CFB boxes, and ripen in ethylene chambers at 16–18°C.",
    importantNotes: [
      "Drip fertigation and bunch bagging increase marketable A-grade yield by 25–40%.",
    ],
    regionalCaution:
      "Windbreak trees (e.g., Casuarina) must be planted around banana orchards in cyclone-prone coastal belts.",
    sources: [
      {
        organization: "ICAR - National Research Centre for Banana (NRCB), Tiruchirappalli",
        title: "Banana Cultivation Guide and Production Technology",
        url: "https://nrcb.icar.gov.in",
        accessedDate: "2026-09-15",
      },
    ],
  },

  grapes: {
    crop: "grapes",
    displayName: "Grapes",
    category: "Fruit",
    durationDays: 140,
    waterRequirement: "Medium (500–700 mm)",
    overview:
      "Grapes (Vitis vinifera) are high-value subtropical/temperate fruit vines grown on bower/Y-trellis systems predominantly in Maharashtra, Karnataka, and Tamil Nadu.",
    suitableClimate:
      "Warm dry summers and cool dry winters. High rainfall or humid weather during ripening promotes devastating fungal diseases and berry splitting.",
    soilRequirements:
      "Deep, well-drained sandy loam or clay loam with pH 6.5–8.0 and EC < 1.0 dS/m. Sensitive to salinity and water stagnation.",
    seasons:
      "Unique two-pruning one-crop system in peninsular India: Foundation pruning in April and Forward (fruit) pruning in September–October.",
    plantingMaterial:
      "Grafted rootstocks (Dogridge or Salt Creek) to tolerate salinity and drought. Table varieties: Thompson Seedless, Sharad Seedless, Manik Chaman, Flame Seedless.",
    landPreparation:
      "Subsoiling to 60 cm to break hardpan. Trench or pit method (1m wide × 1m deep) filled with compost and gypsum.",
    sowingOrPlanting:
      "Plant in January–February. Bower (Pandal) or Y-trellis system. Spacing: 3.0 m × 1.8 m (1851 vines/ha) or 2.7 m × 1.5 m.",
    growthStages: [
      {
        index: 1,
        title: "April Pruning (Foundation / Back Pruning)",
        what: "Prune canes back to 1–2 buds after previous harvest. Irrigate heavily and apply organic manures.",
        when: "April",
        why: "Builds vegetative cane architecture and food reserves for the winter fruit crop.",
        caution: "Subshoot pinching at 5–6 leaves ensures fruitful bud differentiation.",
      },
      {
        index: 2,
        title: "October Pruning (Fruit / Forward Pruning)",
        what: "Prune mature canes to 4–8 buds depending on bud fruitfulness testing. Apply Hydrogen Cyanamide (40–50 ml/L) to buds.",
        when: "September–October",
        why: "Triggers uniform and synchronous bud break across the vineyard.",
        caution: "Do not prune during rain spells to avoid early downy mildew.",
      },
      {
        index: 3,
        title: "Bud Burst to Flowering",
        what: "Flower clusters emerge. Regulate canopy; spray prophylactic bio-fungicides.",
        when: "Days 15–35 after October pruning",
        why: "Flower bud development sets potential bunch count.",
        caution: "Strictly avoid systemic insecticide sprays during bloom.",
      },
      {
        index: 4,
        title: "Berry Set & Gibberellic Acid (GA3) Application",
        what: "Apply GA3 dips: 10–15 ppm for bunch elongation; 30–40 ppm at 4 mm berry size for berry thinning and sizing.",
        when: "Days 40–60 after pruning",
        why: "Seedless grapes require exogenous gibberellins to achieve commercial berry size (18–20 mm).",
        caution: "Excess GA3 causes pedicel thickening, berry drop, and shot berries.",
      },
      {
        index: 5,
        title: "Veraison (Color Break & Softening)",
        what: "Berries soften and accumulate sugars. Reduce irrigation by 50%.",
        when: "Days 80–110 after pruning",
        why: "Sugar concentration (TSS) rises to 18–20° Brix.",
        caution: "Sudden heavy irrigation during veraison causes berry cracking.",
      },
      {
        index: 6,
        title: "Harvesting",
        what: "Harvest when TSS reaches 18–20° Brix and acidity drops below 0.6%.",
        when: "January–April (120–140 days after forward pruning)",
        why: "Grapes are non-climacteric and will not ripen after picking.",
        caution: "Pick only fully ripe bunches in cool early mornings.",
      },
    ],
    irrigation:
      "Regulated deficit irrigation (RDI) via drip system. High water during cane growth; moderate water after fruit set; restricted water near harvest.",
    nutrientManagement:
      "Follow petiole analysis recommendations. Standard bearing vine guideline: 150 kg N, 100 kg P2O5, 250 kg K2O/ha/year split between the two pruning cycles.",
    weedManagement:
      "Maintain weed-free vine basins with mechanical weeding and plastic or bagasse mulching.",
    pestDiseaseMonitoring: [
      {
        name: "Downy Mildew (Plasmopara viticola)",
        type: "disease",
        symptomsOrTiming:
          "Yellow oily spots on upper leaf surface with white downy growth on lower surface.",
        management:
          "Spray Dimethomorph 50% WP @ 1 g/L or Bordeaux mixture (1%) before rain events.",
      },
      {
        name: "Powdery Mildew (Uncinula necator)",
        type: "disease",
        symptomsOrTiming: "White powdery coating on leaves, tendrils, and berries.",
        management: "Dust Sulphur @ 20 kg/ha or spray Hexaconazole 5% EC @ 1 ml/L.",
      },
    ],
    harvest:
      "Clip bunches carefully with grape shears; trim defective berries with curved scissors.",
    postHarvest:
      "Pre-cool to 2–4°C within 4 hours; pack in cartons with SO2 grape guard sheets; store at 0°C and 95% RH.",
    importantNotes: [
      "Dogridge rootstock is essential in peninsular India to overcome salinity, drought, and nematode stress.",
    ],
    regionalCaution:
      "Strictly avoid areas with heavy rainfall during January–March fruit development and ripening.",
    sources: [
      {
        organization: "ICAR - National Research Centre for Grapes (NRCG), Pune",
        title: "Grape Production Technology and Advisory Package",
        url: "https://nrcgrapes.icar.gov.in",
        accessedDate: "2026-09-15",
      },
    ],
  },

  mango: {
    crop: "mango",
    displayName: "Mango",
    category: "Fruit",
    durationDays: 140,
    waterRequirement: "Medium (700–900 mm)",
    overview:
      "Mango (Mangifera indica), the 'King of Fruits', is India's leading fruit crop with extensive commercial cultivars adapted to diverse agro-climatic zones.",
    suitableClimate:
      "Tropical to subtropical climate with 24–30°C temperature. Dry sunny weather during flowering and fruit setting is crucial for good yield.",
    soilRequirements:
      "Deep, rich, well-drained alluvial, red loamy, or medium black soils with minimum 2 m depth and pH 5.5–7.5. Avoid hard pan within 2 m.",
    seasons:
      "Planting during monsoon (July–August). Flowering December–February; harvest April–July.",
    plantingMaterial:
      "Epicotyl or veneer grafted plants from certified nurseries. Varieties: Alphonso, Kesar, Dashehari, Banganapalli, Chausa, Totapuri, Amrapali.",
    landPreparation:
      "Pits of 1m × 1m × 1m dug in summer, weathered, and filled with topsoil, 50 kg FYM, 1 kg single superphosphate, and neem cake.",
    sowingOrPlanting:
      "Square planting system: 10 m × 10 m for traditional cultivars (100 trees/ha) or 5 m × 5 m / 3 m × 2.5 m for high density (Amrapali).",
    growthStages: [
      {
        index: 1,
        title: "Orchard Establishment (Years 1–3)",
        what: "Formative pruning to establish strong scaffold branches at 75–100 cm height. Remove all early flower panicles.",
        when: "Years 1–3 after planting",
        why: "Focuses all tree energy into strong trunk and canopy architecture.",
        caution: "Do not allow young trees to set fruit in the first three years.",
      },
      {
        index: 2,
        title: "Pre-Flowering Dormancy & Shoot Maturation",
        what: "Withhold irrigation for 2–3 months before expected flowering (October–November).",
        when: "October–November",
        why: "Mild moisture stress halts vegetative flushing and triggers floral bud differentiation.",
        caution:
          "Irrigation during this period induces vegetative shoots instead of flower panicles.",
      },
      {
        index: 3,
        title: "Panicle Emergence & Full Bloom",
        what: "Monitor for mango hopper and powdery mildew. Introduce honeybee boxes.",
        when: "December–February",
        why: "Pollination by houseflies and honeybees ensures fruit set.",
        caution: "Do not spray systemic chemical insecticides during peak bloom.",
      },
      {
        index: 4,
        title: "Fruit Set & Pea/Marble Stage",
        what: "Resume irrigation. Spray Potassium Nitrate (1%) to minimize fruitlet drop.",
        when: "February–March",
        why: "Critical stage where natural physiological fruit drop occurs.",
        caution: "Water stress during pea stage causes excessive fruit drop.",
      },
      {
        index: 5,
        title: "Fruit Development & Maturity",
        what: "Maintain drip irrigation. Install methyl eugenol pheromone traps for fruit fly.",
        when: "March–May",
        why: "Flesh develops characteristic aroma, sugars, and carotenoids.",
        caution: "Stop irrigation 15 days before harvest to improve shelf life.",
      },
    ],
    irrigation:
      "Irrigate every 10–12 days from fruit set until maturity. Withhold completely during winter flower induction.",
    nutrientManagement:
      "Follow soil-test recommendations. Bearing tree (10+ years): 500g N, 250g P2O5, 750g K2O + 50 kg FYM per tree per year applied after harvest in July–August.",
    weedManagement:
      "Keep tree basin weed-free. Grow intercrops (pulses, vegetables) in interspaces during first 5 years.",
    pestDiseaseMonitoring: [
      {
        name: "Mango Hopper (Amritodus atkinsoni)",
        type: "pest",
        symptomsOrTiming:
          "Hoppers suck sap from panicles causing drying and honey-dew sooty mould.",
        management:
          "Spray Thiamethoxam 25% WG @ 0.3 g/L or Imidacloprid 17.8% SL @ 0.3 ml/L at early panicle emergence.",
      },
      {
        name: "Anthracnose (Colletotrichum gloeosporioides)",
        type: "disease",
        symptomsOrTiming: "Blossom blight, leaf spot, and black tear-staining on fruit.",
        management: "Spray Carbendazim 50% WP @ 1 g/L or Copper Oxychloride @ 3 g/L.",
      },
    ],
    harvest:
      "Harvest using pole harvesters with net bags when fruits show slight color break (shoulder development) with specific gravity 1.01–1.02.",
    postHarvest:
      "Hot water treatment (48°C for 60 min) or vapor heat treatment against fruit fly; pack in ventilated CFB cartons with paper lining.",
    importantNotes: [
      "Paclobutrazol (Cultar) soil drench in September regulates regular bearing in alternate-bearing varieties like Alphonso.",
    ],
    regionalCaution:
      "High humidity during flowering in coastal tracts encourages severe powdery mildew and anthracnose.",
    sources: [
      {
        organization: "ICAR - Central Institute for Subtropical Horticulture (CISH), Lucknow",
        title: "Mango Cultivation Technology",
        url: "https://cish.icar.gov.in",
        accessedDate: "2026-09-15",
      },
    ],
  },

  muskmelon: {
    crop: "muskmelon",
    displayName: "Muskmelon (Cantaloupe / Kharbooza)",
    category: "Fruit",
    durationDays: 85,
    waterRequirement: "Low to Medium (350–450 mm)",
    overview:
      "Muskmelon (Cucumis melo) is a short-duration commercial dessert fruit crop grown on riverbeds and irrigated open fields prized for high sweetness and refreshing aroma.",
    suitableClimate:
      "Warm, dry sunny climate with 28–35°C temperature. High humidity promotes powdery mildew and lowers sugar content.",
    soilRequirements:
      "Well-drained sandy loam, alluvial, or riverbed soils with pH 6.0–7.5. Good drainage is essential.",
    seasons:
      "Spring-Summer (sown January–February in plains, November–December in Southern India).",
    plantingMaterial:
      "Certified hybrid seeds (e.g., Pusa Sharbati, Hara Madhu, Arka Jeet, Kajari, commercial F1 hybrids). Seed rate: 1.5–2.0 kg/ha.",
    landPreparation:
      "Thorough ploughing followed by raised bed or channel preparation. Silver-black plastic mulch (25 micron) boosts early yield significantly.",
    sowingOrPlanting:
      "Sow on sides of channels or beds. Spacing: 1.5–2.0 m between rows and 50–60 cm between hills, 2 seeds per hill at 2–3 cm depth.",
    growthStages: [
      {
        index: 1,
        title: "Germination & Vine Emergence",
        what: "Ensure warm moist soil. Seed treatment with Thiram (3g/kg).",
        when: "Days 1–12 after sowing",
        why: "Early root strike establishes vigor before hot winds set in.",
        caution: "Soil temperature below 18°C severely delays germination.",
      },
      {
        index: 2,
        title: "Vine Elongation & Branching",
        what: "Thin to 1 vigorous seedling per hill. Apply first top dressing of nitrogen.",
        when: "Days 15–30 after sowing",
        why: "Pinching main shoot at 4–5 leaves encourages lateral branches that bear female flowers.",
        caution: "Do not let irrigation water touch the plant collar.",
      },
      {
        index: 3,
        title: "Flowering & Fruit Set",
        what: "Male flowers appear first followed by hermaphrodite/female flowers. Maintain bee activity.",
        when: "Days 35–50 after sowing",
        why: "Insect pollination is indispensable for fruit setting in cucurbits.",
        caution: "Do not spray toxic insecticides during morning pollination hours.",
      },
      {
        index: 4,
        title: "Fruit Netting & Sugar Accumulation",
        what: "Fruit swells; skin develops characteristic corky netting. Gradually taper off irrigation.",
        when: "Days 55–75 after sowing",
        why: "Reducing water before harvest concentrates sugars and prevents fruit cracking.",
        caution: "Excessive irrigation during ripening leads to bland fruit and rind bursting.",
      },
      {
        index: 5,
        title: "Harvest at 'Half-Slip' / 'Full-Slip'",
        what: "Harvest when stem detaches cleanly from fruit with light pressure (full slip stage).",
        when: "Days 75–85 after sowing",
        why: "Full slip stage guarantees maximum natural sugar (10–13° Brix) and peak aroma.",
        caution: "Harvesting premature melons results in rubbery, tasteless fruit.",
      },
    ],
    irrigation:
      "Irrigate every 5–7 days in furrow or through drip daily. Cut off water 4–5 days before picking.",
    nutrientManagement:
      "Follow soil-test recommendations. Standard guideline: N:P2O5:K2O @ 80:50:50 kg/ha (apply N in 3 splits: 1/3 basal, 1/3 at vining, 1/3 at fruit set).",
    weedManagement:
      "Hand weeding and shallow hoeing before vine spread; plastic mulching eliminates weed competition.",
    pestDiseaseMonitoring: [
      {
        name: "Fruit Fly (Bactrocera cucurbitae)",
        type: "pest",
        symptomsOrTiming:
          "Female fly punctures tender fruits; maggots feed inside causing rotting and premature drop.",
        management:
          "Install cue-lure pheromone traps @ 10/ha; spray bait spray (10g jaggery + 1 ml Malathion 50% EC/L).",
      },
      {
        name: "Powdery Mildew (Podosphaera xanthii)",
        type: "disease",
        symptomsOrTiming: "White talcum-like powder on leaves and stems under dry warm weather.",
        management: "Spray Wettable Sulphur @ 2 g/L or Azoxystrobin 23% SC @ 1 ml/L.",
      },
    ],
    harvest:
      "Pick fruits in early morning when slip stage is reached; handle gently to avoid rind bruising.",
    postHarvest:
      "Grade by size and netting; pre-cool to 7–10°C; shelf life is 7–10 days at 5–7°C and 90% RH.",
    importantNotes: [
      "Drip fertigation with plastic mulch yields up to 40% higher fruit with superior TSS (>12° Brix).",
    ],
    regionalCaution:
      "Spring-summer crops in North India must be timed to ripen before pre-monsoon showers begin.",
    sources: [
      {
        organization: "ICAR - Indian Institute of Horticultural Research (IIHR), Bengaluru",
        title: "Muskmelon Cultivation Package of Practices",
        url: "https://iihr.res.in",
        accessedDate: "2026-09-15",
      },
    ],
  },

  orange: {
    crop: "orange",
    displayName: "Orange (Mandarin / Nagpur Santra)",
    category: "Fruit",
    durationDays: 240,
    waterRequirement: "High (900–1200 mm)",
    overview:
      "Mandarin Orange (Citrus reticulata), especially the famed Nagpur Mandarin, is India's leading citrus crop grown under subtropical conditions for fresh fruit and processing.",
    suitableClimate:
      "Subtropical climate with 20–32°C temperature and well-defined winter rest period. High humidity at harvest causes fruit decay.",
    soilRequirements:
      "Deep, well-drained, light to medium loam or black soil with good subsoil drainage, pH 6.5–7.5, and free of calcium carbonate hardpans.",
    seasons:
      "Two main crop seasons in Central India: Ambe Bahar (February flowering, harvested Nov–Dec) and Mrig Bahar (June–July flowering, harvested Feb–March).",
    plantingMaterial:
      "Shield budded plants on disease-tolerant rootstocks (Rangpur Lime or Rough Lemon). Varieties: Nagpur Mandarin, Coorg Mandarin, Kinnow (hybrid).",
    landPreparation:
      "Pits of 1m × 1m × 1m dug in summer, filled with topsoil, 40 kg FYM, and 1 kg single superphosphate.",
    sowingOrPlanting:
      "Plant during monsoon (July–August). Spacing: 6 m × 6 m (277 trees/ha) or high-density 5 m × 5 m / 6 m × 3 m on drip.",
    growthStages: [
      {
        index: 1,
        title: "Bahar Treatment (Stress & Flowering Induction)",
        what: "Withhold irrigation for 30–45 days prior to flowering to induce water stress.",
        when: "December (Ambe bahar) or April–May (Mrig bahar)",
        why: "Controlled moisture stress forces vegetative rest and triggers flower bud emergence upon re-watering.",
        caution: "Severe water stress on shallow soils can cause tree defoliation and dieback.",
      },
      {
        index: 2,
        title: "Flowering & Fruit Set",
        what: "Resume irrigation with light watering followed by full dose. Apply recommended fertilizers.",
        when: "February–March (Ambe) / June–July (Mrig)",
        why: "Profuse fragrant blossoms set marble-sized fruitlets.",
        caution: "Never flood dry soil suddenly; causes massive flower and young fruit drop.",
      },
      {
        index: 3,
        title: "Fruit Enlargement & June Drop",
        what: "Maintain regular drip irrigation. Spray 2,4-D (10 ppm) to prevent physiological fruit drop.",
        when: "Months 2–4 after fruit set",
        why: "Cells expand rapidly; tree naturally sheds excess fruitlets it cannot nourish.",
        caution: "Drought at this stage results in thick-skinned, small, dry fruit.",
      },
      {
        index: 4,
        title: "Color Break & Ripening",
        what: "Peel turns from dark green to bright orange/yellow as chlorophyll degrades.",
        when: "Months 7–9 after fruit set",
        why: "Brix-to-acid ratio peaks for optimal sweet-tart flavor.",
        caution: "Protect ripening crop from fruit-sucking moth and citrus canker.",
      },
    ],
    irrigation:
      "Drip irrigation is strongly advised. Water requirement: 40–60 L/tree/day in winter, 80–100 L/tree/day in hot summer.",
    nutrientManagement:
      "Follow leaf-analysis guidelines. Bearing tree (8+ years): 600g N, 200g P2O5, 300g K2O + 40 kg FYM per tree per year applied in split doses matching the chosen Bahar.",
    weedManagement:
      "Keep tree basin weed-free; spray Glyphosate between rows or grow green manure (sunnhemp) in monsoon.",
    pestDiseaseMonitoring: [
      {
        name: "Citrus Psylla (Diaphorina citri)",
        type: "pest",
        symptomsOrTiming:
          "Nymphs suck sap from tender flushes; primary vector of incurable Citrus Greening (Huanglongbing).",
        management:
          "Spray Imidacloprid 17.8% SL @ 0.4 ml/L or Thiamethoxam 25% WG @ 0.3 g/L at new flush emergence.",
      },
      {
        name: "Phytophthora Gummosis / Foot Rot",
        type: "disease",
        symptomsOrTiming: "Gum exudation from trunk base and bark cracking.",
        management:
          "Paint trunk base with Bordeaux paste; drench root zone with Metalaxyl-Mancozeb @ 2.5 g/L.",
      },
    ],
    harvest:
      "Clip mature fruits with fruit clippers leaving short button stalk. Do not pluck by hand.",
    postHarvest:
      "Wash, wax with food-grade wax, grade by diameter, and pack in ventilated corrugated boxes; store at 6–7°C and 85–90% RH.",
    importantNotes: [
      "Rangpur Lime rootstock provides superior resistance to Phytophthora and salinity compared to standard seedling trees.",
    ],
    regionalCaution:
      "Choose between Ambe Bahar and Mrig Bahar based on local summer water availability.",
    sources: [
      {
        organization: "ICAR - Central Citrus Research Institute (CCRI), Nagpur",
        title: "Nagpur Mandarin Cultivation Package of Practices",
        url: "https://ccri.icar.gov.in",
        accessedDate: "2026-09-15",
      },
    ],
  },

  papaya: {
    crop: "papaya",
    displayName: "Papaya",
    category: "Fruit",
    durationDays: 270,
    waterRequirement: "High (1200–1500 mm)",
    overview:
      "Papaya (Carica papaya) is a fast-growing, heavy-yielding herbaceous fruit plant producing ripe table fruit and papain within 9–10 months from planting.",
    suitableClimate:
      "Tropical to warm subtropical climate with 22–32°C. Highly susceptible to frost and cannot tolerate water stagnation for even 12 hours.",
    soilRequirements:
      "Well-drained deep rich loam or sandy loam with pH 6.0–7.0. Drainage is the single most critical factor.",
    seasons: "Planting done in Spring (Feb–March), Monsoon (June–July), or Autumn (Sept–Oct).",
    plantingMaterial:
      "Certified seed of gynodioecious varieties (Red Lady 786, Taiwan 786, Arka Prabhat) or dioecious varieties (Pusa Dwarf, Pusa Delicious). Seed rate: 100g/ha for gynodioecious, 400g/ha for dioecious.",
    landPreparation:
      "Plough deeply, level well, and construct raised beds or mounds. Dig pits of 45 cm × 45 cm × 45 cm.",
    sowingOrPlanting:
      "Raise seedlings in pro-trays for 45–60 days. Plant on mounds. Spacing: 1.8 m × 1.8 m (3086 plants/ha) or 2.1 m × 2.1 m.",
    growthStages: [
      {
        index: 1,
        title: "Seedling Establishment & Vegetative Growth",
        what: "Transplant sturdy seedlings. Provide light daily irrigation; guard against damping-off.",
        when: "Months 1–3 after planting",
        why: "Rapid hollow trunk growth and broad leaf canopy formation.",
        caution: "Water stagnation around stem base causes instant collar rot (Pythium).",
      },
      {
        index: 2,
        title: "Sex Identification & Roguing (Dioecious only)",
        what: "Identify flower buds at month 3–4. In dioecious cultivars, remove excess male plants, retaining 1 male per 10 females.",
        when: "Months 3–4 after planting",
        why: "Gynodioecious varieties (Red Lady) produce 100% productive trees; dioecious need male roguing.",
        caution: "Failure to rogue male plants leads to unproductive orchards.",
      },
      {
        index: 3,
        title: "Flowering & Continuous Fruit Set",
        what: "Solitary or clustered flowers appear in leaf axils. Apply balanced N and K fertigation.",
        when: "Months 4–7 after planting",
        why: "Fruit develops sequentially along the stem as it grows upward.",
        caution: "Thin overcrowded fruits on the trunk to allow proper sizing.",
      },
      {
        index: 4,
        title: "Fruit Maturation & Harvesting",
        what: "Latex turns watery and fruit skin changes from dark green to yellow streaks at the apex.",
        when: "Months 8–12 onwards (continuous for 1.5–2 years)",
        why: "Color break indicates fruit will ripen properly off the tree.",
        caution: "Never leave fully yellow fruit on tree; birds and bats destroy them.",
      },
    ],
    irrigation:
      "Drip irrigation or ring system. Never let water touch the trunk base directly. Provide 15–25 L/plant/day in summer.",
    nutrientManagement:
      "Follow soil-test recommendations. Standard guideline: 200g N, 200g P2O5, 250g K2O per plant per year applied in 6 bi-monthly split applications.",
    weedManagement:
      "Maintain clean basin with shallow manual hoeing. Do not disturb surface feeder roots.",
    pestDiseaseMonitoring: [
      {
        name: "Papaya Ring Spot Virus (PRSV) / Aphid vector",
        type: "disease",
        symptomsOrTiming:
          "Mottling and shoe-stringing of leaves with oily rings on fruit and petioles.",
        management:
          "Grow under insect-proof net in nursery; spray systemic insecticide for aphids; rogue severely infected plants immediately.",
      },
      {
        name: "Collar Rot / Stem Rot (Pythium aphanidermatum)",
        type: "disease",
        symptomsOrTiming: "Water-soaked lesions at soil line causing plant to topple.",
        management:
          "Plant on raised beds; drench stem base with Copper Oxychloride @ 3 g/L or Metalaxyl @ 2 g/L.",
      },
    ],
    harvest:
      "Pick with twisting motion when apex shows 1–2 yellow streaks (color break stage). Handle with cotton gloves.",
    postHarvest:
      "Wash latex off, wrap in soft paper, pack in single-layer cartons; store at 10–12°C for 2–3 weeks shelf life.",
    importantNotes: [
      "Papaya is an ultra-fast commercial crop; complete orchard life cycle is typically 2.5–3 years before replanting.",
    ],
    regionalCaution:
      "Strictly avoid heavy soils without drainage; frost or freezing wind causes instantaneous tree mortality.",
    sources: [
      {
        organization: "ICAR - Indian Institute of Horticultural Research (IIHR), Bengaluru",
        title: "Papaya Cultivation Guide",
        url: "https://iihr.res.in",
        accessedDate: "2026-09-15",
      },
    ],
  },

  pomegranate: {
    crop: "pomegranate",
    displayName: "Pomegranate (Anar)",
    category: "Fruit",
    durationDays: 160,
    waterRequirement: "Medium (500–700 mm)",
    overview:
      "Pomegranate (Punica granatum) is a hardy, high-value commercial arid/semi-arid fruit crop adapted to marginal soils, renowned for Bhagwa variety exports.",
    suitableClimate:
      "Semi-arid tropical to subtropical climate with hot dry summers (35–40°C) and cool winters. Low humidity during fruit maturity produces spotless, high-luster arils.",
    soilRequirements:
      "Light, deep, well-drained loamy or alluvial soil with pH 6.5–8.0. Tolerates moderate salinity and lime (calcareous soils).",
    seasons:
      "Regulated via Bahar treatment: Hasta Bahar (Sept–Oct flowering, harvested Feb–April — most preferred for export quality).",
    plantingMaterial:
      "Hardwood or semi-hardwood cuttings or air-layered plants from disease-free mother blocks. Predominant variety: Bhagwa (Sindhuri), Arakta, Mridula.",
    landPreparation:
      "Subsoil ploughing; pits of 60 cm × 60 cm × 60 cm dug in summer, filled with 20 kg FYM, 1 kg neem cake, and 500g single superphosphate.",
    sowingOrPlanting:
      "Plant in monsoon (July–August). Spacing: 4.5 m × 3.0 m (740 plants/ha) or 4.0 m × 3.0 m (833 plants/ha) with drip irrigation.",
    growthStages: [
      {
        index: 1,
        title: "Formative Pruning & Multi-Stem Training",
        what: "Train plant to 3–4 strong main stems from ground level. Prune ground suckers continuously.",
        when: "Years 1–2 after planting",
        why: "Multi-stem bush system prevents total tree loss if stem borer attacks one trunk.",
        caution: "Do not allow fruit set in the first two years.",
      },
      {
        index: 2,
        title: "Bahar Treatment (Stress & Defoliation)",
        what: "Withhold irrigation for 35–45 days. Spray Ethrel (2 ml/L) to induce complete leaf shedding.",
        when: "August–September (for Hasta Bahar)",
        why: "Synchronized defoliation forces uniform bud burst and heavy hermaphrodite flower emergence.",
        caution: "Over-stressing on light soils leads to branch dieback.",
      },
      {
        index: 3,
        title: "Flowering & Fruit Set",
        what: "Resume irrigation gradually. Apply first split of fertilizers and prophylactic sprays for blight.",
        when: "October–November",
        why: "Hermaphrodite flowers set into fruitlets; pollination by insects is vital.",
        caution: "Water stress immediately after fruit set causes heavy fruitlet drop.",
      },
      {
        index: 4,
        title: "Fruit Growth & Bagging",
        what: "Bag fruitlets at 50 mm size with butter paper / non-woven bags. Spray calcium and boron.",
        when: "December–February",
        why: "Bagging eliminates fruit borer and thrips damage and produces spotless dark red rinds.",
        caution:
          "Fluctuating soil moisture during late fruit fill causes devastating rind cracking.",
      },
      {
        index: 5,
        title: "Harvesting at Full Maturity",
        what: "Harvest when rind turns deep saffron/red and base calyx turns inward; tapping gives metallic sound.",
        when: "February–April (150–160 days after flowering)",
        why: "Arils develop deep ruby red color and sweet taste (15–16° Brix).",
        caution: "Non-climacteric; do not pick unripe fruits.",
      },
    ],
    irrigation:
      "Drip irrigation is mandatory. Regulate water strictly; keep soil moisture uniform during fruit development to prevent fruit splitting.",
    nutrientManagement:
      "Follow leaf-nutrient standards. Bearing tree (5+ years): 625g N, 250g P2O5, 500g K2O + 30 kg FYM per plant per year applied in split doses matching the Bahar.",
    weedManagement:
      "Keep tree basin clean with manual hoeing; maintain organic straw or bagasse mulch (10 cm thick) around canopy.",
    pestDiseaseMonitoring: [
      {
        name: "Bacterial Blight / Telya (Xanthomonas axonopodis pv. punicae)",
        type: "disease",
        symptomsOrTiming:
          "Water-soaked dark oily spots on leaves, stems, and typical L-shaped cracks on fruit.",
        management:
          "Prune and burn infected twigs; spray Streptocycline (0.5 g/L) + Copper Oxychloride @ 2.5 g/L or 2-Bromo-2-nitropropane-1,3-diol (Bacteromycin @ 0.5 g/L).",
      },
      {
        name: "Pomegranate Butterfly / Fruit Borer (Deudorix isocrates)",
        type: "pest",
        symptomsOrTiming:
          "Caterpillar bores into fruit, feeds on arils, leaving offensive frass at entry hole.",
        management:
          "Bag fruits at 30–40 days after fruit set; spray Chlorantraniliprole 18.5% SC @ 0.3 ml/L on egg sighting.",
      },
    ],
    harvest:
      "Cut fruits with secateurs close to stem. Grade by weight (Super: >400g, Deluxe: 350–400g).",
    postHarvest:
      "Clean, treat with anti-fungal dip, pack in 4 kg corrugated cartons; store at 5–7°C and 90–95% RH for up to 2 months.",
    importantNotes: [
      "Bagging developing fruits with paper bags is the single most effective IPM technique to eliminate fruit borer and fungal spots.",
    ],
    regionalCaution:
      "Bacterial blight is devastating in high-rainfall humid seasons. Hasta Bahar (winter crop) avoids the monsoon disease peak.",
    sources: [
      {
        organization: "ICAR - National Research Centre on Pomegranate (NRCP), Solapur",
        title: "Pomegranate Cultivation and Disease Management Guide",
        url: "https://nrcpomegranate.icar.gov.in",
        accessedDate: "2026-09-15",
      },
    ],
  },

  watermelon: {
    crop: "watermelon",
    displayName: "Watermelon (Tarbooz)",
    category: "Fruit",
    durationDays: 90,
    waterRequirement: "Medium (400–500 mm)",
    overview:
      "Watermelon (Citrullus lanatus) is a widely grown warm-season commercial cucurbit yielding sweet, hydrating fruits with high lycopene content.",
    suitableClimate:
      "Warm dry sunny climate with daytime temperature of 28–35°C. High humidity increases foliage diseases and lowers sugar content.",
    soilRequirements:
      "Deep, well-drained sandy loams, alluvial, or riverbed soils with pH 6.0–7.2. Sensitive to water stagnation and saline soils.",
    seasons:
      "Spring-Summer (sown December–February in peninsular India; February–March in northern plains).",
    plantingMaterial:
      "Certified hybrid seeds (Sugar Baby, Arka Manik, Pusa Bedana seedless, commercial icebox hybrids like Kiran, Max). Seed rate: 2.0–2.5 kg/ha for open-pollinated, 1.0–1.2 kg/ha for hybrids.",
    landPreparation:
      "Plough to a fine tilth; prepare raised beds with drip lateral and silver-black plastic mulch (25 micron) for high commercial yield.",
    sowingOrPlanting:
      "Sow on raised beds at 2.0–2.5 m between rows and 60 cm between plants, 2 seeds per hill at 2–3 cm depth.",
    growthStages: [
      {
        index: 1,
        title: "Sowing & Stand Establishment",
        what: "Seed treatment with Trichoderma (4g/kg) and moist bed germination.",
        when: "Days 1–10 after sowing",
        why: "Uniform stand density is essential for high yield.",
        caution: "Cold soil (<18°C) causes seed rot; use seedling pro-trays in early winter.",
      },
      {
        index: 2,
        title: "Vine Run & Lateral Pinching",
        what: "Main vines elongate rapidly. Thin to 1 plant per hill. Apply nitrogenous fertigation.",
        when: "Days 15–30 after sowing",
        why: "Vigorous vine growth builds leaf area index for photosynthesizing large melons.",
        caution: "Do not walk on or shift vines once spreading starts.",
      },
      {
        index: 3,
        title: "Flowering & Fruit Set",
        what: "Yellow flowers open in early morning. Keep honeybee boxes (2–3/ha).",
        when: "Days 35–50 after sowing",
        why: "Honeybees must visit each female flower 8–10 times for complete fruit set.",
        caution: "Prohibit morning pesticide spraying during active bloom.",
      },
      {
        index: 4,
        title: "Fruit Enlargement & Sugar Development",
        what: "Retain 2–3 fruits per vine; remove deformed melons. Apply potassium-rich fertigation.",
        when: "Days 50–75 after sowing",
        why: "Rapid cell expansion and sugar accumulation take place.",
        caution:
          "Avoid erratic watering; sudden heavy irrigation after drought causes fruit cracking.",
      },
      {
        index: 5,
        title: "Maturity & Harvest",
        what: "Tendril at fruit node dries completely; ground spot turns creamy yellow; dull thud sound on tapping.",
        when: "Days 75–95 after sowing",
        why: "Non-climacteric fruit; sugar does not increase after picking.",
        caution: "Harvest with short stalk attached using a sharp knife.",
      },
    ],
    irrigation:
      "Irrigate every 4–6 days in open field or daily via drip. Taper off irrigation 4–5 days prior to picking to concentrate sugars.",
    nutrientManagement:
      "Follow soil-test recommendations. Standard guideline: N:P2O5:K2O @ 100:60:80 kg/ha (apply N in 3 splits; high K during fruit sizing).",
    weedManagement:
      "Hand weeding before vine spread; silver-black plastic mulch suppresses weeds and conserves moisture.",
    pestDiseaseMonitoring: [
      {
        name: "Red Pumpkin Beetle (Aulacophora foveicollis)",
        type: "pest",
        symptomsOrTiming:
          "Adult beetles cut circular holes in cotyledons and young leaves of seedlings.",
        management:
          "Dust neem cake or spray Carbaryl 50% WP @ 2 g/L or Chlorpyrifos 20% EC @ 2 ml/L on seedling emergence.",
      },
      {
        name: "Downy Mildew (Pseudoperonospora cubensis)",
        type: "disease",
        symptomsOrTiming:
          "Angular yellow lesions restricted by veins on upper leaf surface with purple downy growth beneath.",
        management: "Spray Metalaxyl-Mancozeb (Ridomil MZ) @ 2 g/L or Cymoxanil-Mancozeb @ 2 g/L.",
      },
    ],
    harvest:
      "Pick when fruit base ground spot turns creamy yellow and tendril is dry. Cut with sharp knife leaving 2 cm stem.",
    postHarvest:
      "Stack in straw-padded trucks; do not stack more than 4 layers; store at 10–12°C and 85–90% RH for 2–3 weeks.",
    importantNotes: [
      "Plastic mulch and drip fertigation increase yield by 35–50% and advance harvest by 10–15 days.",
    ],
    regionalCaution:
      "Harvest before pre-monsoon showers begin; rain on mature melons causes cracking and rapid spoilage.",
    sources: [
      {
        organization: "ICAR - Indian Institute of Horticultural Research (IIHR), Bengaluru",
        title: "Watermelon Production Guide",
        url: "https://iihr.res.in",
        accessedDate: "2026-09-15",
      },
    ],
  },
};

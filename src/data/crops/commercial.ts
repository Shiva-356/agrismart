import type { CropCultivationGuide } from "./types";

export const commercialGuides: Record<
  "cotton" | "jute" | "coconut" | "coffee",
  CropCultivationGuide
> = {
  cotton: {
    crop: "cotton",
    displayName: "Cotton (Kapas)",
    category: "Fibre & Commercial",
    durationDays: 165,
    waterRequirement: "Medium to High (600–800 mm)",
    overview:
      "Cotton (Gossypium hirsutum / arboreum), the 'White Gold', is India's principal commercial fibre and oilseed crop grown predominantly under semi-arid conditions.",
    suitableClimate:
      "Warm subtropical to tropical climate with 21–32°C. Requires at least 180–200 frost-free days and bright sunny weather during boll opening.",
    soilRequirements:
      "Deep black cotton soils (Vertisols) or deep fertile alluvium with high water holding capacity and pH 6.5–8.0. Unsuitable in waterlogged or acidic soils.",
    seasons:
      "Kharif (sown April–May in North India; June–July in Central and Southern India with monsoon onset).",
    plantingMaterial:
      "Certified Bt hybrid seed (BG-II). Seed rate: 2.0–2.5 kg/ha (approx. 2 packets Bt cotton + non-Bt refuge).",
    landPreparation:
      "Deep summer ploughing (25–30 cm) followed by 2 harrowings and ridging. Raised beds or ridges and furrows strongly advised.",
    sowingOrPlanting:
      "Sow on sides of ridges at 3–4 cm depth. Spacing: 90 cm × 60 cm (Central/South) or 67.5 cm × 60 cm (North India); High Density Planting System (HDPS) uses 60 cm × 10 cm.",
    growthStages: [
      {
        index: 1,
        title: "Sowing & Seedling Establishment",
        what: "Treat non-Bt refuge seed. Maintain adequate moisture for uniform emergence. Dibble 1–2 seeds per hill.",
        when: "Days 1–20 after sowing",
        why: "Early seedling vigor and deep taproot penetration prevent early stunting.",
        caution:
          "Gap-filling must be completed within 10 DAS; later gap-filled plants remain stunted.",
      },
      {
        index: 2,
        title: "Square Initiation (Squaring)",
        what: "First floral buds (squares) appear. Apply first split of nitrogen and earth up soil around plants.",
        when: "Days 35–55 after sowing",
        why: "Square number determines the potential boll-bearing capacity.",
        caution:
          "Scout for sucking pests (jassids, thrips, whiteflies); do not spray broad-spectrum pyrethroids early.",
      },
      {
        index: 3,
        title: "Flowering & Peak Boll Setting",
        what: "Creamy-white flowers turn pink/purple after pollination. Critical irrigation stage.",
        when: "Days 60–95 after sowing",
        why: "Maximum water and nutrient demand occurs as bolls enlarge.",
        caution:
          "Severe water stress or continuous cloudy rain causes heavy square and flower shedding.",
      },
      {
        index: 4,
        title: "Boll Development & Maturation",
        what: "Bolls reach maximum size. Spray 1% Magnesium Sulphate + 1% Potassium Nitrate to prevent leaf reddening.",
        when: "Days 95–130 after sowing",
        why: "Fibre elongation and secondary wall thickening take place inside the developing boll.",
        caution: "Monitor for Pink Bollworm larvae inside green bolls.",
      },
      {
        index: 5,
        title: "Boll Bursting & Picking",
        what: "Bolls dry, split open, and expose fluffy white seed cotton. Pick in dry sunny weather.",
        when: "Days 135–180 after sowing (2–3 pickings at 15–20 day intervals)",
        why: "Timely picking prevents fibre discoloration and trash contamination.",
        caution:
          "Never pick wet cotton; moisture causes yellow staining and fungal heating in storage.",
      },
    ],
    irrigation:
      "Drip or alternate furrow irrigation. Critical moisture windows: Flowering, boll formation, and boll development. Stop irrigation when 30% bolls burst.",
    nutrientManagement:
      "Follow soil-test recommendations. Standard hybrid guideline: N:P2O5:K2O @ 120:60:60 kg/ha (apply N in 3–4 splits: basal, squaring, flowering, and boll development) + 25 kg ZnSO4 and 20 kg Sulphur/ha.",
    weedManagement:
      "Pendimethalin 30% EC @ 1.0 kg a.i./ha as pre-emergence within 2 days of sowing + inter-row cultivation (blade harrow) at 30 and 60 DAS.",
    pestDiseaseMonitoring: [
      {
        name: "Pink Bollworm (Pectinophora gossypiella)",
        type: "pest",
        symptomsOrTiming:
          "Rosetted flowers; larvae bore into green bolls, feeding on seeds and staining lint.",
        management:
          "Install pheromone traps @ 5/ha; spray Profenofos 50% EC @ 2 ml/L or Emamectin Benzoate 5% SG @ 0.4 g/L at ETL (8 moths/trap/night for 3 consecutive nights or 10% damaged bolls).",
      },
      {
        name: "Sucking Pest Complex (Jassids, Whitefly, Thrips)",
        type: "pest",
        symptomsOrTiming:
          "Down-curling of leaf margins ('hopper burn') and honey-dew accumulation.",
        management:
          "Seed treatment with Imidacloprid 70% WS; spray Flonicamid 50% WG @ 0.3 g/L or Diafenthiuron 50% WP @ 1 g/L.",
      },
    ],
    harvest:
      "Pick fully opened clean cotton in morning after dew dries. Keep cotton free of bracts, dry leaves, and dirt.",
    postHarvest:
      "Dry picked cotton on clean tarpaulin to 8% moisture. Store in dry, well-ventilated sheds segregated by picking lot.",
    importantNotes: [
      "Foliar spray of 2% DAP or Potassium Nitrate (1%) at flowering and boll setting substantially reduces flower drop.",
    ],
    regionalCaution:
      "High humidity and continuous rain in August–September favor bacterial blight and internal boll rot.",
    sources: [
      {
        organization: "ICAR - Central Institute for Cotton Research (CICR), Nagpur",
        title: "Cotton Production Technology and Pest Management Guidelines",
        url: "https://cicr.icar.gov.in",
        accessedDate: "2026-09-15",
      },
    ],
  },

  jute: {
    crop: "jute",
    displayName: "Jute (Pat / Golden Fibre)",
    category: "Fibre & Commercial",
    durationDays: 120,
    waterRequirement: "High (1000–1200 mm)",
    overview:
      "Jute (Corchorus olitorius / capsularis) is India's prime biodegradable natural bast fibre crop grown in the humid eastern and north-eastern river deltas.",
    suitableClimate:
      "Warm and humid tropical climate with 25–35°C temperature and relative humidity above 70–80%. Thrives with regular pre-monsoon showers.",
    soilRequirements:
      "Deep, rich, fertile alluvial soils of deltaic floodplains with pH 6.0–7.5. Capsularis tolerates periodic waterlogging; Olitorius prefers well-drained uplands.",
    seasons: "Pre-Kharif (sown mid-March to mid-May). Harvested July–August before Aman paddy.",
    plantingMaterial:
      "Certified seed of improved varieties: Olitorius / Tossa jute (JRO 524 / Navin, JRO 204, JRO 8432); Capsularis / White jute (JRC 517, JRC 698). Seed rate: 5–6 kg/ha for line sowing, 7–8 kg/ha for broadcast.",
    landPreparation:
      "Plough 3–4 times followed by laddering to obtain a very fine tilth free of clods. Good drainage is vital for early crop.",
    sowingOrPlanting:
      "Line sowing using seed drill at 25–30 cm row spacing and 5–7 cm plant spacing at 2–3 cm depth.",
    growthStages: [
      {
        index: 1,
        title: "Emergence & Thinning",
        what: "Tiny seeds germinate within 3–5 days. Two thinnings at 15 and 25 DAS to establish plant population (4.5–5 lakh/ha).",
        when: "Days 1–25 after sowing",
        why: "Dense initial stands prevent weed growth, but thinning is vital for thick unbranched stems.",
        caution: "Failure to thin plants in time leads to thin, weak, lodging-prone stems.",
      },
      {
        index: 2,
        title: "Active Vegetative Stem Elongation",
        what: "Plants grow rapidly up to 3–4 meters tall. Top dress nitrogen at 30 and 45 DAS.",
        when: "Days 30–75 after sowing",
        why: "Fibre cells develop in the bark phloem along the entire stem height.",
        caution: "Keep crop weed-free until canopy closes around 45 DAS.",
      },
      {
        index: 3,
        title: "Small Pod / Flowering Stage (Harvest Indicator)",
        what: "Harvest when 50% of plants show small pod formation. Do not wait for seed maturity.",
        when: "Days 100–120 after sowing",
        why: "Harvesting at small-pod stage yields the highest grade, lustrous fibre with maximum tensile strength.",
        caution:
          "Delayed harvest results in coarse, brittle, low-grade fibre with poor spinning quality.",
      },
      {
        index: 4,
        title: "Retting & Fibre Extraction",
        what: "Defoliate stems for 3–4 days in field; tie into bundles and submerge in slow-moving clean water using microbial consortium (CRIJAF Sona).",
        when: "12–18 days retting period in water",
        why: "Pectins and gums are decomposed by microbial enzymes, releasing pure bast fibre bundles.",
        caution:
          "Never submerge bundles with soil or mud; turns fibre black (shamla jute). Use water hyacinth or concrete blocks.",
      },
    ],
    irrigation:
      "Requires 1–2 irrigations for germination if pre-monsoon rains fail; subsequent growth is supported by monsoon rainfall.",
    nutrientManagement:
      "Follow soil-test recommendations. Standard guideline: N:P2O5:K2O @ 60:30:30 kg/ha for Olitorius, 80:40:40 kg/ha for Capsularis (apply N in 2 splits).",
    weedManagement:
      "Pre-emergence Pretilachlor 50% EC @ 0.9 kg a.i./ha within 48 hours of sowing + CRIJAF nail weeder at 20 DAS.",
    pestDiseaseMonitoring: [
      {
        name: "Yellow Mite (Polyphagotarsonemus latus)",
        type: "pest",
        symptomsOrTiming: "Down-curling and bronze discoloration of young apical leaves.",
        management: "Spray Fenpyroximate 5% EC @ 1.5 ml/L or Spiromesifen 22.9% SC @ 1 ml/L.",
      },
      {
        name: "Stem Rot (Macrophomina phaseolina)",
        type: "disease",
        symptomsOrTiming:
          "Dark brown necrotic lesions on stem near soil level causing stem breakage.",
        management:
          "Seed treatment with Carbendazim (2g/kg); maintain soil potassium balance; avoid water stagnation.",
      },
    ],
    harvest:
      "Cut stems flush with ground using sickle at small pod stage (110–120 DAS). Stack bundles upright in field for 3 days to shed leaves.",
    postHarvest:
      "Ret in clean pond/canal water (1:20 jute-to-water ratio) with CRIJAF Sona @ 4 kg/ton dry stems; strip fibre manually, wash in clean water, and sun dry on bamboo racks for 2–3 days to 14% moisture.",
    importantNotes: [
      "Retting water quality and microbial culture (CRIJAF Sona) shorten retting by 5–7 days and upgrade fibre quality by 1–2 grades.",
    ],
    regionalCaution:
      "Strictly cultivated in West Bengal, Assam, Bihar, and Odisha where adequate retting water bodies are available.",
    sources: [
      {
        organization:
          "ICAR - Central Research Institute for Jute and Allied Fibres (CRIJAF), Barrackpore",
        title: "Standard Package of Practices for Jute Cultivation & Retting",
        url: "https://crijaf.icar.gov.in",
        accessedDate: "2026-09-15",
      },
    ],
  },

  coconut: {
    crop: "coconut",
    displayName: "Coconut (Kalpavriksha)",
    category: "Plantation",
    durationDays: 365,
    waterRequirement: "High (1200–1800 mm)",
    overview:
      "Coconut (Cocos nucifera) is a perennial plantation palm yielding food, beverage, edible oil, fibre, and timber, forming the livelihood backbone of coastal and peninsular India.",
    suitableClimate:
      "Warm humid tropical maritime climate with 25–32°C temperature and well-distributed rainfall (>1500 mm/year). Sensitive to prolonged drought and frost.",
    soilRequirements:
      "Deep, rich, well-drained loamy, coastal sandy, alluvial, or red sandy loam soils with water table at 1–2 m and pH 5.5–7.5. Avoid heavy clay with poor drainage.",
    seasons: "Planting done in May–June with the onset of southwest monsoon.",
    plantingMaterial:
      "Quality 9–12 month-old seedlings with 6–8 broad leaves and early collar girth (>10 cm). Varieties: West Coast Tall (WCT), East Coast Tall (ECT), Chowghat Orange Dwarf (COD), Hybrid D×T (Kera Sankara, Chandra Sankara).",
    landPreparation:
      "Dig pits of 1m × 1m × 1m during summer; in low-lying soils, plant on raised mounds. Fill lower 50 cm with topsoil, FYM (25 kg), and 1 kg bone meal / rock phosphate.",
    sowingOrPlanting:
      "Square planting at 7.5 m × 7.5 m (177 palms/ha) to 8.0 m × 8.0 m. In single rows along bunds, spacing is 6.5 m.",
    growthStages: [
      {
        index: 1,
        title: "Seedling Establishment & Juvenile Care",
        what: "Provide shade in first two years during summer. Water regularly and mulch basin.",
        when: "Years 1–3 after planting",
        why: "Builds a robust, deep root bowl and broad stem base before trunk formation.",
        caution: "Never bury the collar region of the seedling too deep in the pit.",
      },
      {
        index: 2,
        title: "Trunk Formation & Vegetative Growth",
        what: "Gradually fill planting pit as palm grows. Apply annual scheduled fertilizers in two splits.",
        when: "Years 4–6 after planting",
        why: "Rapid expansion of crown leaf area (30–35 functioning fronds required for high bearing).",
        caution: "Scout for Rhinoceros Beetle in the central spear leaf crown.",
      },
      {
        index: 3,
        title: "First Flowering (Bearing Phase Initiation)",
        what: "First inflorescence (spathe) emerges in leaf axils. Tall varieties flower at 5–6 years; hybrids at 3.5–4 years.",
        when: "Years 5–7 onwards",
        why: "Transition from vegetative to continuous reproductive bearing phase.",
        caution: "Ensure regular irrigation during dry season to prevent button shedding.",
      },
      {
        index: 4,
        title: "Continuous Nut Development & Monthly Harvesting",
        what: "One spathe opens every month in mature palms. Nuts take 11–12 months from fertilization to full maturity.",
        when: "Ongoing continuous cycle for 60+ years",
        why: "Steady supply of tender nuts (7–8 months) or mature copra nuts (11–12 months).",
        caution:
          "Do not harvest immature nuts for copra; causes poor oil recovery and rubbery kernel.",
      },
    ],
    irrigation:
      "Drip irrigation @ 60–80 litres/palm/day. Alternatively, irrigate in basins of 2 m radius @ 200 L/palm every 4–5 days.",
    nutrientManagement:
      "Follow soil-test recommendations. Bearing adult palm standard guideline: 500g N, 320g P2O5, 1200g K2O + 500g MgSO4 + 50 kg FYM per palm per year applied in 2 splits (monsoon and post-monsoon).",
    weedManagement:
      "Mulch basin (2 m radius) with dried coconut fronds or coir pith (10 cm thick). Grow cover crops (Calopogonium, Pueraria) in interspaces.",
    pestDiseaseMonitoring: [
      {
        name: "Rhinoceros Beetle (Oryctes rhinoceros)",
        type: "pest",
        symptomsOrTiming: "V-shaped cuts on fronds and holes in soft spear leaf crown.",
        management:
          "Hook out beetles from crowns; place naphthalene balls (3–4 balls per palm) in leaf axils with sand; treat manure pits with Metarhizium anisopliae.",
      },
      {
        name: "Red Palm Weevil (Rhynchophorus ferrugineus)",
        type: "pest",
        symptomsOrTiming:
          "Chewed fibrous frass emerging from trunk holes and dull sound on tapping.",
        management:
          "Root feeding with Imidacloprid (10 ml + 10 ml water); install pheromone traps (Ferrolure+) @ 1 trap/2 ha.",
      },
    ],
    harvest:
      "Harvest bunches at 11–12 months for copra and oil (husk turns brown); harvest at 7–8 months for tender coconut water.",
    postHarvest:
      "De-husk with mechanical de-husker; crack nuts in half, dry in solar copra dryer to 6% moisture for high-grade milling copra.",
    importantNotes: [
      "Coconut requires high Potassium (1.2 kg K2O/palm/year) for nut weight and copra development.",
    ],
    regionalCaution:
      "Susceptible to Root (Wilt) disease in Kerala and Ganoderma basal stem rot in coastal Tamil Nadu and Andhra Pradesh.",
    sources: [
      {
        organization: "ICAR - Central Plantation Crops Research Institute (CPCRI), Kasaragod",
        title: "Coconut Production Technology Package",
        url: "https://cpcri.icar.gov.in",
        accessedDate: "2026-09-15",
      },
    ],
  },

  coffee: {
    crop: "coffee",
    displayName: "Coffee (Arabica & Robusta)",
    category: "Plantation",
    durationDays: 240,
    waterRequirement: "High (1500–2000 mm)",
    overview:
      "Coffee (Coffea arabica / canephora) is a world-renowned shade-grown perennial plantation crop cultivated under a two-tier forest canopy in the Western and Eastern Ghats of India.",
    suitableClimate:
      "Humid subtropical/tropical hill climate. Arabica thrives at 1000–1500 m MSL (15–25°C); Robusta thrives at 500–1000 m MSL (20–30°C). Requires blossom showers in March.",
    soilRequirements:
      "Deep, porous, fertile, well-drained volcanic or forest loam soils with high organic humus, pH 6.0–6.5. Free of waterlogging.",
    seasons:
      "Planting done in monsoon (July–August). Harvesting November–January (Arabica) and January–March (Robusta).",
    plantingMaterial:
      "Quality seedling basket plants (10–12 months old). Arabica varieties: S.795, Chandragiri, Selection 9; Robusta varieties: S.274, CxR (Congensis × Robusta).",
    landPreparation:
      "Select shade-covered hill slopes. Clear undergrowth; prepare contour terraces. Dig pits of 45 cm × 45 cm × 45 cm.",
    sowingOrPlanting:
      "Square or contour planting. Spacing: 2.0 m × 2.0 m (Arabica) or 3.0 m × 3.0 m (Robusta). Establish two-tier shade trees (Dadaps as temporary shade, Silver Oak, Albizia, Ficus as permanent shade).",
    growthStages: [
      {
        index: 1,
        title: "Planting & Formative Topping",
        what: "Transplant sturdy seedlings under shade. Top the main stem at 75 cm height for Arabica (100–120 cm for Robusta).",
        when: "Months 1–18 after planting",
        why: "Topping forces lateral primary branches to spread horizontally into a bearing umbrella bush.",
        caution: "Do not let secondary shoots grow unchecked; prune suckers regularly.",
      },
      {
        index: 2,
        title: "Blossom Showers & Floral Anthesis",
        what: "Crucial blossom irrigation / rainfall (25–40 mm) in February–March triggers synchronized snow-white blossom.",
        when: "February–March",
        why: "Flower buds remain dormant until stimulated by blossom showers; backing showers 3 weeks later ensure fruit set.",
        caution: "Failure of blossom showers leads to flower bud drying and crop failure.",
      },
      {
        index: 3,
        title: "Berry Expansion & Monsoon Shade Regulation",
        what: "Berries grow and solidify. Thin dense shade tree branches before monsoon to prevent leaf rust.",
        when: "June–September",
        why: "Optimal 50% diffused sunlight maximizes photosynthesis and reduces disease pressure.",
        caution: "Excessive shade causes droopy branches and low berry set.",
      },
      {
        index: 4,
        title: "Berry Ripening & Selective Hand Picking",
        what: "Berries turn bright crimson red ('cherries'). Hand-pick only fully ripe berries in multiple rounds.",
        when: "November–January (Arabica) / January–March (Robusta)",
        why: "Ripe cherries contain optimal mucilage sugars essential for specialty washed coffee cup quality.",
        caution: "Stripping green immature berries results in sour, defective coffee.",
      },
    ],
    irrigation:
      "Sprinkler irrigation for blossom and backing showers (February–April) is critical where dry spells extend beyond 60 days.",
    nutrientManagement:
      "Follow soil-test recommendations. Bearing Arabica standard guideline: 140 kg N, 90 kg P2O5, 140 kg K2O/ha/year applied in 4 split doses (pre-blossom, post-blossom, mid-monsoon, post-monsoon).",
    weedManagement:
      "Manual slash weeding or scuffling before post-monsoon manuring. Maintain thick leaf-litter mulch on soil.",
    pestDiseaseMonitoring: [
      {
        name: "Coffee White Stem Borer (Xylotrechus quadripes) - Arabica",
        type: "pest",
        symptomsOrTiming: "Ridges on trunk bark; yellowing and wilting of branches.",
        management:
          "Maintain good shade canopy; bark scraping of main trunk in April and October; swab with Chlorpyrifos 20% EC @ 2.5 ml/L.",
      },
      {
        name: "Coffee Leaf Rust (Hemileia vastatrix)",
        type: "disease",
        symptomsOrTiming:
          "Orange-yellow powdery spore spots on lower surface of leaves causing defoliation.",
        management:
          "Spray 0.5% Bordeaux mixture pre-monsoon and post-monsoon or Triadimefon 25% WP @ 0.5 g/L.",
      },
    ],
    harvest:
      "Selective hand picking of bright red ripe cherries in 3–4 rounds: fly picking, main picking, and stripping.",
    postHarvest:
      "Pulping on the day of harvest, fermenting for 24–36 hours, washing, and sun drying on tiled/cement yards to 10.5–11% parchment moisture.",
    importantNotes: [
      "Indian coffee is unique globally as it is 100% shade-grown under natural forest canopies.",
    ],
    regionalCaution:
      "Arabica is highly vulnerable to White Stem Borer; Robusta is preferred in lower altitudes and warmer tracts.",
    sources: [
      {
        organization: "Central Coffee Research Institute (CCRI) - Coffee Board of India",
        title: "Coffee Guide and Package of Practices",
        url: "https://coffeeboard.gov.in",
        accessedDate: "2026-09-15",
      },
    ],
  },
};

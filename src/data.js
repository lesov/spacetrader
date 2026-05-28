export const FUEL_RESOURCE_ID = "fuel";

export const campaign = {
  startYear: 2175,
  startLabel: "Late 2175",
  marketClimate: "Post-Enceladus realignment"
};

export const resources = [
  { id: "fuel", name: "Deuterium Fuel" },
  { id: "metals", name: "Refined Metals" },
  { id: "water", name: "Water Ice" },
  { id: "protein", name: "Protein Cultures" },
  { id: "biomaterials", name: "Medical Biomaterials" },
  { id: "quantum", name: "Quantum Components" },
  { id: "shipParts", name: "Ship Parts" },
  { id: "culture", name: "Cultural Data" },
  { id: "luxuries", name: "Luxury Goods" }
];

export const planets = [
  {
    id: "earth",
    name: "Earth",
    type: "Core world",
    factionAlignment: "Earth-aligned",
    riskLevel: "low",
    note: "Dominant financial and research center absorbing the shock of the Enceladus withdrawal",
    summary: "The system's reserve currency, elite universities, and largest naval bureaucracy all answer to Earth.",
    strategicContext: "Earth is still the market everyone prices against, but its leaders are cautious after the outer-system defeat.",
    produces: ["biomaterials", "quantum", "culture"],
    position: { x: 210, y: 190 },
    priceRanges: {
      fuel: { min: 32, max: 44 },
      metals: { min: 58, max: 76 },
      water: { min: 42, max: 58 },
      protein: { min: 32, max: 46 },
      biomaterials: { min: 34, max: 48 },
      quantum: { min: 58, max: 78 },
      shipParts: { min: 72, max: 96 },
      culture: { min: 18, max: 28 },
      luxuries: { min: 72, max: 98 }
    }
  },
  {
    id: "luna",
    name: "Luna",
    type: "Earth moon",
    factionAlignment: "Earth-aligned",
    riskLevel: "low",
    note: "Earth's closest ally and primary high-orbit shipyard",
    summary: "Lunar yards turn Earth capital and offworld metals into the hull sections every trader depends on.",
    strategicContext: "Luna is a dependable starter port with strong manufacturing margins and clear routes in every direction.",
    produces: ["fuel", "shipParts", "quantum"],
    position: { x: 235, y: 145 },
    priceRanges: {
      fuel: { min: 14, max: 20 },
      metals: { min: 44, max: 62 },
      water: { min: 40, max: 56 },
      protein: { min: 46, max: 64 },
      biomaterials: { min: 48, max: 66 },
      quantum: { min: 54, max: 74 },
      shipParts: { min: 42, max: 58 },
      culture: { min: 42, max: 58 },
      luxuries: { min: 68, max: 92 }
    }
  },
  {
    id: "mars",
    name: "Mars",
    type: "Planet",
    factionAlignment: "Mars-aligned",
    riskLevel: "moderate",
    note: "Confident industrial rival with strong fleets and early signs of economic strain",
    summary: "Mars still looks like Earth's peer in 2175, especially to anyone buying machinery, metals, or military-grade parts.",
    strategicContext: "Martian markets pay for prestige imports while exporting heavy industry at aggressive prices.",
    produces: ["metals", "shipParts", "protein"],
    position: { x: 285, y: 235 },
    priceRanges: {
      fuel: { min: 24, max: 34 },
      metals: { min: 18, max: 28 },
      water: { min: 46, max: 64 },
      protein: { min: 24, max: 34 },
      biomaterials: { min: 86, max: 118 },
      quantum: { min: 80, max: 108 },
      shipParts: { min: 40, max: 58 },
      culture: { min: 64, max: 88 },
      luxuries: { min: 82, max: 112 }
    }
  },
  {
    id: "venus",
    name: "Venus",
    type: "Floating commonwealth",
    factionAlignment: "neutral",
    riskLevel: "low",
    note: "Independent cloud cities built around deuterium and atmospheric chemistry",
    summary: "Venus sells to every bloc and guards its altitude sovereignty with careful neutrality.",
    strategicContext: "Fuel is cheap here, but the cities charge premiums for metals, ship parts, and frontier luxuries.",
    produces: ["fuel", "biomaterials", "luxuries"],
    position: { x: 160, y: 255 },
    priceRanges: {
      fuel: { min: 8, max: 13 },
      metals: { min: 62, max: 84 },
      water: { min: 36, max: 50 },
      protein: { min: 34, max: 48 },
      biomaterials: { min: 42, max: 58 },
      quantum: { min: 92, max: 124 },
      shipParts: { min: 92, max: 122 },
      culture: { min: 50, max: 68 },
      luxuries: { min: 46, max: 64 }
    }
  },
  {
    id: "mercury",
    name: "Mercury",
    type: "Corporate mining world",
    factionAlignment: "contested",
    riskLevel: "high",
    note: "Metal-rich mines divided among corporate concessions and restless permanent settlements",
    summary: "Mobile twilight cities and lava-tube habitats supply the inner system's most prized industrial feedstock.",
    strategicContext: "Mercury rewards traders who bring life-support cargo in and haul refined metals out.",
    produces: ["metals", "fuel", "shipParts"],
    position: { x: 110, y: 190 },
    priceRanges: {
      fuel: { min: 12, max: 18 },
      metals: { min: 12, max: 20 },
      water: { min: 74, max: 98 },
      protein: { min: 68, max: 92 },
      biomaterials: { min: 104, max: 138 },
      quantum: { min: 86, max: 116 },
      shipParts: { min: 50, max: 70 },
      culture: { min: 80, max: 108 },
      luxuries: { min: 96, max: 128 }
    }
  },
  {
    id: "ceres",
    name: "Ceres",
    type: "Belt station",
    factionAlignment: "independent",
    riskLevel: "moderate",
    note: "Unofficial Belt capital where prospectors, syndicates, and diplomats share docking rings",
    summary: "Ceres coordinates enough traffic to feel civilized, while the outer Belt remains a patchwork of claims.",
    strategicContext: "The Belt buys finished goods and exports water, metals, and whatever prospectors found this month.",
    produces: ["water", "metals", "luxuries"],
    position: { x: 355, y: 180 },
    priceRanges: {
      fuel: { min: 36, max: 50 },
      metals: { min: 24, max: 34 },
      water: { min: 14, max: 22 },
      protein: { min: 58, max: 78 },
      biomaterials: { min: 76, max: 104 },
      quantum: { min: 88, max: 118 },
      shipParts: { min: 78, max: 104 },
      culture: { min: 58, max: 78 },
      luxuries: { min: 44, max: 62 }
    }
  },
  {
    id: "io",
    name: "Io",
    type: "Jovian moon",
    factionAlignment: "Earth-aligned",
    riskLevel: "high",
    note: "Radiation-hardened energy moon powered by violent tidal geology",
    summary: "Io's crews sell power contracts and reactor inputs from stations that never forget Jupiter is overhead.",
    strategicContext: "Fuel and high-energy components are cheap, but protein cultures and biomaterials are costly hazard cargo.",
    produces: ["fuel", "quantum", "shipParts"],
    position: { x: 450, y: 135 },
    priceRanges: {
      fuel: { min: 12, max: 18 },
      metals: { min: 56, max: 74 },
      water: { min: 58, max: 78 },
      protein: { min: 76, max: 102 },
      biomaterials: { min: 96, max: 128 },
      quantum: { min: 60, max: 82 },
      shipParts: { min: 56, max: 78 },
      culture: { min: 72, max: 96 },
      luxuries: { min: 86, max: 116 }
    }
  },
  {
    id: "europa",
    name: "Europa",
    type: "Jovian moon",
    factionAlignment: "neutral",
    riskLevel: "low",
    note: "Ice-ocean research world with prestigious biolabs and careful neutrality",
    summary: "Europa's subsurface science makes it one of the few places where medical cargo is both cheap and trusted.",
    strategicContext: "Bring components and finished goods; leave with water, cultures, and biomedical exports.",
    produces: ["water", "protein", "biomaterials"],
    position: { x: 425, y: 200 },
    priceRanges: {
      fuel: { min: 30, max: 42 },
      metals: { min: 60, max: 82 },
      water: { min: 8, max: 14 },
      protein: { min: 18, max: 28 },
      biomaterials: { min: 36, max: 52 },
      quantum: { min: 108, max: 144 },
      shipParts: { min: 92, max: 124 },
      culture: { min: 50, max: 70 },
      luxuries: { min: 68, max: 94 }
    }
  },
  {
    id: "ganymede",
    name: "Ganymede",
    type: "Jovian moon",
    factionAlignment: "Earth-aligned",
    riskLevel: "low",
    note: "Major Jovian manufacturing port with independent commercial habits",
    summary: "Ganymede's cooperative yards build reliable equipment for both inner-system fleets and frontier traders.",
    strategicContext: "A balanced hub for moving ship parts, metals, and protein cultures between the inner and outer routes.",
    produces: ["metals", "shipParts", "protein"],
    position: { x: 485, y: 240 },
    priceRanges: {
      fuel: { min: 24, max: 34 },
      metals: { min: 22, max: 32 },
      water: { min: 22, max: 32 },
      protein: { min: 26, max: 38 },
      biomaterials: { min: 78, max: 104 },
      quantum: { min: 92, max: 124 },
      shipParts: { min: 44, max: 62 },
      culture: { min: 64, max: 86 },
      luxuries: { min: 74, max: 100 }
    }
  },
  {
    id: "callisto",
    name: "Callisto",
    type: "Jovian moon",
    factionAlignment: "Earth-aligned",
    riskLevel: "low",
    note: "Agricultural and ice-farming moon on Jupiter's safer outer track",
    summary: "Callisto feeds much of the Jovian system from quiet hydroponic caverns and open-handed farms.",
    strategicContext: "Protein and water are cheap here; advanced medical and quantum cargo sell well.",
    produces: ["protein", "water", "luxuries"],
    position: { x: 520, y: 300 },
    priceRanges: {
      fuel: { min: 28, max: 38 },
      metals: { min: 54, max: 72 },
      water: { min: 16, max: 24 },
      protein: { min: 14, max: 22 },
      biomaterials: { min: 82, max: 110 },
      quantum: { min: 100, max: 134 },
      shipParts: { min: 80, max: 106 },
      culture: { min: 58, max: 78 },
      luxuries: { min: 42, max: 60 }
    }
  },
  {
    id: "titan",
    name: "Titan",
    type: "Saturnian moon",
    factionAlignment: "Titan-influenced",
    riskLevel: "moderate",
    note: "Opening outer-system power with hydrocarbons, cold labs, and long planning horizons",
    summary: "Titan is not yet the system's great challenger, but traders already see the reform era taking shape.",
    strategicContext: "Fuel and advanced components are attractive here, while Titan pays for culture, metals, and ship parts.",
    produces: ["fuel", "quantum", "biomaterials"],
    position: { x: 610, y: 320 },
    priceRanges: {
      fuel: { min: 7, max: 12 },
      metals: { min: 70, max: 94 },
      water: { min: 52, max: 70 },
      protein: { min: 60, max: 82 },
      biomaterials: { min: 42, max: 58 },
      quantum: { min: 66, max: 88 },
      shipParts: { min: 88, max: 116 },
      culture: { min: 82, max: 110 },
      luxuries: { min: 78, max: 106 }
    }
  },
  {
    id: "enceladus",
    name: "Enceladus",
    type: "Saturnian moon",
    factionAlignment: "contested",
    riskLevel: "high",
    note: "Damaged outer-system moon still sorting out control after Earth's withdrawal",
    summary: "Its geysers make Enceladus valuable, but its docks are tense and supply manifests are political documents.",
    strategicContext: "Risk premiums are high; water and biomaterials are cheap when a convoy can actually dock.",
    produces: ["water", "biomaterials", "fuel"],
    position: { x: 650, y: 250 },
    priceRanges: {
      fuel: { min: 14, max: 22 },
      metals: { min: 82, max: 110 },
      water: { min: 10, max: 16 },
      protein: { min: 64, max: 88 },
      biomaterials: { min: 40, max: 56 },
      quantum: { min: 118, max: 158 },
      shipParts: { min: 112, max: 148 },
      culture: { min: 78, max: 106 },
      luxuries: { min: 92, max: 124 }
    }
  },
  {
    id: "triton",
    name: "Triton",
    type: "Outer-system moon",
    factionAlignment: "independent",
    riskLevel: "moderate",
    note: "Remote frontier settlement with exotic ices and long communication delays",
    summary: "Triton is far enough out that every cargo decision feels strategic and every arrival is local news.",
    strategicContext: "Frontier buyers pay heavily for manufactured goods and culture, then export fuel and ice.",
    produces: ["fuel", "water", "luxuries"],
    position: { x: 690, y: 120 },
    priceRanges: {
      fuel: { min: 18, max: 28 },
      metals: { min: 82, max: 110 },
      water: { min: 18, max: 28 },
      protein: { min: 78, max: 104 },
      biomaterials: { min: 92, max: 122 },
      quantum: { min: 132, max: 176 },
      shipParts: { min: 124, max: 166 },
      culture: { min: 108, max: 144 },
      luxuries: { min: 52, max: 72 }
    }
  }
];

export const startingPlayer = {
  credits: 1000,
  currentPlanetId: "luna",
  fuel: 30,
  cargoCapacity: 20
};

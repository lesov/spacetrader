export const FUEL_RESOURCE_ID = "fuel";

export const resources = [
  { id: "fuel", name: "Fuel" },
  { id: "ore", name: "Ore" },
  { id: "water", name: "Water" },
  { id: "food", name: "Food" },
  { id: "medicine", name: "Medicine" },
  { id: "electronics", name: "Electronics" }
];

export const planets = [
  {
    id: "aster",
    name: "Aster",
    note: "Industrial starter world",
    produces: ["fuel", "ore", "electronics"],
    position: { x: 140, y: 215 },
    priceRanges: {
      fuel: { min: 8, max: 12 },
      ore: { min: 18, max: 26 },
      water: { min: 44, max: 58 },
      food: { min: 48, max: 65 },
      medicine: { min: 94, max: 126 },
      electronics: { min: 72, max: 96 }
    }
  },
  {
    id: "brine",
    name: "Brine",
    note: "Agricultural and medical supply world",
    produces: ["water", "food", "medicine"],
    position: { x: 345, y: 115 },
    priceRanges: {
      fuel: { min: 22, max: 32 },
      ore: { min: 54, max: 72 },
      water: { min: 11, max: 17 },
      food: { min: 16, max: 24 },
      medicine: { min: 42, max: 58 },
      electronics: { min: 118, max: 154 }
    }
  },
  {
    id: "cinder",
    name: "Cinder",
    note: "Harsh mining and refining world",
    produces: ["fuel", "ore", "water"],
    position: { x: 520, y: 260 },
    priceRanges: {
      fuel: { min: 7, max: 11 },
      ore: { min: 15, max: 23 },
      water: { min: 22, max: 30 },
      food: { min: 62, max: 82 },
      medicine: { min: 104, max: 140 },
      electronics: { min: 128, max: 166 }
    }
  },
  {
    id: "helio",
    name: "Helio",
    note: "Wealthy trade hub",
    produces: ["food", "electronics", "medicine"],
    position: { x: 585, y: 95 },
    priceRanges: {
      fuel: { min: 24, max: 35 },
      ore: { min: 58, max: 76 },
      water: { min: 40, max: 54 },
      food: { min: 19, max: 27 },
      medicine: { min: 39, max: 54 },
      electronics: { min: 66, max: 88 }
    }
  },
  {
    id: "vesta",
    name: "Vesta",
    note: "Frontier supply world",
    produces: ["ore", "water", "food"],
    position: { x: 235, y: 335 },
    priceRanges: {
      fuel: { min: 18, max: 27 },
      ore: { min: 17, max: 25 },
      water: { min: 18, max: 26 },
      food: { min: 21, max: 31 },
      medicine: { min: 88, max: 118 },
      electronics: { min: 110, max: 148 }
    }
  }
];

export const startingPlayer = {
  credits: 1000,
  currentPlanetId: "aster",
  fuel: 30,
  cargoCapacity: 20
};

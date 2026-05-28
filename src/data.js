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
    id: "mars",
    name: "Mars",
    type: "Planet",
    note: "Terraforming-era industrial starter world",
    produces: ["ore", "food", "electronics"],
    position: { x: 285, y: 235 },
    priceRanges: {
      fuel: { min: 22, max: 32 },
      ore: { min: 17, max: 25 },
      water: { min: 48, max: 64 },
      food: { min: 21, max: 31 },
      medicine: { min: 92, max: 122 },
      electronics: { min: 68, max: 90 }
    }
  },
  {
    id: "europa",
    name: "Europa",
    type: "Jovian moon",
    note: "Ice-ocean biolabs and aquaculture",
    produces: ["water", "food", "medicine"],
    position: { x: 425, y: 160 },
    priceRanges: {
      fuel: { min: 28, max: 40 },
      ore: { min: 58, max: 78 },
      water: { min: 9, max: 15 },
      food: { min: 18, max: 27 },
      medicine: { min: 38, max: 54 },
      electronics: { min: 120, max: 158 }
    }
  },
  {
    id: "titan",
    name: "Titan",
    type: "Saturnian moon",
    note: "Hydrocarbon refineries and cryogenic research",
    produces: ["fuel", "medicine", "electronics"],
    position: { x: 585, y: 310 },
    priceRanges: {
      fuel: { min: 7, max: 11 },
      ore: { min: 66, max: 88 },
      water: { min: 52, max: 70 },
      food: { min: 66, max: 88 },
      medicine: { min: 44, max: 60 },
      electronics: { min: 74, max: 98 }
    }
  },
  {
    id: "mercury",
    name: "Mercury",
    type: "Planet",
    note: "Solar foundries and metals extraction",
    produces: ["ore", "fuel", "electronics"],
    position: { x: 140, y: 190 },
    priceRanges: {
      fuel: { min: 10, max: 15 },
      ore: { min: 14, max: 22 },
      water: { min: 62, max: 82 },
      food: { min: 58, max: 76 },
      medicine: { min: 102, max: 136 },
      electronics: { min: 62, max: 82 }
    }
  },
  {
    id: "ganymede",
    name: "Ganymede",
    type: "Jovian moon",
    note: "Frontier port and subsurface agriculture",
    produces: ["ore", "water", "food"],
    position: { x: 470, y: 250 },
    priceRanges: {
      fuel: { min: 24, max: 34 },
      ore: { min: 20, max: 28 },
      water: { min: 16, max: 24 },
      food: { min: 24, max: 34 },
      medicine: { min: 86, max: 116 },
      electronics: { min: 112, max: 150 }
    }
  },
  {
    id: "luna",
    name: "Luna",
    type: "Earth moon",
    note: "High-orbit manufacturing and medical logistics",
    produces: ["electronics", "medicine", "fuel"],
    position: { x: 230, y: 110 },
    priceRanges: {
      fuel: { min: 12, max: 18 },
      ore: { min: 44, max: 60 },
      water: { min: 38, max: 52 },
      food: { min: 46, max: 62 },
      medicine: { min: 40, max: 56 },
      electronics: { min: 58, max: 78 }
    }
  }
];

export const startingPlayer = {
  credits: 1000,
  currentPlanetId: "mars",
  fuel: 30,
  cargoCapacity: 20
};

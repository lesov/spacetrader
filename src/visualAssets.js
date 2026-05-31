import { planets } from "./data.js";
import { SHIP_CLASSES } from "./combat/data.js";

const VISUAL_BASE = "./src/assets/visuals";

export const LOCATION_VISUALS = {
  callisto: visual("locations/callisto.png", "Callisto agricultural ice-farming moon"),
  ceres: visual("locations/ceres.png", "Ceres belt station trade hub"),
  earth: visual("locations/earth.png", "Earth core world orbital trade hub"),
  enceladus: visual("locations/enceladus.png", "Enceladus contested geyser moon"),
  europa: visual("locations/europa.png", "Europa ice-ocean research world"),
  ganymede: visual("locations/ganymede.png", "Ganymede Jovian manufacturing port"),
  io: visual("locations/io.png", "Io radiation-hardened energy moon"),
  luna: visual("locations/luna.png", "Luna high-orbit shipyard"),
  mars: visual("locations/mars.png", "Mars industrial rival world"),
  mercury: visual("locations/mercury.png", "Mercury corporate mining world"),
  titan: visual("locations/titan.png", "Titan outer-system industrial moon"),
  triton: visual("locations/triton.png", "Triton remote frontier moon"),
  venus: visual("locations/venus.png", "Venus floating commonwealth")
};

export const ALIGNMENT_VISUALS = {
  "Earth-aligned": visual("alignments/earth-aligned.png", "Earth-aligned faction emblem"),
  "Mars-aligned": visual("alignments/mars-aligned.png", "Mars-aligned faction emblem"),
  "Titan-influenced": visual("alignments/titan-influenced.png", "Titan-influenced faction emblem"),
  contested: visual("alignments/contested.png", "Contested alignment emblem"),
  independent: visual("alignments/independent.png", "Independent alignment emblem"),
  neutral: visual("alignments/neutral.png", "Neutral alignment emblem")
};

export const SHIP_VISUALS = {
  bastion: visual("ships/bastion.png", "Bastion-class Gunboat"),
  falcon: visual("ships/falcon.png", "Falcon-class Skirmisher"),
  leviathan: visual("ships/leviathan.png", "Leviathan-class Freighter"),
  vanguard: visual("ships/vanguard.png", "Vanguard-class Cruiser")
};

export const BATTLE_DAMAGE_VISUALS = {
  light: visual("battle/light-damage.png", "Ship taking light battle damage"),
  moderate: visual("battle/moderate-damage.png", "Ship taking moderate battle damage"),
  critical: visual("battle/critical-damage.png", "Ship taking critical battle damage")
};

export const MAP_VISUAL = visual("map/starfield.png", "Solar System starfield route map");

export function getLocationVisual(planetId) {
  return LOCATION_VISUALS[planetId] ?? LOCATION_VISUALS.earth;
}

export function getAlignmentVisual(alignment) {
  return ALIGNMENT_VISUALS[alignment] ?? ALIGNMENT_VISUALS.neutral;
}

export function getShipVisual(classId) {
  return SHIP_VISUALS[classId] ?? SHIP_VISUALS.vanguard;
}

export function getBattleDamageVisual(ship) {
  const hullMax = Math.max(1, ship?.hullMax ?? 1);
  const hull = Math.max(0, ship?.hull ?? hullMax);
  const ratio = hull / hullMax;

  if (ratio <= 0.35) return BATTLE_DAMAGE_VISUALS.critical;
  if (ratio <= 0.7) return BATTLE_DAMAGE_VISUALS.moderate;
  return BATTLE_DAMAGE_VISUALS.light;
}

export function listRequiredVisualAssets() {
  return [
    MAP_VISUAL,
    ...planets.map((planet) => getLocationVisual(planet.id)),
    ...Object.keys(ALIGNMENT_VISUALS).map((alignment) => getAlignmentVisual(alignment)),
    ...Object.keys(SHIP_CLASSES).map((classId) => getShipVisual(classId)),
    ...Object.values(BATTLE_DAMAGE_VISUALS)
  ];
}

function visual(path, alt) {
  return {
    src: `${VISUAL_BASE}/${path}`,
    alt
  };
}

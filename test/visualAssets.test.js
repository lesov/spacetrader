import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import { planets } from "../src/data.js";
import { SHIP_CLASSES } from "../src/combat/data.js";
import {
  ALIGNMENT_VISUALS,
  BATTLE_DAMAGE_VISUALS,
  LOCATION_VISUALS,
  MAP_VISUAL,
  SHIP_VISUALS,
  getAlignmentVisual,
  getBattleDamageVisual,
  getLocationVisual,
  getShipVisual,
  listRequiredVisualAssets
} from "../src/visualAssets.js";

test("visual assets cover every trade location", () => {
  for (const planet of planets) {
    const asset = getLocationVisual(planet.id);
    assert.equal(asset, LOCATION_VISUALS[planet.id], planet.name);
    assert.match(asset.alt, new RegExp(planet.name, "i"));
  }
});

test("visual assets cover every faction alignment in market data", () => {
  const alignments = new Set(planets.map((planet) => planet.factionAlignment));

  for (const alignment of alignments) {
    assert.equal(getAlignmentVisual(alignment), ALIGNMENT_VISUALS[alignment], alignment);
  }
});

test("visual assets cover every ship class", () => {
  for (const classId of Object.keys(SHIP_CLASSES)) {
    const asset = getShipVisual(classId);
    assert.equal(asset, SHIP_VISUALS[classId], classId);
    assert.match(asset.alt, new RegExp(SHIP_CLASSES[classId].label, "i"));
  }
});

test("battle damage visual follows player hull condition", () => {
  assert.equal(getBattleDamageVisual({ hull: 100, hullMax: 100 }), BATTLE_DAMAGE_VISUALS.light);
  assert.equal(getBattleDamageVisual({ hull: 70, hullMax: 100 }), BATTLE_DAMAGE_VISUALS.moderate);
  assert.equal(getBattleDamageVisual({ hull: 35, hullMax: 100 }), BATTLE_DAMAGE_VISUALS.critical);
});

test("required generated visual asset files exist", () => {
  const assets = new Set(listRequiredVisualAssets().map((asset) => asset.src));
  assets.add(MAP_VISUAL.src);

  for (const src of assets) {
    const path = new URL(`../${src.replace(/^\.\//, "")}`, import.meta.url);
    assert.equal(existsSync(path), true, src);
  }
});

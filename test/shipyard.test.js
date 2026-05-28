import assert from 'node:assert/strict';
import test from 'node:test';

import { createInitialState, getEffectiveCargoCapacity, getEffectivePowerCapacity } from '../src/game.js';
import {
  CARGO_UPGRADE,
  POWER_UPGRADE,
  buyShip,
  canBuyShip,
  canUpgrade,
  getShipCatalog,
  getUpgradeCost,
  getUpgradeSpec,
  upgradeShip
} from '../src/shipyard.js';
import { SHIP_CLASSES } from '../src/combat/data.js';

// ── Helper to create a state ready for shipyard actions ──────────────────────

function makeShipyardState(overrides = {}) {
  const base = createInitialState();
  return {
    ...base,
    currentPlanetId: 'luna', // industrial world
    credits: 100000,
    cargo: { shipParts: 20 },
    ...overrides
  };
}

// ── Upgrade constants ─────────────────────────────────────────────────────────

test('CARGO_UPGRADE and POWER_UPGRADE are exported with correct step and max', () => {
  assert.equal(CARGO_UPGRADE.step, 6);
  assert.equal(CARGO_UPGRADE.max, 4);
  assert.equal(POWER_UPGRADE.step, 1);
  assert.equal(POWER_UPGRADE.max, 4);
});

// ── getShipCatalog ────────────────────────────────────────────────────────────

test('getShipCatalog returns purchasable ship classes', () => {
  const catalog = getShipCatalog();
  assert.ok(Array.isArray(catalog));
  assert.ok(catalog.length >= 4, 'Should have at least 4 purchasable classes');
  for (const entry of catalog) {
    assert.ok(entry.classId, 'classId required');
    assert.ok(entry.label, 'label required');
    assert.ok(typeof entry.price === 'number' && entry.price > 0, 'price must be positive');
    assert.ok(entry.cargoCapacity > 0, 'cargoCapacity must be positive');
    assert.ok(entry.powerCapacity > 0, 'powerCapacity must be positive');
  }
});

test('getShipCatalog includes falcon, vanguard, bastion, leviathan', () => {
  const catalog = getShipCatalog();
  const ids = catalog.map(e => e.classId);
  assert.ok(ids.includes('falcon'), 'falcon missing');
  assert.ok(ids.includes('vanguard'), 'vanguard missing');
  assert.ok(ids.includes('bastion'), 'bastion missing');
  assert.ok(ids.includes('leviathan'), 'leviathan missing');
});

test('better ships expose higher base power or cargo than the starter', () => {
  const vanguardCls = SHIP_CLASSES.vanguard;
  const bastionCls = SHIP_CLASSES.bastion;
  const leviathanCls = SHIP_CLASSES.leviathan;
  assert.ok(bastionCls.powerCapacity > vanguardCls.powerCapacity, 'bastion should have more power than vanguard');
  assert.ok(leviathanCls.cargoCapacity > vanguardCls.cargoCapacity, 'leviathan should have more cargo than vanguard');
});

// ── getUpgradeCost ────────────────────────────────────────────────────────────

test('getUpgradeCost returns correct parts and credits for each level', () => {
  const state = makeShipyardState();

  // Cargo level 1 (at level 0 → next level 1)
  const c1 = getUpgradeCost(state, 'cargo');
  assert.equal(c1.parts, 3);
  assert.equal(c1.credits, 1500);
  assert.equal(c1.nextLevel, 1);

  // After level 1 cargo upgrade
  const s1 = upgradeShip(state, 'cargo').state;
  const c2 = getUpgradeCost(s1, 'cargo');
  assert.equal(c2.parts, 4);
  assert.equal(c2.credits, 3000);
  assert.equal(c2.nextLevel, 2);

  // After level 2
  const s2 = upgradeShip(s1, 'cargo').state;
  const c3 = getUpgradeCost(s2, 'cargo');
  assert.equal(c3.parts, 5);
  assert.equal(c3.credits, 4500);

  // After level 3
  const s3 = upgradeShip(s2, 'cargo').state;
  const c4 = getUpgradeCost(s3, 'cargo');
  assert.equal(c4.parts, 6);
  assert.equal(c4.credits, 6000);
});

test('getUpgradeCost returns atMax when at max level', () => {
  let state = makeShipyardState();
  for (let i = 0; i < 4; i++) {
    state = upgradeShip(state, 'cargo').state;
  }
  const cost = getUpgradeCost(state, 'cargo');
  assert.equal(cost.atMax, true);
});

test('power upgrade cost table is correct', () => {
  const state = makeShipyardState();
  const p1 = getUpgradeCost(state, 'power');
  assert.equal(p1.parts, 4);
  assert.equal(p1.credits, 2500);

  const s1 = upgradeShip(state, 'power').state;
  const p2 = getUpgradeCost(s1, 'power');
  assert.equal(p2.parts, 5);
  assert.equal(p2.credits, 5000);

  const s2 = upgradeShip(s1, 'power').state;
  const p3 = getUpgradeCost(s2, 'power');
  assert.equal(p3.parts, 6);
  assert.equal(p3.credits, 7500);

  const s3 = upgradeShip(s2, 'power').state;
  const p4 = getUpgradeCost(s3, 'power');
  assert.equal(p4.parts, 7);
  assert.equal(p4.credits, 10000);
});

// ── canUpgrade ────────────────────────────────────────────────────────────────

test('canUpgrade returns ok at industrial world with sufficient parts and credits', () => {
  const state = makeShipyardState();
  const result = canUpgrade(state, 'cargo');
  assert.equal(result.ok, true);
});

test('canUpgrade fails when not at industrial world', () => {
  const state = makeShipyardState({ currentPlanetId: 'venus' });
  const result = canUpgrade(state, 'cargo');
  assert.equal(result.ok, false);
  assert.ok(result.reason.length > 0);
});

test('canUpgrade fails when insufficient Ship Parts', () => {
  const state = makeShipyardState({ cargo: { shipParts: 0 } });
  const result = canUpgrade(state, 'cargo');
  assert.equal(result.ok, false);
  assert.ok(result.reason.toLowerCase().includes('parts'));
});

test('canUpgrade fails when insufficient credits', () => {
  const state = makeShipyardState({ credits: 0 });
  const result = canUpgrade(state, 'cargo');
  assert.equal(result.ok, false);
  assert.ok(result.reason.toLowerCase().includes('credits'));
});

test('canUpgrade fails when already at max level', () => {
  let state = makeShipyardState();
  for (let i = 0; i < 4; i++) {
    state = upgradeShip(state, 'cargo').state;
  }
  const result = canUpgrade(state, 'cargo');
  assert.equal(result.ok, false);
  assert.ok(result.reason.toLowerCase().includes('maximum'));
});

// ── upgradeShip (cargo) ───────────────────────────────────────────────────────

test('cargo upgrade success: consumes Ship Parts, debits credits, increments level, raises cargoCapacity', () => {
  const state = makeShipyardState();
  const beforeParts = state.cargo.shipParts;
  const beforeCredits = state.credits;
  const cost = getUpgradeCost(state, 'cargo');

  const result = upgradeShip(state, 'cargo');

  assert.equal(result.ok, true);
  assert.equal(result.state.cargo.shipParts ?? 0, beforeParts - cost.parts);
  assert.equal(result.state.credits, beforeCredits - cost.credits);
  assert.equal(result.state.shipUpgrades.cargo, 1);
  assert.equal(result.state.cargoCapacity, getEffectiveCargoCapacity(result.state));
  assert.equal(result.state.cargoCapacity, SHIP_CLASSES.vanguard.cargoCapacity + CARGO_UPGRADE.step);
});

test('cargo upgrade raises effective cargo capacity by step per level', () => {
  let state = makeShipyardState();
  const baseCargo = getEffectiveCargoCapacity(state);
  for (let level = 1; level <= 4; level++) {
    state = upgradeShip(state, 'cargo').state;
    assert.equal(getEffectiveCargoCapacity(state), baseCargo + level * CARGO_UPGRADE.step);
    assert.equal(state.cargoCapacity, baseCargo + level * CARGO_UPGRADE.step);
  }
});

test('cargo upgrade fails with unchanged state when parts insufficient', () => {
  const state = makeShipyardState({ cargo: { shipParts: 0 } });
  const result = upgradeShip(state, 'cargo');
  assert.equal(result.ok, false);
  assert.equal(result.state.shipUpgrades.cargo, 0);
  assert.equal(result.state.cargoCapacity, state.cargoCapacity);
  assert.equal(result.state.credits, state.credits);
});

test('cargo upgrade fails with unchanged state when credits insufficient', () => {
  const state = makeShipyardState({ credits: 0 });
  const result = upgradeShip(state, 'cargo');
  assert.equal(result.ok, false);
  assert.equal(result.state.shipUpgrades.cargo, 0);
});

test('cargo upgrade fails when not at industrial world', () => {
  const state = makeShipyardState({ currentPlanetId: 'earth' });
  const result = upgradeShip(state, 'cargo');
  assert.equal(result.ok, false);
  assert.equal(result.state.shipUpgrades.cargo, 0);
});

test('cargo upgrade fails when already at max level', () => {
  let state = makeShipyardState();
  for (let i = 0; i < 4; i++) {
    state = upgradeShip(state, 'cargo').state;
  }
  const result = upgradeShip(state, 'cargo');
  assert.equal(result.ok, false);
  assert.equal(result.state.shipUpgrades.cargo, 4);
});

// ── upgradeShip (power/engine) ────────────────────────────────────────────────

test('engine upgrade success: debits parts and credits, raises effective power by step', () => {
  const state = makeShipyardState();
  const beforePower = getEffectivePowerCapacity(state);
  const cost = getUpgradeCost(state, 'power');

  const result = upgradeShip(state, 'power');

  assert.equal(result.ok, true);
  assert.equal(result.state.shipUpgrades.power, 1);
  assert.equal(getEffectivePowerCapacity(result.state), beforePower + POWER_UPGRADE.step);
  assert.equal(result.state.credits, state.credits - cost.credits);
  assert.equal(result.state.cargo.shipParts ?? 0, (state.cargo.shipParts ?? 0) - cost.parts);
});

test('engine upgrade raises effective power capacity by step per level', () => {
  // 4+5+6+7=22 parts needed for all 4 power upgrades
  let state = makeShipyardState({ cargo: { shipParts: 30 } });
  const basePower = getEffectivePowerCapacity(state);
  for (let level = 1; level <= 4; level++) {
    state = upgradeShip(state, 'power').state;
    assert.equal(getEffectivePowerCapacity(state), basePower + level * POWER_UPGRADE.step);
  }
});

test('engine upgrade fails when at max level', () => {
  let state = makeShipyardState({ cargo: { shipParts: 30 } });
  for (let i = 0; i < 4; i++) {
    state = upgradeShip(state, 'power').state;
  }
  const result = upgradeShip(state, 'power');
  assert.equal(result.ok, false);
  assert.equal(result.state.shipUpgrades.power, 4);
});

// ── canBuyShip ────────────────────────────────────────────────────────────────

test('canBuyShip returns ok at industrial world with enough credits for a different class', () => {
  const state = makeShipyardState({ credits: 50000 });
  const result = canBuyShip(state, 'bastion');
  assert.equal(result.ok, true);
});

test('canBuyShip fails when not at industrial world', () => {
  const state = makeShipyardState({ credits: 50000, currentPlanetId: 'triton' });
  const result = canBuyShip(state, 'bastion');
  assert.equal(result.ok, false);
});

test('canBuyShip fails when credits are insufficient', () => {
  const state = makeShipyardState({ credits: 100 });
  const result = canBuyShip(state, 'bastion');
  assert.equal(result.ok, false);
  assert.ok(result.reason.toLowerCase().includes('credits'));
});

test('canBuyShip fails when already flying that class', () => {
  const state = makeShipyardState();
  const result = canBuyShip(state, 'vanguard'); // already flying vanguard
  assert.equal(result.ok, false);
  assert.ok(result.reason.toLowerCase().includes('already'));
});

// ── buyShip ───────────────────────────────────────────────────────────────────

test('buyShip success: debits credits, swaps class, resets upgrades, refreshes hull/shield/cargo', () => {
  const state = makeShipyardState({
    credits: 100000,
    shipUpgrades: { cargo: 2, power: 1 } // non-zero upgrades should be reset
  });
  const beforeCredits = state.credits;
  const bastionCls = SHIP_CLASSES.bastion;

  const result = buyShip(state, 'bastion');

  assert.equal(result.ok, true);
  assert.equal(result.state.playerCombatShip.classId, 'bastion');
  assert.equal(result.state.shipUpgrades.cargo, 0, 'cargo upgrades should reset');
  assert.equal(result.state.shipUpgrades.power, 0, 'power upgrades should reset');
  assert.equal(result.state.credits, beforeCredits - bastionCls.price);
  assert.equal(result.state.cargoCapacity, bastionCls.cargoCapacity);
  assert.equal(result.state.playerCombatShip.hull, bastionCls.hullMax);
  assert.equal(result.state.playerCombatShip.shield, bastionCls.shieldMax);
  assert.equal(result.state.playerCombatShip.weapons.length, bastionCls.weapons.length);
});

test('buyShip effective cargo capacity reflects new class base', () => {
  const state = makeShipyardState({ credits: 100000 });
  const result = buyShip(state, 'leviathan');
  assert.equal(result.ok, true);
  assert.equal(result.state.cargoCapacity, SHIP_CLASSES.leviathan.cargoCapacity);
  assert.equal(getEffectiveCargoCapacity(result.state), SHIP_CLASSES.leviathan.cargoCapacity);
});

test('buyShip fails when not at industrial world', () => {
  const state = makeShipyardState({ currentPlanetId: 'ceres', credits: 100000 });
  const result = buyShip(state, 'bastion');
  assert.equal(result.ok, false);
  // State must be unchanged
  assert.equal(result.state.playerCombatShip.classId, 'vanguard');
  assert.equal(result.state.credits, state.credits);
});

test('buyShip fails when unaffordable', () => {
  const state = makeShipyardState({ credits: 100 });
  const result = buyShip(state, 'leviathan');
  assert.equal(result.ok, false);
  assert.equal(result.state.playerCombatShip.classId, 'vanguard');
  assert.equal(result.state.credits, 100);
});

test('buyShip fails when already flying that class', () => {
  const state = makeShipyardState({ credits: 100000 });
  const result = buyShip(state, 'vanguard');
  assert.equal(result.ok, false);
  assert.equal(result.state.playerCombatShip.classId, 'vanguard');
});

test('buyShip message appended to state.messages', () => {
  const state = makeShipyardState({ credits: 100000 });
  const result = buyShip(state, 'bastion');
  assert.equal(result.ok, true);
  assert.equal(result.state.messages[0], result.message);
});

test('upgradeShip message appended to state.messages', () => {
  const state = makeShipyardState();
  const result = upgradeShip(state, 'cargo');
  assert.equal(result.ok, true);
  assert.equal(result.state.messages[0], result.message);
});

// ── getUpgradeSpec ────────────────────────────────────────────────────────────

test('getUpgradeSpec returns correct spec for cargo and power', () => {
  const cs = getUpgradeSpec('cargo');
  assert.equal(cs.step, CARGO_UPGRADE.step);
  assert.equal(cs.max, CARGO_UPGRADE.max);
  const ps = getUpgradeSpec('power');
  assert.equal(ps.step, POWER_UPGRADE.step);
  assert.equal(ps.max, POWER_UPGRADE.max);
});

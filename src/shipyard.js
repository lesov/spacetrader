import { SHIP_CLASSES } from './combat/data.js';
import { buildShipState } from './combat/rules.js';
import {
  CARGO_UPGRADE,
  POWER_UPGRADE,
  getPlanet,
  getEffectiveCargoCapacity,
  getEffectivePowerCapacity
} from './game.js';

export { CARGO_UPGRADE, POWER_UPGRADE };

// Escalating cost tables (level is 1-based; index = current upgrade level before purchase).
const CARGO_COSTS = [
  { parts: 3, credits: 1500 },
  { parts: 4, credits: 3000 },
  { parts: 5, credits: 4500 },
  { parts: 6, credits: 6000 }
];

const POWER_COSTS = [
  { parts: 4, credits: 2500 },
  { parts: 5, credits: 5000 },
  { parts: 6, credits: 7500 },
  { parts: 7, credits: 10000 }
];

// ── Public query functions ────────────────────────────────────────────────────

export function getShipCatalog() {
  return Object.values(SHIP_CLASSES)
    .filter(cls => cls.purchasable)
    .map(cls => ({
      classId: cls.id,
      label: cls.label,
      powerCapacity: cls.powerCapacity,
      cargoCapacity: cls.cargoCapacity,
      hullMax: cls.hullMax,
      shieldMax: cls.shieldMax,
      basePower: cls.basePower ?? {},
      price: cls.price
    }));
}

export function getUpgradeSpec(kind) {
  return kind === 'cargo' ? { ...CARGO_UPGRADE } : { ...POWER_UPGRADE };
}

export function getUpgradeCost(state, kind) {
  const upgradeKey = kind === 'power' ? 'power' : 'cargo';
  const currentLevel = state.shipUpgrades?.[upgradeKey] ?? 0;
  const spec = getUpgradeSpec(kind);
  if (currentLevel >= spec.max) {
    return { atMax: true };
  }
  const costs = kind === 'cargo' ? CARGO_COSTS : POWER_COSTS;
  const entry = costs[currentLevel]; // index = current level (0-based)
  return {
    nextLevel: currentLevel + 1,
    parts: entry.parts,
    credits: entry.credits,
    atMax: false
  };
}

export function canUpgrade(state, kind) {
  const planet = getPlanet(state.currentPlanetId);
  if (!planet.industrial) {
    return { ok: false, reason: 'No shipyard facilities at this location. Industrial worlds only.' };
  }

  const cost = getUpgradeCost(state, kind);
  if (cost.atMax) {
    return { ok: false, reason: `${kind === 'cargo' ? 'Cargo bay' : 'Engine power'} already at maximum upgrade level.` };
  }

  const ownedParts = state.cargo?.shipParts ?? 0;
  if (ownedParts < cost.parts) {
    return { ok: false, reason: `Need ${cost.parts} Ship Parts (have ${ownedParts}).` };
  }

  if (state.credits < cost.credits) {
    return {
      ok: false,
      reason: `Need ${formatNumber(cost.credits)} credits (have ${formatNumber(state.credits)}).`
    };
  }

  return { ok: true, reason: '' };
}

export function canBuyShip(state, classId) {
  const planet = getPlanet(state.currentPlanetId);
  if (!planet.industrial) {
    return { ok: false, reason: 'Ship purchases require a licensed shipyard. Industrial worlds only.' };
  }

  const cls = SHIP_CLASSES[classId];
  if (!cls) {
    return { ok: false, reason: `Unknown ship class: ${classId}.` };
  }

  if (!cls.purchasable) {
    return { ok: false, reason: `${cls.label} is not available for purchase.` };
  }

  const currentClassId = state.playerCombatShip?.classId;
  if (classId === currentClassId) {
    return { ok: false, reason: `You already fly a ${cls.label}.` };
  }

  if (state.credits < cls.price) {
    return {
      ok: false,
      reason: `Need ${formatNumber(cls.price)} credits (have ${formatNumber(state.credits)}).`
    };
  }

  return { ok: true, reason: '' };
}

// ── Mutating actions ──────────────────────────────────────────────────────────

export function upgradeShip(state, kind) {
  const check = canUpgrade(state, kind);
  if (!check.ok) {
    return fail(state, check.reason);
  }

  const cost = getUpgradeCost(state, kind);
  const upgradeKey = kind === 'power' ? 'power' : 'cargo';

  // Consume ship parts from cargo
  const currentParts = state.cargo?.shipParts ?? 0;
  const nextCargo = { ...state.cargo, shipParts: currentParts - cost.parts };
  if (nextCargo.shipParts === 0) {
    delete nextCargo.shipParts;
  }

  const nextUpgrades = {
    ...state.shipUpgrades,
    [upgradeKey]: (state.shipUpgrades?.[upgradeKey] ?? 0) + 1
  };

  const partialState = {
    ...state,
    credits: state.credits - cost.credits,
    cargo: nextCargo,
    shipUpgrades: nextUpgrades
  };

  // Recompute cargoCapacity (always derived fresh)
  const nextState = {
    ...partialState,
    cargoCapacity: getEffectiveCargoCapacity(partialState)
  };

  const message = kind === 'cargo'
    ? `Cargo bay expanded to ${nextState.cargoCapacity} units. ${cost.parts} Ship Parts and ${formatNumber(cost.credits)} credits consumed.`
    : `Fusion drive upgraded. Power capacity now ${getEffectivePowerCapacity(nextState)}. ${cost.parts} Ship Parts and ${formatNumber(cost.credits)} credits consumed.`;

  return succeed(nextState, message);
}

export function buyShip(state, classId) {
  const check = canBuyShip(state, classId);
  if (!check.ok) {
    return fail(state, check.reason);
  }

  const cls = SHIP_CLASSES[classId];

  // Build fresh ship state for new class
  const freshShip = buildShipState(classId);

  // Reset upgrades and swap class
  const nextUpgrades = { cargo: 0, power: 0 };

  const partialState = {
    ...state,
    credits: state.credits - cls.price,
    shipUpgrades: nextUpgrades,
    playerCombatShip: {
      classId: cls.id,
      hull: freshShip.hull,
      shield: freshShip.shieldMax,
      weapons: freshShip.weapons.map(w => ({ ...w }))
    }
  };

  // Recompute cargoCapacity from new class (upgrades reset to 0)
  const nextState = {
    ...partialState,
    cargoCapacity: getEffectiveCargoCapacity(partialState)
  };

  const message = `${cls.label} acquired at ${getPlanet(state.currentPlanetId).name} shipyard for ${formatNumber(cls.price)} credits. Cargo capacity: ${nextState.cargoCapacity} units. Power: ${cls.powerCapacity}.`;

  return succeed(nextState, message);
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function succeed(nextState, message) {
  return {
    ok: true,
    message,
    state: appendMessage(nextState, message)
  };
}

function fail(state, message) {
  return {
    ok: false,
    message,
    state: appendMessage(state, message)
  };
}

function appendMessage(state, message) {
  return {
    ...state,
    messages: [message, ...(state.messages ?? [])].slice(0, 8)
  };
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

import { totalAllocation, isWeaponAvailable } from './rules.js';
import { ENGINES_EVASION_PER_POINT, SENSORS_ACCURACY_PER_POINT } from './data.js';

export const SYSTEMS = ['weapons', 'shields', 'engines', 'sensors', 'repair'];

export const SYSTEM_LABELS = {
  weapons: 'Weapons',
  shields: 'Shields',
  engines: 'Engines',
  sensors: 'Sensors',
  repair: 'Repair'
};

// ── Allocation helpers ────────────────────────────────────────────────────────

export function isAllocationValid(playerShip) {
  return totalAllocation(playerShip.allocation) === playerShip.powerCapacity;
}

export function allocationRemaining(playerShip) {
  return playerShip.powerCapacity - totalAllocation(playerShip.allocation);
}

// ── Tooltips ──────────────────────────────────────────────────────────────────

// Returns tooltip text for each power system based on the ship's current stats
// and allocation. Includes live effect values so the player can see the impact.
export function systemTooltip(sys, ship) {
  const n = ship.allocation[sys];
  switch (sys) {
    case 'weapons': {
      const effective = (ship.basePower?.weapons ?? 0) + n;
      const lines = ship.weapons
        .map(w => `${w.name}: ${w.baseDamage * Math.max(effective, 1)} dmg/hit`)
        .join(', ');
      return `Multiplies weapon damage by effective weapon points.\nAt ${effective} effective pts: ${effective === 0 ? '0 damage (weapons offline)' : lines}.`;
    }
    case 'shields':
      return `Restores ${ship.shieldRegen} shield per effective point each turn (cap ${ship.shieldMax}).\nAt ${n + (ship.basePower?.shields ?? 0)} effective pts: +${ship.shieldRegen * (n + (ship.basePower?.shields ?? 0))} shields/turn. Brace doubles this.`;
    case 'engines':
      return `Adds ${(ENGINES_EVASION_PER_POINT * 100).toFixed(0)}% evasion per point vs incoming fire.\nAt ${n} pts: +${(n * ENGINES_EVASION_PER_POINT * 100).toFixed(0)}% dodge. Also boosts Run Away chance (×12% per pt).`;
    case 'sensors':
      return `Adds ${(SENSORS_ACCURACY_PER_POINT * 100).toFixed(0)}% hit chance per point to your weapons.\nAt ${n} pts: +${(n * SENSORS_ACCURACY_PER_POINT * 100).toFixed(0)}% accuracy. Also improves Run Away chance (×5% per pt).`;
    case 'repair':
      if (ship.hull >= ship.hullMax) return 'Hull is at full capacity — repair unavailable.';
      return `Restores ${ship.repairRate} hull per point each turn (cap ${ship.hullMax}).\nAt ${n} pts: +${ship.repairRate * n} hull/turn. ${ship.hullMax - ship.hull} hull missing.`;
    default:
      return '';
  }
}

// ── Presets ───────────────────────────────────────────────────────────────────

export const PRESETS = [
  { label: 'Attack',   weights: { weapons: 6, shields: 1, engines: 0, sensors: 3, repair: 0 } },
  { label: 'Balanced', weights: { weapons: 3, shields: 3, engines: 1, sensors: 2, repair: 1 } },
  { label: 'Defend',   weights: { weapons: 1, shields: 5, engines: 2, sensors: 0, repair: 2 } },
  { label: 'Evasive',  weights: { weapons: 1, shields: 1, engines: 5, sensors: 3, repair: 0 } }
];

export function cloneCombatPresets(presets = PRESETS) {
  return presets.map((preset) => ({
    label: preset.label,
    weights: { ...preset.weights }
  }));
}

export function setCombatPresetWeight(presets, label, system, value) {
  if (!SYSTEMS.includes(system)) return cloneCombatPresets(presets);
  const nextValue = Math.max(0, Math.min(10, Number.parseInt(value, 10) || 0));
  return cloneCombatPresets(presets).map((preset) => (
    preset.label === label
      ? { ...preset, weights: { ...preset.weights, [system]: nextValue } }
      : preset
  ));
}

export function getPresetEditorAllocation(preset, powerCapacity) {
  const weights = SYSTEMS.reduce((allocation, system) => ({
    ...allocation,
    [system]: Math.max(0, Number.parseInt(preset.weights?.[system], 10) || 0)
  }), {});

  if (totalAllocation(weights) > powerCapacity) {
    return computePresetAllocation(weights, powerCapacity);
  }

  return weights;
}

export function getPresetSliderState(preset, powerCapacity, system) {
  const allocation = getPresetEditorAllocation(preset, powerCapacity);
  const total = totalAllocation(allocation);
  const remaining = Math.max(0, powerCapacity - total);
  return {
    value: allocation[system],
    max: allocation[system] + remaining,
    remaining,
    total,
    isComplete: total === powerCapacity
  };
}

export function setCombatPresetAllocation(presets, label, system, value, powerCapacity) {
  if (!SYSTEMS.includes(system)) return cloneCombatPresets(presets);
  return cloneCombatPresets(presets).map((preset) => {
    if (preset.label !== label) return preset;

    const allocation = getPresetEditorAllocation(preset, powerCapacity);
    const otherTotal = totalAllocation(allocation) - allocation[system];
    const maxForSystem = Math.max(0, powerCapacity - otherTotal);
    const nextValue = Math.max(0, Math.min(maxForSystem, Number.parseInt(value, 10) || 0));
    return {
      ...preset,
      weights: {
        ...allocation,
        [system]: nextValue
      }
    };
  });
}

// Distribute powerCapacity across systems proportional to weights.
// Uses largest-remainder rounding so the total is always exact.
export function computePresetAllocation(weights, powerCapacity) {
  const systems = ['weapons', 'shields', 'engines', 'sensors', 'repair'];
  const totalWeight = systems.reduce((s, k) => s + (weights[k] || 0), 0);
  if (totalWeight === 0) {
    const each = Math.floor(powerCapacity / 5);
    return { weapons: each, shields: each, engines: each, sensors: each, repair: powerCapacity - each * 4 };
  }

  const items = systems.map(sys => {
    const exact = (weights[sys] / totalWeight) * powerCapacity;
    return { sys, floored: Math.floor(exact), frac: exact - Math.floor(exact) };
  });

  const allocated = items.reduce((s, { floored }) => s + floored, 0);
  const remainder = powerCapacity - allocated;

  // Give remainder points to systems with the largest fractional parts
  items.sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < remainder; i++) items[i].floored++;

  const result = { weapons: 0, shields: 0, engines: 0, sensors: 0, repair: 0 };
  for (const { sys, floored } of items) result[sys] = floored;
  return result;
}

// ── Weapon rows ───────────────────────────────────────────────────────────────

export function getWeaponRows(ship) {
  return ship.weapons.map(w => ({
    id: w.id,
    name: w.name,
    available: isWeaponAvailable(w),
    cooldownRemaining: w.cooldownRemaining,
    ammo: w.ammo,
    reason: !isWeaponAvailable(w)
      ? (w.ammo !== null && w.ammo <= 0 ? 'No ammo' : `Cooldown: ${w.cooldownRemaining}`)
      : ''
  }));
}

// ── Formatters ────────────────────────────────────────────────────────────────

export function formatBar(current, max) {
  const filled = max > 0 ? Math.round((current / max) * 10) : 0;
  return '[' + '#'.repeat(filled) + '-'.repeat(10 - filled) + ']';
}

export function formatHull(hull, hullMax) {
  return `${hull}/${hullMax}`;
}

export function formatShield(shield, shieldMax) {
  return `${shield}/${shieldMax}`;
}

export function phaseLabel(phase) {
  if (phase === 'allocate') return 'Allocate Power';
  if (phase === 'action') return 'Select Action';
  if (phase === 'ended') return 'Battle Over';
  return '';
}

export function battleResultLabel(winner) {
  if (winner === 'player')  return 'Victory';
  if (winner === 'enemy')   return 'Defeat';
  if (winner === 'draw')    return 'Draw';
  if (winner === 'escaped') return 'Escaped';
  if (winner === 'enemyEscaped') return 'Enemy Escaped';
  return '';
}

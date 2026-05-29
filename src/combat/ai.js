import { isWeaponAvailable, runAwayChance } from './rules.js';

// Both strategies are pure functions of (ownShip, enemyShip, rng).
// They return { allocation, action }.

// ── Random AI ────────────────────────────────────────────────────────────────

export function randomAI(ownShip, _enemyShip, rng) {
  const allocation = randomAllocation(ownShip.powerCapacity, rng);
  const available = ownShip.weapons.filter(isWeaponAvailable);

  let action;
  const options = [...available.map(w => ({ type: 'fire', weaponId: w.id })), { type: 'brace' }];
  const idx = Math.floor(rng.next() * options.length);
  action = options[idx];

  return { allocation, action };
}

// ── Scripted Aggressor AI ────────────────────────────────────────────────────

export function aggressorAI(ownShip, enemyShip, rng) {
  const allocation = aggressorAllocation(ownShip.powerCapacity, ownShip);
  const action = aggressorAction({ ...ownShip, allocation }, enemyShip, rng);
  return { allocation, action };
}

// Aggressor repairs damaged hull, then splits remaining power toward weapons,
// shields, sensors, and engines.
function aggressorAllocation(powerCapacity, ship) {
  const repairPts = ship && ship.hull < ship.hullMax ? Math.min(3, Math.max(1, Math.floor(powerCapacity * 0.25))) : 0;
  const remainingPower = powerCapacity - repairPts;
  const weaponsPts = Math.floor(remainingPower * 0.5);
  const shieldPts = Math.floor(remainingPower * 0.25);
  const remainder = remainingPower - weaponsPts - shieldPts;
  const sensorsPts = Math.ceil(remainder / 2);
  const enginesPts = remainder - sensorsPts;
  return { weapons: weaponsPts, shields: shieldPts, sensors: sensorsPts, engines: enginesPts, repair: repairPts };
}

// Aggressor may run when badly damaged, otherwise fires the highest-baseDamage
// available weapon. Braces if shield < 20% of max and no weapon is available.
function aggressorAction(ownShip, _enemyShip, rng) {
  const hullRatio = ownShip.hullMax > 0 ? ownShip.hull / ownShip.hullMax : 1;
  if (hullRatio <= 0.35 && rng.next() < 0.45) {
    return { type: 'run', chance: runAwayChance(ownShip) };
  }

  const available = ownShip.weapons.filter(isWeaponAvailable);
  if (available.length > 0) {
    const best = available.reduce((a, b) => (a.baseDamage >= b.baseDamage ? a : b));
    return { type: 'fire', weaponId: best.id };
  }
  if (ownShip.shield < ownShip.shieldMax * 0.2) {
    return { type: 'brace' };
  }
  return { type: 'brace' };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

// Distribute points randomly across the five power systems.
// Uses "deal one point at a time to a random system" so any distribution is reachable.
function randomAllocation(powerCapacity, rng) {
  const systems = ['weapons', 'shields', 'engines', 'sensors', 'repair'];
  const alloc = { weapons: 0, shields: 0, engines: 0, sensors: 0, repair: 0 };
  for (let i = 0; i < powerCapacity; i++) {
    const sys = systems[Math.floor(rng.next() * systems.length)];
    alloc[sys]++;
  }
  return alloc;
}

import { isWeaponAvailable, totalAllocation } from './rules.js';

// Both strategies are pure functions of (ownShip, enemyShip, rng).
// They return { allocation, action }.

// ── Random AI ────────────────────────────────────────────────────────────────

export function randomAI(ownShip, _enemyShip, rng) {
  const allocation = randomAllocation(ownShip.powerCapacity, rng);
  const available = ownShip.weapons.filter(isWeaponAvailable);

  let action;
  const options = [...available.map(w => ({ type: 'fire', weaponId: w.id })), { type: 'brace' }, { type: 'hold' }];
  const idx = Math.floor(rng.next() * options.length);
  action = options[idx];

  return { allocation, action };
}

// ── Scripted Aggressor AI ────────────────────────────────────────────────────

export function aggressorAI(ownShip, _enemyShip, _rng) {
  const allocation = aggressorAllocation(ownShip.powerCapacity);
  const action = aggressorAction(ownShip);
  return { allocation, action };
}

// Aggressor splits: 50% weapons, 25% shields, remainder split between sensors
// and engines (sensors first for tie-breaking).
function aggressorAllocation(powerCapacity) {
  const weaponsPts = Math.floor(powerCapacity * 0.5);
  const shieldPts = Math.floor(powerCapacity * 0.25);
  const remainder = powerCapacity - weaponsPts - shieldPts;
  const sensorsPts = Math.ceil(remainder / 2);
  const enginesPts = remainder - sensorsPts;
  return { weapons: weaponsPts, shields: shieldPts, sensors: sensorsPts, engines: enginesPts, repair: 0 };
}

// Aggressor fires highest-baseDamage available weapon.
// Braces if shield < 20% of max AND no weapon is available.
function aggressorAction(ownShip) {
  const available = ownShip.weapons.filter(isWeaponAvailable);
  if (available.length > 0) {
    const best = available.reduce((a, b) => (a.baseDamage >= b.baseDamage ? a : b));
    return { type: 'fire', weaponId: best.id };
  }
  if (ownShip.shield < ownShip.shieldMax * 0.2) {
    return { type: 'brace' };
  }
  return { type: 'hold' };
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

import {
  SHIP_CLASSES,
  ENGINES_EVASION_PER_POINT,
  SENSORS_ACCURACY_PER_POINT
} from './data.js';

// ── Ship construction ────────────────────────────────────────────────────────

// overrides can include powerCapacity (for engine-upgraded player ships).
export function buildShipState(classId, overrides = {}) {
  const cls = SHIP_CLASSES[classId];
  if (!cls) throw new Error(`Unknown ship class: ${classId}`);
  const base = {
    classId,
    label: cls.label,
    hullMax: cls.hullMax,
    hull: cls.hullMax,
    shieldMax: cls.shieldMax,
    shield: cls.shieldMax,
    powerCapacity: cls.powerCapacity,
    basePower: cls.basePower ?? {},
    baseAccuracy: cls.baseAccuracy,
    baseEvasion: cls.baseEvasion,
    shieldRegen: cls.shieldRegen,
    repairRate: cls.repairRate,
    weapons: cls.weapons.map(w => ({ ...w, cooldownRemaining: 0 })),
    allocation: { weapons: 0, shields: 0, engines: 0, sensors: 0, repair: 0 }
  };
  return { ...base, ...overrides };
}

export function createBattleState(playerClassId, enemyClassId) {
  return {
    turn: 1,
    phase: 'allocate',
    winner: null,
    player: buildShipState(playerClassId),
    enemy: buildShipState(enemyClassId),
    log: []
  };
}

// ── Effective points helper ──────────────────────────────────────────────────

// Returns the effective level of a combat system: innate base power + allocated points.
// Innate base power is free and does not count against the allocatable pool.
export function effectivePoints(ship, system) {
  return (ship.basePower?.[system] ?? 0) + ship.allocation[system];
}

// ── Allocation validation ────────────────────────────────────────────────────

export function totalAllocation(allocation) {
  return allocation.weapons + allocation.shields + allocation.engines +
    allocation.sensors + allocation.repair;
}

export function validateAllocation(allocation, powerCapacity) {
  const systems = ['weapons', 'shields', 'engines', 'sensors', 'repair'];
  for (const sys of systems) {
    if (!Number.isInteger(allocation[sys]) || allocation[sys] < 0) {
      return `${sys} allocation must be a non-negative integer.`;
    }
  }
  const total = totalAllocation(allocation);
  if (total !== powerCapacity) {
    return `Allocation total (${total}) must equal power capacity (${powerCapacity}).`;
  }
  return '';
}

// ── Weapon availability ──────────────────────────────────────────────────────

export function isWeaponAvailable(weapon) {
  return weapon.cooldownRemaining === 0 && (weapon.ammo === null || weapon.ammo > 0);
}

// ── Turn resolution ──────────────────────────────────────────────────────────

export function resolveFullTurn(state, playerAction, aiAction, rng) {
  const turn = state.turn;
  const newLog = [];

  let player = state.player;
  let enemy = state.enemy;

  // 1. Shield regen (both sides)
  player = applyShieldRegen(player);
  const playerShieldGained = player.shield - state.player.shield;
  if (playerShieldGained > 0) {
    newLog.push(`Turn ${turn} — Your shields restored ${playerShieldGained} (${player.shield}/${player.shieldMax}).`);
  }

  enemy = applyShieldRegen(enemy);
  const enemyShieldGained = enemy.shield - state.enemy.shield;
  if (enemyShieldGained > 0) {
    newLog.push(`Turn ${turn} — Enemy shields restored ${enemyShieldGained} (${enemy.shield}/${enemy.shieldMax}).`);
  }

  // 2. Hull repair (both sides)
  const playerHullBefore = player.hull;
  player = applyHullRepair(player);
  const playerHullGained = player.hull - playerHullBefore;
  if (playerHullGained > 0) {
    newLog.push(`Turn ${turn} — Hull repair restored ${playerHullGained} hull (${player.hull}/${player.hullMax}).`);
  }

  const enemyHullBefore = enemy.hull;
  enemy = applyHullRepair(enemy);
  const enemyHullGained = enemy.hull - enemyHullBefore;
  if (enemyHullGained > 0) {
    newLog.push(`Turn ${turn} — Enemy hull repair restored ${enemyHullGained} hull (${enemy.hull}/${enemy.hullMax}).`);
  }

  // 3. Brace (applies extra shield regen equal to one allocation worth)
  if (playerAction.type === 'brace') {
    const before = player.shield;
    player = applyShieldRegen(player);
    const extra = player.shield - before;
    newLog.push(`Turn ${turn} — You brace: emergency power to shields${extra > 0 ? `, +${extra} shields` : ''}.`);
  }
  if (aiAction.type === 'brace') {
    enemy = applyShieldRegen(enemy);
  }

  // 3b. Run-away attempt (replaces player weapon fire; enemy still fires a parting shot)
  let escaped = false;
  if (playerAction.type === 'run') {
    const chance = runAwayChance(player);
    const roll = rng.next();
    if (roll < chance) {
      escaped = true;
      newLog.push(`Turn ${turn} — Emergency escape engaged! (${pct(chance)} chance) — Escape successful!`);
    } else {
      newLog.push(`Turn ${turn} — Escape failed (${pct(chance)} chance). Taking defensive position.`);
    }
  }

  // 4. Resolve player weapon (player fires first per spec; skipped if running)
  const playerFired = [];
  if (playerAction.type === 'fire' && !escaped) {
    const result = resolveWeaponFire('player', player, enemy, playerAction.weaponId, rng, turn);
    player = result.attacker;
    enemy = result.defender;
    newLog.push(...result.log);
    playerFired.push(playerAction.weaponId);
  }

  // 5. Resolve AI weapon
  const enemyFired = [];
  if (aiAction.type === 'fire') {
    const result = resolveWeaponFire('enemy', enemy, player, aiAction.weaponId, rng, turn);
    enemy = result.attacker;
    player = result.defender;
    newLog.push(...result.log);
    enemyFired.push(aiAction.weaponId);
  }

  // 6. Advance cooldowns and ammo for all weapons
  player = advanceCooldownsAndAmmo(player, playerFired);
  enemy = advanceCooldownsAndAmmo(enemy, enemyFired);

  // 7. Check battle end
  let winner;
  if (escaped) {
    winner = player.hull > 0 ? 'escaped' : 'enemy';
    if (winner === 'escaped') newLog.push(`Turn ${turn} — You've jumped to safety. Battle over.`);
    else newLog.push(`Turn ${turn} — Destroyed during escape attempt. Defeat.`);
  } else {
    winner = checkBattleEnd(player, enemy);
    if (winner === 'player') newLog.push(`Turn ${turn} — Victory! Enemy ship destroyed.`);
    else if (winner === 'enemy') newLog.push(`Turn ${turn} — Defeat. Your ship is destroyed.`);
    else if (winner === 'draw') newLog.push(`Turn ${turn} — Both ships destroyed — draw!`);
  }

  return {
    ...state,
    turn: winner ? state.turn : state.turn + 1,
    phase: winner ? 'ended' : 'allocate',
    winner,
    player,
    enemy,
    log: [...newLog, ...state.log].slice(0, 60)
  };
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function applyShieldRegen(ship) {
  const gained = ship.shieldRegen * effectivePoints(ship, 'shields');
  return { ...ship, shield: Math.min(ship.shieldMax, ship.shield + gained) };
}

function applyHullRepair(ship) {
  const gained = ship.repairRate * effectivePoints(ship, 'repair');
  return { ...ship, hull: Math.min(ship.hullMax, ship.hull + gained) };
}

function resolveWeaponFire(side, attacker, defender, weaponId, rng, turn) {
  const weapon = attacker.weapons.find(w => w.id === weaponId);
  if (!weapon || !isWeaponAvailable(weapon)) return { attacker, defender, log: [] };

  const hitChance = clamp(
    attacker.baseAccuracy
    + effectivePoints(attacker, 'sensors') * SENSORS_ACCURACY_PER_POINT
    + weapon.accuracyMod
    - defender.baseEvasion
    - effectivePoints(defender, 'engines') * ENGINES_EVASION_PER_POINT,
    0.05, 0.95
  );

  const roll = rng.next();
  const hit = roll < hitChance;

  const who = side === 'player' ? 'You' : 'Enemy';

  if (!hit) {
    return {
      attacker,
      defender,
      log: [`Turn ${turn} — ${who} fired ${weapon.name}: MISS.`]
    };
  }

  const rawDamage = weapon.baseDamage * effectivePoints(attacker, 'weapons');
  const penetrating = Math.round(rawDamage * weapon.shieldPenetration);
  const shieldHit = rawDamage - penetrating;

  const shieldBefore = defender.shield;
  const shieldAfter = Math.max(0, defender.shield - shieldHit);
  const shieldSpill = Math.max(0, shieldHit - defender.shield);
  const hullDamage = penetrating + shieldSpill;

  const hullBefore = defender.hull;
  const hullAfter = Math.max(0, defender.hull - hullDamage);

  const totalShown = (shieldBefore - shieldAfter) + (hullBefore - hullAfter);
  const log = [
    `Turn ${turn} — ${who} fired ${weapon.name}: HIT for ${totalShown} (shields ${shieldBefore}→${shieldAfter}, hull ${hullBefore}→${hullAfter}).`
  ];

  return {
    attacker,
    defender: { ...defender, shield: shieldAfter, hull: hullAfter },
    log
  };
}

// After firing: set cooldownRemaining = cooldownTurns for fired weapons.
// For all other weapons: decrement cooldownRemaining by 1 (min 0).
// Also decrement ammo for fired weapons.
function advanceCooldownsAndAmmo(ship, firedWeaponIds) {
  return {
    ...ship,
    weapons: ship.weapons.map(w => {
      if (firedWeaponIds.includes(w.id)) {
        return {
          ...w,
          cooldownRemaining: w.cooldownTurns,
          ammo: w.ammo === null ? null : w.ammo - 1
        };
      }
      return { ...w, cooldownRemaining: Math.max(0, w.cooldownRemaining - 1) };
    })
  };
}

export function checkBattleEnd(player, enemy) {
  const playerDead = player.hull <= 0;
  const enemyDead = enemy.hull <= 0;
  if (playerDead && enemyDead) return 'draw';
  if (playerDead) return 'enemy';
  if (enemyDead) return 'player';
  return null;
}

// Escape chance: effective engines×12% + effective sensors×5%, clamped to [5%, 80%].
export function runAwayChance(player) {
  return clamp(
    effectivePoints(player, 'engines') * 0.12 + effectivePoints(player, 'sensors') * 0.05,
    0.05, 0.80
  );
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function pct(v) {
  return `${Math.round(v * 100)}%`;
}

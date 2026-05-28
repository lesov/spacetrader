export const ENGINES_EVASION_PER_POINT = 0.05;
export const SENSORS_ACCURACY_PER_POINT = 0.05;

// Brace action: applies shield regen one extra time this turn.
// (Defined here so tests can reference it alongside other constants.)
export const BRACE_EXTRA_REGEN_MULTIPLIER = 1;

export const SHIP_CLASSES = {
  falcon: {
    id: 'falcon',
    label: 'Falcon-class Skirmisher',
    hullMax: 70,
    shieldMax: 25,
    powerCapacity: 8,
    cargoCapacity: 12,
    price: 12000,
    purchasable: true,
    basePower: { engines: 1, sensors: 1 },
    baseAccuracy: 0.65,
    baseEvasion: 0.25,
    shieldRegen: 3,
    repairRate: 1,
    weapons: [
      {
        id: 'pulse-laser',
        name: 'Pulse Laser',
        baseDamage: 3,
        accuracyMod: 0.10,
        shieldPenetration: 0.0,
        cooldownTurns: 0,
        ammo: null
      }
    ]
  },

  vanguard: {
    id: 'vanguard',
    label: 'Vanguard-class Cruiser',
    hullMax: 100,
    shieldMax: 55,
    powerCapacity: 10,
    cargoCapacity: 20,
    price: 18000,
    purchasable: true,
    basePower: { shields: 1 },
    baseAccuracy: 0.60,
    baseEvasion: 0.12,
    shieldRegen: 4,
    repairRate: 2,
    weapons: [
      {
        id: 'plasma-cannon',
        name: 'Plasma Cannon',
        baseDamage: 5,
        accuracyMod: 0.0,
        shieldPenetration: 0.15,
        cooldownTurns: 1,
        ammo: null
      }
    ]
  },

  bastion: {
    id: 'bastion',
    label: 'Bastion-class Gunboat',
    hullMax: 150,
    shieldMax: 80,
    powerCapacity: 12,
    cargoCapacity: 30,
    price: 32000,
    purchasable: true,
    basePower: { weapons: 1, shields: 1 },
    baseAccuracy: 0.50,
    baseEvasion: 0.05,
    shieldRegen: 5,
    repairRate: 3,
    weapons: [
      {
        id: 'missile-rack',
        name: 'Missile Rack',
        baseDamage: 8,
        accuracyMod: -0.05,
        shieldPenetration: 0.35,
        cooldownTurns: 2,
        ammo: 6
      },
      {
        id: 'pulse-laser',
        name: 'Pulse Laser',
        baseDamage: 2,
        accuracyMod: 0.05,
        shieldPenetration: 0.0,
        cooldownTurns: 0,
        ammo: null
      }
    ]
  },

  leviathan: {
    id: 'leviathan',
    label: 'Leviathan-class Freighter',
    hullMax: 130,
    shieldMax: 60,
    powerCapacity: 11,
    cargoCapacity: 50,
    price: 48000,
    purchasable: true,
    basePower: { shields: 1, repair: 1 },
    baseAccuracy: 0.45,
    baseEvasion: 0.08,
    shieldRegen: 4,
    repairRate: 4,
    weapons: [
      {
        id: 'point-defense',
        name: 'Point-Defense Turret',
        baseDamage: 3,
        accuracyMod: 0.05,
        shieldPenetration: 0.0,
        cooldownTurns: 0,
        ammo: null
      }
    ]
  }
};

// Fixed player vs enemy matchup (per human approver decision 2026-05-28).
export const PLAYER_CLASS_ID = 'vanguard';
export const ENEMY_CLASS_ID = 'bastion';

import { SHIP_CLASSES, PLAYER_CLASS_ID } from "./combat/data.js";
import { aggressorAI } from "./combat/ai.js";
import {
  buildShipState,
  createBattleState,
  resolveFullTurn,
  validateAllocation
} from "./combat/rules.js";
import { createRng } from "./combat/rng.js";
import {
  advanceDate,
  getCargoRemaining,
  getPlanet,
  getResource,
  getTravelDurationDays,
  getTravelCost,
  serializeCombatShip,
  getEffectivePowerCapacity
} from "./game.js";
import {
  activateMissionForDeparture,
  getActiveMissionCombatContext,
  refreshMissionOffers,
  resolveMissionArrival,
  resolveMissionBattleOutcome,
  resolveMissionDepartureEvent,
  validateMissionDeparture
} from "./missions.js";

// Enemy spawn weights. More powerful classes appear less frequently.
// Cumulative thresholds: falcon 45%, vanguard 30%, leviathan 15%, bastion 10%.
const ENEMY_SPAWN_THRESHOLDS = [
  { classId: "falcon",    threshold: 0.45 },
  { classId: "vanguard",  threshold: 0.75 },
  { classId: "leviathan", threshold: 0.90 },
  { classId: "bastion",   threshold: 1.00 }
];

// Salvage ranges per enemy class awarded on victory.
const SALVAGE_BY_CLASS = {
  falcon:    { creditsMin: 350,  creditsMax: 700,  partsMin: 3,  partsMax: 7 },
  vanguard:  { creditsMin: 700,  creditsMax: 1200, partsMin: 5,  partsMax: 10 },
  leviathan: { creditsMin: 900,  creditsMax: 1600, partsMin: 7,  partsMax: 13 },
  bastion:   { creditsMin: 1400, creditsMax: 2400, partsMin: 10, partsMax: 18 }
};

function rollEnemyClass(rng) {
  const roll = rng.next();
  for (const entry of ENEMY_SPAWN_THRESHOLDS) {
    if (roll < entry.threshold) return entry.classId;
  }
  return "bastion";
}

function rollSalvage(enemyClassId, rng) {
  const table = SALVAGE_BY_CLASS[enemyClassId] ?? SALVAGE_BY_CLASS.vanguard;
  return {
    credits: randInt(table.creditsMin, table.creditsMax, rng.next()),
    parts:   randInt(table.partsMin,   table.partsMax,   rng.next())
  };
}

function randInt(min, max, roll) {
  return min + Math.floor(roll * (max - min + 1));
}

export const ENCOUNTER_CHANCE_BY_RISK = {
  low: 0.12,
  moderate: 0.3,
  high: 0.55
};

export function getEncounterChance(state, destinationPlanetId) {
  const destination = getPlanet(destinationPlanetId);
  const baseChance = ENCOUNTER_CHANCE_BY_RISK[destination.riskLevel] ?? ENCOUNTER_CHANCE_BY_RISK.low;
  const routeModifier = getTravelCost(state.currentPlanetId, destinationPlanetId) * 0.02;
  return clamp(baseChance + routeModifier, 0.08, 0.9);
}

export function rollTravelEncounter(state, destinationPlanetId, rng) {
  const chance = getEncounterChance(state, destinationPlanetId);
  const roll = rng.next();
  return {
    chance,
    roll,
    triggered: roll < chance
  };
}

export function beginTravel(state, destinationPlanetId, options = {}, rng) {
  const { confirmed = false } = options;
  const destination = getPlanet(destinationPlanetId);
  const origin = getPlanet(state.currentPlanetId);

  if (state.mode !== "trade") {
    return fail(state, "Travel is only available while docked.");
  }

  if (destination.id === state.currentPlanetId) {
    return fail(state, `Already docked at ${destination.name}.`);
  }

  const fuelCost = getTravelCost(state.currentPlanetId, destination.id);
  if (state.fuel < fuelCost) {
    return fail(state, `Need ${fuelCost} fuel to reach ${destination.name}.`);
  }

  const missionDepartureError = validateMissionDeparture(state, destination.id);
  if (missionDepartureError) {
    return fail(state, missionDepartureError);
  }

  if (!state.tradedAtCurrentLocation && !confirmed) {
    const message = `Leave ${origin.name} without trading? Confirm travel to ${destination.name}.`;
    return {
      ok: false,
      requiresConfirmation: true,
      destinationPlanetId: destination.id,
      message,
      state: appendMessage(state, message)
    };
  }

  const departedState = appendMessage(
    activateMissionForDeparture({
      ...state,
      fuel: state.fuel - fuelCost,
      pendingTravel: {
        originPlanetId: origin.id,
        destinationPlanetId: destination.id,
        fuelCost,
        travelDurationDays: getTravelDurationDays(fuelCost),
        encounterRolled: false,
        encounterTriggered: false
      }
    }, destination.id),
    `Departed ${origin.name} for ${destination.name}. Fuel spent: ${fuelCost}.`
  );

  const missionEvent = resolveMissionDepartureEvent(departedState, rng);
  let travelState = missionEvent.state;
  if (missionEvent.message) {
    travelState = appendMessage(travelState, missionEvent.message);
  }

  if (missionEvent.encounter) {
    return startTravelBattle(
      travelState,
      destination.id,
      rng,
      { chance: missionEvent.encounter.chance, triggered: true },
      missionEvent.encounter
    );
  }

  const encounter = rollTravelEncounter(travelState, destination.id, rng);
  if (encounter.triggered) {
    return startTravelBattle(
      travelState,
      destination.id,
      rng,
      encounter,
      getActiveMissionCombatContext(travelState)
    );
  }

  return {
    ok: true,
    encounterTriggered: false,
    message: `No hostile contact. Arrived at ${destination.name}.`,
    state: completeTravel(
      {
        ...travelState,
        pendingTravel: {
          ...travelState.pendingTravel,
          encounterRolled: true,
          encounterTriggered: false
        }
      },
      destination.id,
      `No hostile contact. Arrived at ${destination.name}.`
    )
  };
}

export function startTravelBattle(state, destinationPlanetId, rng, encounter, missionContext = null) {
  const destination = getPlanet(destinationPlanetId);
  const enemyClassId = missionContext?.enemyClassId ?? rollEnemyClass(rng);
  const battle = rehydratePlayerShip(createBattleState(PLAYER_CLASS_ID, enemyClassId), state.playerCombatShip, state);
  const seed = Math.floor(rng.next() * 0xffffffff);
  const risk = Math.round(encounter.chance * 100);
  const enemyLabel = SHIP_CLASSES[enemyClassId]?.label ?? enemyClassId;
  const message = missionContext?.missionId
    ? `Mission contact en route to ${destination.name}: ${enemyLabel}. Battle risk was ${risk}%.`
    : `Hostile contact en route to ${destination.name}: ${enemyLabel}. Battle risk was ${risk}%.`;

  return {
    ok: true,
    encounterTriggered: true,
    message,
    state: appendMessage(
      {
        ...state,
        mode: "combat",
        pendingTravel: {
          ...state.pendingTravel,
          encounterRolled: true,
          encounterTriggered: true
        },
        combat: {
          battle,
          rngSeed: seed,
          enemyClassId,
          missionContext
        }
      },
      message
    )
  };
}

export function prepareCombatActionPhase(state, rng) {
  if (state.mode !== "combat" || !state.combat) {
    return fail(state, "No active battle.");
  }

  const battle = state.combat.battle;
  const error = validateAllocation(battle.player.allocation, battle.player.powerCapacity);
  if (error) {
    return fail(state, error);
  }

  const { allocation } = aggressorAI(battle.enemy, battle.player, rng);
  return {
    ok: true,
    message: "Power allocation locked.",
    state: {
      ...state,
      combat: {
        ...state.combat,
        battle: {
          ...battle,
          phase: "action",
          enemy: {
            ...battle.enemy,
            allocation
          }
        }
      }
    }
  };
}

export function updatePlayerAllocation(state, system, delta) {
  if (state.mode !== "combat" || !state.combat) {
    return state;
  }

  const battle = state.combat.battle;
  if (battle.phase !== "allocate") {
    return state;
  }

  if (system === "repair" && battle.player.hull >= battle.player.hullMax) {
    return state;
  }

  const nextValue = battle.player.allocation[system] + delta;
  if (!Number.isInteger(nextValue) || nextValue < 0) {
    return state;
  }

  const total = Object.values(battle.player.allocation).reduce((sum, value) => sum + value, 0);
  if (delta > 0 && total >= battle.player.powerCapacity) {
    return state;
  }

  return {
    ...state,
    combat: {
      ...state.combat,
      battle: {
        ...battle,
        player: {
          ...battle.player,
          allocation: {
            ...battle.player.allocation,
            [system]: nextValue
          }
        }
      }
    }
  };
}

export function setPlayerAllocation(state, allocation) {
  if (state.mode !== "combat" || !state.combat) {
    return state;
  }

  const battle = state.combat.battle;
  return {
    ...state,
    combat: {
      ...state.combat,
      battle: {
        ...battle,
        player: {
          ...battle.player,
          allocation
        }
      }
    }
  };
}

export function resolveIntegratedBattleTurn(state, playerAction, rng) {
  if (state.mode !== "combat" || !state.combat) {
    return fail(state, "No active battle.");
  }

  const battle = state.combat.battle;
  const { action: aiAction } = aggressorAI(battle.enemy, battle.player, rng);
  const resolvedBattle = clampRepair(resolveFullTurn(battle, playerAction, aiAction, rng));
  const nextState = {
    ...state,
    combat: {
      ...state.combat,
      battle: resolvedBattle
    }
  };

  if (resolvedBattle.phase === "ended") {
    return {
      ok: true,
      message: "Battle ended.",
      state: nextState
    };
  }

  return {
    ok: true,
    message: "Battle turn resolved.",
    state: nextState
  };
}

export function previewVictoryLoot(state) {
  if (state.combat?.battle?.winner !== "player") return null;
  const salvageRng = createRng(state.combat.rngSeed);
  const loot = rollSalvage(state.combat.enemyClassId ?? "vanguard", salvageRng);
  return {
    credits: loot.credits,
    parts: Math.min(loot.parts, getCargoRemaining(state))
  };
}

export function applyBattleOutcome(state, rng) {
  const battle = state.combat?.battle;
  if (!battle || battle.phase !== "ended") {
    return fail(state, "Battle is not complete.");
  }

  if (battle.winner === "player" || battle.winner === "escaped") {
    return applyCompletedTravelBattle(state, battle, rng);
  }

  if (battle.winner === "enemyEscaped") {
    return applyCompletedTravelBattle(state, battle, rng);
  }

  const message = battle.winner === "draw"
    ? "Both ships were destroyed. Run ended."
    : "Your ship was destroyed. Run ended.";
  const missionOutcome = resolveMissionBattleOutcome(state, battle.winner);
  const outcomeMessage = [message, missionOutcome.message].filter(Boolean).join(" ");

  return {
    ok: false,
    gameOver: true,
    message: outcomeMessage,
    state: appendMessage(
      {
        ...missionOutcome.state,
        mode: "gameOver",
        pendingTravel: null
      },
      outcomeMessage
    )
  };
}

function applyCompletedTravelBattle(state, battle, rng) {
    const destinationId = state.pendingTravel.destinationPlanetId;
    const destination = getPlanet(destinationId);
    const outcomeRng = rng ?? createRng(state.combat.rngSeed);
    const cargoLoss = rollCargoLoss(state, battle, outcomeRng);
    const cargoAfterLoss = cargoLoss.cargo;
    const cargoLossText = cargoLoss.lost.length > 0
      ? ` Cargo lost: ${cargoLoss.lost.map((entry) => `${entry.quantity} ${entry.name}`).join(", ")}.`
      : "";

    let salvageCredits = 0;
    let salvageParts = 0;
    if (battle.winner === "player") {
      const loot = rollSalvage(state.combat.enemyClassId ?? "vanguard", outcomeRng);
      salvageCredits = loot.credits;
      salvageParts = Math.min(loot.parts, getCargoRemaining({ ...state, cargo: cargoAfterLoss }));
    }

    const partsText = salvageParts > 0 ? `, ${salvageParts} Ship Parts` : "";
    const outcomeText = battle.winner === "player"
      ? `Victory near ${destination.name}. Salvage: ${salvageCredits} credits${partsText}.${cargoLossText}`
      : battle.winner === "enemyEscaped"
        ? `Hostile ship escaped near ${destination.name}; route is clear.${cargoLossText}`
        : `Escaped the encounter and continued to ${destination.name}.${cargoLossText}`;

    const nextCargo = salvageParts > 0
      ? { ...cargoAfterLoss, shipParts: (cargoAfterLoss.shipParts ?? 0) + salvageParts }
      : cargoAfterLoss;
    const missionOutcome = resolveMissionBattleOutcome(
      {
        ...state,
        credits: state.credits + salvageCredits,
        cargo: nextCargo,
        playerCombatShip: serializeCombatShip(battle.player, false)
      },
      battle.winner
    );
    const fullOutcomeText = [outcomeText, missionOutcome.message].filter(Boolean).join(" ");

    return {
      ok: true,
      message: fullOutcomeText,
      state: completeTravel(
        missionOutcome.state,
        destinationId,
        fullOutcomeText
      )
    };
}

export function completeTravel(state, destinationPlanetId, message) {
  const destination = getPlanet(destinationPlanetId);
  const persistentShip = restoreDockedShields(state.playerCombatShip);
  const travelDurationDays = state.pendingTravel?.travelDurationDays ?? 0;
  const dockedState = {
    ...state,
    mode: "trade",
    currentPlanetId: destination.id,
    currentDate: advanceDate(state.currentDate, travelDurationDays),
    pendingTravel: null,
    combat: null,
    tradedAtCurrentLocation: false,
    playerCombatShip: persistentShip
  };
  const missionArrival = resolveMissionArrival(dockedState, destination.id);
  const finalMessage = [message, missionArrival.message].filter(Boolean).join(" ");
  return appendMessage(
    refreshMissionOffers(missionArrival.state),
    `${finalMessage} Time elapsed: ${formatDuration(travelDurationDays)}.`
  );
}

// Rehydrate the player ship for a combat encounter, applying effective power capacity from upgrades.
function rehydratePlayerShip(battle, persistentShip, gameState) {
  const classId = persistentShip?.classId ?? PLAYER_CLASS_ID;
  const effectivePower = gameState ? getEffectivePowerCapacity(gameState) : undefined;
  const baseShip = buildShipState(classId, effectivePower !== undefined ? { powerCapacity: effectivePower } : {});
  const player = {
    ...baseShip,
    hull: persistentShip?.hull ?? baseShip.hull,
    shield: persistentShip?.shield ?? baseShip.shield,
    hullDamageTaken: 0,
    weapons: persistentShip?.weapons?.map((weapon) => ({ ...weapon, cooldownRemaining: 0 })) ?? baseShip.weapons
  };

  return {
    ...battle,
    player
  };
}

function restoreDockedShields(persistentShip) {
  const baseShip = buildShipState(persistentShip?.classId ?? PLAYER_CLASS_ID);
  return {
    classId: persistentShip?.classId ?? baseShip.classId,
    hull: persistentShip?.hull ?? baseShip.hull,
    shield: baseShip.shieldMax,
    weapons: persistentShip?.weapons?.map((weapon) => ({ ...weapon, cooldownRemaining: 0 })) ?? baseShip.weapons
  };
}

function rollCargoLoss(state, battle, rng) {
  const hullDamageTaken = battle.player.hullDamageTaken ?? 0;
  if (hullDamageTaken <= 0 || getCargoRemaining(state) >= state.cargoCapacity) {
    return { cargo: state.cargo, lost: [] };
  }

  const entries = Object.entries(state.cargo).filter(([, quantity]) => quantity > 0);
  if (entries.length === 0) {
    return { cargo: state.cargo, lost: [] };
  }

  const damageRatio = battle.player.hullMax > 0 ? hullDamageTaken / battle.player.hullMax : 0;
  const lossChance = clamp(0.08 + damageRatio * 0.7, 0.08, 0.75);
  if (rng.next() >= lossChance) {
    return { cargo: state.cargo, lost: [] };
  }

  const totalCargo = entries.reduce((sum, [, quantity]) => sum + quantity, 0);
  let toLose = Math.max(1, Math.min(totalCargo, Math.ceil(totalCargo * clamp(damageRatio, 0.05, 0.65) * (0.5 + rng.next()))));
  const nextCargo = { ...state.cargo };
  const lost = [];

  for (const [resourceId] of entries) {
    if (toLose <= 0) break;
    const available = nextCargo[resourceId] ?? 0;
    const quantity = Math.min(available, toLose);
    if (quantity <= 0) continue;
    nextCargo[resourceId] -= quantity;
    if (nextCargo[resourceId] === 0) delete nextCargo[resourceId];
    lost.push({ resourceId, name: getResource(resourceId).name, quantity });
    toLose -= quantity;
  }

  return { cargo: nextCargo, lost };
}

function clampRepair(battle) {
  if (battle.phase !== "allocate" || battle.player.hull < battle.player.hullMax || battle.player.allocation.repair === 0) {
    return battle;
  }

  return {
    ...battle,
    player: {
      ...battle.player,
      allocation: {
        ...battle.player.allocation,
        repair: 0
      }
    }
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
    messages: [message, ...state.messages].slice(0, 8)
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatDuration(days) {
  if (days % 7 === 0) {
    const weeks = days / 7;
    return `${weeks} ${weeks === 1 ? "week" : "weeks"}`;
  }
  return `${days} ${days === 1 ? "day" : "days"}`;
}

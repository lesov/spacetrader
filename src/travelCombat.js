import { ENEMY_CLASS_ID, PLAYER_CLASS_ID } from "./combat/data.js";
import { aggressorAI } from "./combat/ai.js";
import {
  buildShipState,
  createBattleState,
  resolveFullTurn,
  validateAllocation
} from "./combat/rules.js";
import { advanceDate, getPlanet, getTravelDurationDays, getTravelCost, serializeCombatShip } from "./game.js";

export const ENCOUNTER_CHANCE_BY_RISK = {
  low: 0.08,
  moderate: 0.22,
  high: 0.4
};

export function getEncounterChance(state, destinationPlanetId) {
  const destination = getPlanet(destinationPlanetId);
  const baseChance = ENCOUNTER_CHANCE_BY_RISK[destination.riskLevel] ?? ENCOUNTER_CHANCE_BY_RISK.low;
  const routeModifier = getTravelCost(state.currentPlanetId, destinationPlanetId) * 0.015;
  return clamp(baseChance + routeModifier, 0.05, 0.85);
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
    {
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
    },
    `Departed ${origin.name} for ${destination.name}. Fuel spent: ${fuelCost}.`
  );

  const encounter = rollTravelEncounter(departedState, destination.id, rng);
  if (encounter.triggered) {
    return startTravelBattle(departedState, destination.id, rng, encounter);
  }

  return {
    ok: true,
    encounterTriggered: false,
    message: `No hostile contact. Arrived at ${destination.name}.`,
    state: completeTravel(
      {
        ...departedState,
        pendingTravel: {
          ...departedState.pendingTravel,
          encounterRolled: true,
          encounterTriggered: false
        }
      },
      destination.id,
      `No hostile contact. Arrived at ${destination.name}.`
    )
  };
}

export function startTravelBattle(state, destinationPlanetId, rng, encounter) {
  const destination = getPlanet(destinationPlanetId);
  const battle = rehydratePlayerShip(createBattleState(PLAYER_CLASS_ID, ENEMY_CLASS_ID), state.playerCombatShip);
  const seed = Math.floor(rng.next() * 0xffffffff);
  const risk = Math.round(encounter.chance * 100);
  const message = `Hostile contact en route to ${destination.name}. Battle risk was ${risk}%.`;

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
          enemyClassId: ENEMY_CLASS_ID
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
    return applyBattleOutcome(nextState);
  }

  return {
    ok: true,
    message: "Battle turn resolved.",
    state: nextState
  };
}

export function applyBattleOutcome(state) {
  const battle = state.combat?.battle;
  if (!battle || battle.phase !== "ended") {
    return fail(state, "Battle is not complete.");
  }

  if (battle.winner === "player" || battle.winner === "escaped") {
    const destinationId = state.pendingTravel.destinationPlanetId;
    const destination = getPlanet(destinationId);
    const salvage = battle.winner === "player" ? 100 + state.pendingTravel.fuelCost * 10 : 0;
    const outcomeText = battle.winner === "player"
      ? `Victory near ${destination.name}. Salvage recovered: ${salvage} credits.`
      : `Escaped the encounter and continued to ${destination.name}.`;

    return {
      ok: true,
      message: outcomeText,
      state: completeTravel(
        {
          ...state,
          credits: state.credits + salvage,
          playerCombatShip: serializeCombatShip(battle.player, false)
        },
        destinationId,
        outcomeText
      )
    };
  }

  const message = battle.winner === "draw"
    ? "Both ships were destroyed. Run ended."
    : "Your ship was destroyed. Run ended.";

  return {
    ok: false,
    gameOver: true,
    message,
    state: appendMessage(
      {
        ...state,
        mode: "gameOver",
        pendingTravel: null
      },
      message
    )
  };
}

export function completeTravel(state, destinationPlanetId, message) {
  const destination = getPlanet(destinationPlanetId);
  const persistentShip = restoreDockedShields(state.playerCombatShip);
  const travelDurationDays = state.pendingTravel?.travelDurationDays ?? 0;
  return appendMessage(
    {
      ...state,
      mode: "trade",
      currentPlanetId: destination.id,
      currentDate: advanceDate(state.currentDate, travelDurationDays),
      pendingTravel: null,
      combat: null,
      tradedAtCurrentLocation: false,
      playerCombatShip: persistentShip
    },
    `${message} Time elapsed: ${formatDuration(travelDurationDays)}.`
  );
}

function rehydratePlayerShip(battle, persistentShip) {
  const baseShip = buildShipState(persistentShip?.classId ?? PLAYER_CLASS_ID);
  const player = {
    ...baseShip,
    hull: persistentShip?.hull ?? baseShip.hull,
    shield: persistentShip?.shield ?? baseShip.shield,
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

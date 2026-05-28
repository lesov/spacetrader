import assert from "node:assert/strict";
import test from "node:test";

import { advanceDate, createInitialState, getTravelDurationDays, getTravelCost } from "../src/game.js";
import { getDestinationRows } from "../src/uiState.js";
import {
  applyBattleOutcome,
  beginTravel,
  ENCOUNTER_CHANCE_BY_RISK,
  getEncounterChance,
  rollTravelEncounter
} from "../src/travelCombat.js";

function sequenceRng(values) {
  let index = 0;
  return {
    next() {
      const value = values[index] ?? values.at(-1) ?? 0.99;
      index += 1;
      return value;
    }
  };
}

function tradedState() {
  return {
    ...createInitialState(),
    tradedAtCurrentLocation: true
  };
}

test("encounter chance is destination-risk based with route modifier", () => {
  const state = createInitialState();
  const earthCost = getTravelCost("luna", "earth");
  const titanCost = getTravelCost("luna", "titan");
  const mercuryCost = getTravelCost("luna", "mercury");

  assert.equal(getEncounterChance(state, "earth"), ENCOUNTER_CHANCE_BY_RISK.low + earthCost * 0.015);
  assert.equal(getEncounterChance(state, "titan"), ENCOUNTER_CHANCE_BY_RISK.moderate + titanCost * 0.015);
  assert.equal(getEncounterChance(state, "mercury"), ENCOUNTER_CHANCE_BY_RISK.high + mercuryCost * 0.015);
  assert.ok(getEncounterChance(state, "mercury") < 1);
  assert.ok(getEncounterChance(state, "europa") > getEncounterChance(state, "earth"));
  assert.ok(getEncounterChance(state, "mercury") > getEncounterChance(state, "venus"));
});

test("encounter roll is deterministic with injected rng", () => {
  const state = createInitialState();
  const chance = getEncounterChance(state, "europa");

  const triggered = rollTravelEncounter(state, "europa", sequenceRng([chance - 0.01]));
  const avoided = rollTravelEncounter(state, "europa", sequenceRng([chance + 0.01]));

  assert.equal(triggered.triggered, true);
  assert.equal(avoided.triggered, false);
});

test("unconfirmed travel from an untraded location blocks before encounter roll", () => {
  const state = createInitialState();

  const result = beginTravel(state, "europa", {}, sequenceRng([0]));

  assert.equal(result.requiresConfirmation, true);
  assert.equal(result.state.currentPlanetId, "luna");
  assert.equal(result.state.fuel, state.fuel);
  assert.equal(result.state.mode, "trade");
  assert.equal(result.state.currentDate, state.currentDate);
});

test("travel without encounter spends fuel and arrives", () => {
  const state = tradedState();
  const cost = getTravelCost("luna", "europa");
  const days = getTravelDurationDays(cost);

  const result = beginTravel(state, "europa", {}, sequenceRng([0.99]));

  assert.equal(result.ok, true);
  assert.equal(result.encounterTriggered, false);
  assert.equal(result.state.mode, "trade");
  assert.equal(result.state.currentPlanetId, "europa");
  assert.equal(result.state.fuel, state.fuel - cost);
  assert.equal(result.state.currentDate, advanceDate(state.currentDate, days));
  assert.equal(result.state.pendingTravel, null);
});

test("high risk travel can enter combat before arrival when random roll is under chance", () => {
  const state = tradedState();
  const cost = getTravelCost("luna", "mercury");
  const chance = getEncounterChance(state, "mercury");

  const result = beginTravel(state, "mercury", {}, sequenceRng([chance - 0.01, 0.25]));

  assert.equal(result.ok, true);
  assert.equal(result.encounterTriggered, true);
  assert.equal(result.state.mode, "combat");
  assert.equal(result.state.currentPlanetId, "luna");
  assert.equal(result.state.fuel, state.fuel - cost);
  assert.equal(result.state.currentDate, state.currentDate);
  assert.equal(result.state.pendingTravel.destinationPlanetId, "mercury");
  assert.equal(result.state.pendingTravel.travelDurationDays, getTravelDurationDays(cost));
  assert.equal(result.state.combat.battle.phase, "allocate");
});

test("high risk travel can still avoid combat when random roll is over chance", () => {
  const state = tradedState();
  const cost = getTravelCost("luna", "mercury");
  const days = getTravelDurationDays(cost);
  const chance = getEncounterChance(state, "mercury");

  const result = beginTravel(state, "mercury", {}, sequenceRng([chance + 0.01]));

  assert.equal(result.ok, true);
  assert.equal(result.encounterTriggered, false);
  assert.equal(result.state.mode, "trade");
  assert.equal(result.state.currentPlanetId, "mercury");
  assert.equal(result.state.fuel, state.fuel - cost);
  assert.equal(result.state.currentDate, advanceDate(state.currentDate, days));
});

test("victory completes travel, awards salvage, and restores docked shields", () => {
  const state = beginTravel(tradedState(), "europa", {}, sequenceRng([0, 0.5])).state;
  const battle = {
    ...state.combat.battle,
    phase: "ended",
    winner: "player",
    player: {
      ...state.combat.battle.player,
      hull: 52,
      shield: 7,
      weapons: state.combat.battle.player.weapons.map((weapon) => (
        weapon.ammo === null ? weapon : { ...weapon, ammo: 3 }
      ))
    }
  };

  const result = applyBattleOutcome({
    ...state,
    combat: {
      ...state.combat,
      battle
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.state.mode, "trade");
  assert.equal(result.state.currentPlanetId, "europa");
  assert.equal(result.state.credits, 1000 + 100 + state.pendingTravel.fuelCost * 10);
  assert.equal(result.state.currentDate, advanceDate(state.currentDate, state.pendingTravel.travelDurationDays));
  assert.equal(result.state.playerCombatShip.hull, 52);
  assert.equal(result.state.playerCombatShip.shield, battle.player.shieldMax);
  assert.equal(result.state.pendingTravel, null);
});

test("escape completes travel without salvage", () => {
  const state = beginTravel(tradedState(), "europa", {}, sequenceRng([0, 0.5])).state;
  const battle = {
    ...state.combat.battle,
    phase: "ended",
    winner: "escaped",
    player: {
      ...state.combat.battle.player,
      hull: 61
    }
  };

  const result = applyBattleOutcome({
    ...state,
    combat: {
      ...state.combat,
      battle
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.state.mode, "trade");
  assert.equal(result.state.currentPlanetId, "europa");
  assert.equal(result.state.credits, 1000);
  assert.equal(result.state.currentDate, advanceDate(state.currentDate, state.pendingTravel.travelDurationDays));
  assert.equal(result.state.playerCombatShip.hull, 61);
});

test("defeat sets game over and does not complete travel", () => {
  const state = beginTravel(tradedState(), "europa", {}, sequenceRng([0, 0.5])).state;
  const battle = {
    ...state.combat.battle,
    phase: "ended",
    winner: "enemy"
  };

  const result = applyBattleOutcome({
    ...state,
    combat: {
      ...state.combat,
      battle
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.gameOver, true);
  assert.equal(result.state.mode, "gameOver");
  assert.equal(result.state.currentPlanetId, "luna");
  assert.equal(result.state.currentDate, state.currentDate);
  assert.equal(result.state.pendingTravel, null);
});

test("draw sets game over", () => {
  const state = beginTravel(tradedState(), "europa", {}, sequenceRng([0, 0.5])).state;
  const battle = {
    ...state.combat.battle,
    phase: "ended",
    winner: "draw"
  };

  const result = applyBattleOutcome({
    ...state,
    combat: {
      ...state.combat,
      battle
    }
  });

  assert.equal(result.state.mode, "gameOver");
  assert.match(result.message, /Both ships/);
});

test("cargo and credits are unchanged by combat escape", () => {
  const state = beginTravel({
    ...tradedState(),
    cargo: { metals: 4 },
    credits: 777
  }, "europa", {}, sequenceRng([0, 0.5])).state;
  const battle = {
    ...state.combat.battle,
    phase: "ended",
    winner: "escaped"
  };

  const result = applyBattleOutcome({
    ...state,
    combat: {
      ...state.combat,
      battle
    }
  });

  assert.deepEqual(result.state.cargo, { metals: 4 });
  assert.equal(result.state.credits, 777);
});

test("destination rows expose encounter risk labels", () => {
  const rows = getDestinationRows(createInitialState());

  assert.ok(rows.length > 0);
  assert.equal(rows.every((row) => row.encounterChance >= 0.05 && row.encounterChance <= 0.85), true);
  assert.equal(rows.some((row) => row.riskLevel === "high" && row.encounterChance > 0.4 && row.encounterChance < 1), true);
  assert.equal(rows.every((row) => /\d+% battle risk/.test(row.encounterRiskLabel)), true);
});

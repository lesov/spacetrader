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

  assert.equal(getEncounterChance(state, "earth"), ENCOUNTER_CHANCE_BY_RISK.low + earthCost * 0.02);
  assert.equal(getEncounterChance(state, "titan"), ENCOUNTER_CHANCE_BY_RISK.moderate + titanCost * 0.02);
  assert.equal(getEncounterChance(state, "mercury"), ENCOUNTER_CHANCE_BY_RISK.high + mercuryCost * 0.02);
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
  // sequenceRng([0, 0.5]): encounter roll=0 (triggers), enemy class roll=0.5 → vanguard
  const state = beginTravel(tradedState(), "europa", {}, sequenceRng([0, 0.5])).state;
  assert.equal(state.combat.enemyClassId, "vanguard");

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

  // Deterministic salvage rng: roll 0.5 each → vanguard credits=950, parts=8
  // vanguard: creditsMin=700 creditsMax=1200 partsMin=5 partsMax=10
  const result = applyBattleOutcome(
    { ...state, combat: { ...state.combat, battle } },
    sequenceRng([0.5, 0.5])
  );

  assert.equal(result.ok, true);
  assert.equal(result.state.mode, "trade");
  assert.equal(result.state.currentPlanetId, "europa");
  assert.equal(result.state.credits, 1000 + 950);
  assert.equal(result.state.cargo.shipParts, 8);
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

test("enemy escape completes travel without salvage", () => {
  const state = beginTravel(tradedState(), "europa", {}, sequenceRng([0, 0.5])).state;
  const battle = {
    ...state.combat.battle,
    phase: "ended",
    winner: "enemyEscaped",
    player: {
      ...state.combat.battle.player,
      hull: 78
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
  assert.equal(result.state.cargo.shipParts, undefined);
});

test("cargo can be lost after battle only when hull damage was sustained", () => {
  const state = beginTravel({
    ...tradedState(),
    cargo: { metals: 6, water: 4 }
  }, "europa", {}, sequenceRng([0, 0.5])).state;

  const damagedBattle = {
    ...state.combat.battle,
    phase: "ended",
    winner: "escaped",
    player: {
      ...state.combat.battle.player,
      hullDamageTaken: 60
    }
  };

  const damagedResult = applyBattleOutcome(
    { ...state, combat: { ...state.combat, battle: damagedBattle } },
    sequenceRng([0.01, 0.5])
  );

  assert.ok((damagedResult.state.cargo.metals ?? 0) + (damagedResult.state.cargo.water ?? 0) < 10);
  assert.match(damagedResult.message, /Cargo lost/);

  const cleanBattle = {
    ...damagedBattle,
    player: { ...damagedBattle.player, hullDamageTaken: 0 }
  };
  const cleanResult = applyBattleOutcome(
    { ...state, combat: { ...state.combat, battle: cleanBattle } },
    sequenceRng([0.01, 0.5])
  );

  assert.deepEqual(cleanResult.state.cargo, { metals: 6, water: 4 });
});

test("destination rows expose encounter risk labels", () => {
  const rows = getDestinationRows(createInitialState());

  assert.ok(rows.length > 0);
  assert.equal(rows.every((row) => row.encounterChance >= 0.08 && row.encounterChance <= 0.9), true);
  assert.equal(rows.some((row) => row.riskLevel === "high" && row.encounterChance > 0.55 && row.encounterChance < 1), true);
  assert.equal(rows.every((row) => /\d+% battle risk/.test(row.encounterRiskLabel)), true);
});

test("enemy class is selected by weighted roll: low roll gives falcon, high roll gives bastion", () => {
  // roll=0.2 → falcon (< 0.45)
  const falconResult = beginTravel(tradedState(), "mercury", {}, sequenceRng([0, 0.2, 0.5]));
  assert.equal(falconResult.state.combat.enemyClassId, "falcon");

  // roll=0.6 → vanguard (0.45 ≤ x < 0.75)
  const vanguardResult = beginTravel(tradedState(), "mercury", {}, sequenceRng([0, 0.6, 0.5]));
  assert.equal(vanguardResult.state.combat.enemyClassId, "vanguard");

  // roll=0.85 → leviathan (0.75 ≤ x < 0.90)
  const leviathanResult = beginTravel(tradedState(), "mercury", {}, sequenceRng([0, 0.85, 0.5]));
  assert.equal(leviathanResult.state.combat.enemyClassId, "leviathan");

  // roll=0.95 → bastion (≥ 0.90)
  const bastionResult = beginTravel(tradedState(), "mercury", {}, sequenceRng([0, 0.95, 0.5]));
  assert.equal(bastionResult.state.combat.enemyClassId, "bastion");
});

test("encounter message names the enemy ship class", () => {
  const result = beginTravel(tradedState(), "mercury", {}, sequenceRng([0, 0.95, 0.5]));
  assert.match(result.message, /Bastion-class Gunboat/);
});

test("victory awards more credits and parts for bastion than for falcon", () => {
  const endedBattle = (baseState) => ({
    ...baseState.combat.battle,
    phase: "ended",
    winner: "player"
  });

  const falconState = beginTravel(tradedState(), "mercury", {}, sequenceRng([0, 0.2, 0.5])).state;
  const falconResult = applyBattleOutcome(
    { ...falconState, combat: { ...falconState.combat, battle: endedBattle(falconState) } },
    sequenceRng([0.5, 0.5])
  );
  assert.equal(falconResult.state.credits, 1000 + 525);
  assert.equal(falconResult.state.cargo.shipParts, 5);

  const bastionState = beginTravel(tradedState(), "mercury", {}, sequenceRng([0, 0.95, 0.5])).state;
  const bastionResult = applyBattleOutcome(
    { ...bastionState, combat: { ...bastionState.combat, battle: endedBattle(bastionState) } },
    sequenceRng([0.5, 0.5])
  );
  assert.equal(bastionResult.state.credits, 1000 + 1900);
  assert.equal(bastionResult.state.cargo.shipParts, 14);

  assert.ok(bastionResult.state.credits > falconResult.state.credits);
  assert.ok(bastionResult.state.cargo.shipParts > falconResult.state.cargo.shipParts);
});

test("salvage ship parts are capped at available cargo space", () => {
  // Fill cargo almost to the brim: capacity 20, use 19
  const fullState = {
    ...tradedState(),
    cargo: { metals: 19 }
  };
  const combatState = beginTravel(fullState, "mercury", {}, sequenceRng([0, 0.95, 0.5])).state;
  const battle = { ...combatState.combat.battle, phase: "ended", winner: "player" };

  // bastion gives 5-9 parts, but only 1 cargo slot is free
  const result = applyBattleOutcome(
    { ...combatState, combat: { ...combatState.combat, battle } },
    sequenceRng([0.5, 0.5])
  );

  assert.equal(result.state.cargo.shipParts, 1);
});

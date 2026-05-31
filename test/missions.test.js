import assert from "node:assert/strict";
import test from "node:test";

import { createInitialState, getCargoRemaining } from "../src/game.js";
import {
  MISSION_TYPES,
  acceptMission,
  generateMissionOffers
} from "../src/missions.js";
import { getDestinationRows, getMissionView } from "../src/uiState.js";
import { applyBattleOutcome, beginTravel } from "../src/travelCombat.js";

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

function missionOfType(state, type) {
  return state.missions.offers.find((mission) => mission.type === type);
}

test("initial state exposes one offer for each mission type", () => {
  const state = createInitialState();
  const types = state.missions.offers.map((mission) => mission.type).sort();

  assert.deepEqual(types, [
    MISSION_TYPES.bounty,
    MISSION_TYPES.contraband,
    MISSION_TYPES.escort,
    MISSION_TYPES.patrol
  ].sort());
  assert.equal(state.missions.accepted, null);
  assert.equal(state.missions.active, null);
});

test("mission generation is deterministic for the same location and date", () => {
  const state = createInitialState();

  assert.deepEqual(generateMissionOffers(state), generateMissionOffers(state));
});

test("accepting a mission allows only one mission and reserves mission cargo", () => {
  const state = createInitialState();
  const contraband = missionOfType(state, MISSION_TYPES.contraband);
  const accepted = acceptMission(state, contraband.id).state;

  assert.equal(accepted.tradedAtCurrentLocation, true);
  assert.equal(accepted.missions.accepted.id, contraband.id);
  assert.equal(getCargoRemaining(accepted), state.cargoCapacity - contraband.cargoRequired);

  const secondMission = accepted.missions.offers.find((mission) => mission.id !== contraband.id);
  const rejected = acceptMission(accepted, secondMission.id);
  assert.equal(rejected.ok, false);
  assert.match(rejected.message, /Only one mission/);
});

test("accepted mission locks departure to its immediate destination", () => {
  const state = createInitialState();
  const mission = missionOfType(state, MISSION_TYPES.escort);
  const accepted = acceptMission(state, mission.id).state;

  const rows = getDestinationRows(accepted);
  const missionDestination = rows.find((row) => row.id === mission.destinationPlanetId);
  const otherDestinations = rows.filter((row) => row.id !== mission.destinationPlanetId);

  assert.equal(missionDestination.canTravel, true);
  assert.equal(otherDestinations.every((row) => row.canTravel === false), true);
  assert.equal(otherDestinations.every((row) => /Accepted mission requires/.test(row.missionDepartureError)), true);
});

test("unaccepted mission offers expire on departure and refresh at the next port", () => {
  const state = { ...createInitialState(), tradedAtCurrentLocation: true };
  const result = beginTravel(state, "europa", {}, sequenceRng([0.99]));

  assert.equal(result.state.currentPlanetId, "europa");
  assert.equal(result.state.missions.accepted, null);
  assert.equal(result.state.missions.active, null);
  assert.equal(result.state.missions.offers.length, 4);
  assert.equal(result.state.missions.offers.every((mission) => mission.originPlanetId === "europa"), true);
});

test("contraband mission can clear departure and pay on arrival", () => {
  const state = createInitialState();
  const mission = missionOfType(state, MISSION_TYPES.contraband);
  const accepted = acceptMission(state, mission.id).state;

  const result = beginTravel(
    accepted,
    mission.destinationPlanetId,
    {},
    sequenceRng([0.99, 0.99])
  );

  assert.equal(result.state.mode, "trade");
  assert.equal(result.state.currentPlanetId, mission.destinationPlanetId);
  assert.equal(result.state.credits, state.credits + mission.rewardCredits);
  assert.equal(result.state.missions.completed[0].id, mission.id);
  assert.equal(result.state.missions.completed[0].status, "completed");
  assert.equal(getCargoRemaining(result.state), result.state.cargoCapacity);
});

test("contraband mission can fail immediately on departure inspection", () => {
  const state = createInitialState();
  const mission = missionOfType(state, MISSION_TYPES.contraband);
  const accepted = acceptMission(state, mission.id).state;

  const result = beginTravel(
    accepted,
    mission.destinationPlanetId,
    {},
    sequenceRng([0, 0.99])
  );

  assert.equal(result.state.mode, "trade");
  assert.equal(result.state.credits, state.credits);
  assert.equal(result.state.missions.completed[0].id, mission.id);
  assert.equal(result.state.missions.completed[0].status, "failed");
});

test("bounty mission forces target combat and pays only after victory", () => {
  const state = createInitialState();
  const mission = missionOfType(state, MISSION_TYPES.bounty);
  const accepted = acceptMission(state, mission.id).state;

  const combatResult = beginTravel(
    accepted,
    mission.destinationPlanetId,
    {},
    sequenceRng([0.5])
  );

  assert.equal(combatResult.state.mode, "combat");
  assert.equal(combatResult.state.combat.enemyClassId, mission.enemyClassId);
  assert.equal(combatResult.state.combat.missionContext.missionId, mission.id);

  const battle = {
    ...combatResult.state.combat.battle,
    phase: "ended",
    winner: "player"
  };
  const result = applyBattleOutcome(
    { ...combatResult.state, combat: { ...combatResult.state.combat, battle } },
    sequenceRng([0.5, 0.5])
  );

  assert.equal(result.state.mode, "trade");
  assert.equal(result.state.missions.completed[0].status, "completed");
  assert.ok(result.state.credits > state.credits + mission.rewardCredits);
});

test("escort mission fails if the player abandons the merchant during combat", () => {
  const state = createInitialState();
  const mission = missionOfType(state, MISSION_TYPES.escort);
  const accepted = acceptMission(state, mission.id).state;
  const combatResult = beginTravel(
    accepted,
    mission.destinationPlanetId,
    {},
    sequenceRng([0, 0.5])
  );
  const battle = {
    ...combatResult.state.combat.battle,
    phase: "ended",
    winner: "escaped"
  };

  const result = applyBattleOutcome({
    ...combatResult.state,
    combat: { ...combatResult.state.combat, battle }
  });

  assert.equal(result.state.mode, "trade");
  assert.equal(result.state.credits, state.credits);
  assert.equal(result.state.missions.completed[0].status, "failed");
  assert.match(result.state.missions.completed[0].failureReason, /abandoned/);
});

test("mission view marks offers unavailable after accepting one", () => {
  const state = createInitialState();
  const mission = missionOfType(state, MISSION_TYPES.patrol);
  const accepted = acceptMission(state, mission.id).state;
  const view = getMissionView(accepted);

  assert.equal(view.accepted.id, mission.id);
  assert.equal(view.rows.every((row) => row.canAccept === false), true);
});

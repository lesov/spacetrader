import { planets } from "./data.js";

const PLANET_BY_ID = Object.fromEntries(planets.map((planet) => [planet.id, planet]));

export const MISSION_TYPES = {
  contraband: "contraband",
  patrol: "patrol",
  bounty: "bounty",
  escort: "escort"
};

export const MISSION_TYPE_LABELS = {
  contraband: "Contraband Delivery",
  patrol: "Patrol Route",
  bounty: "Bounty Hunt",
  escort: "Merchant Escort"
};

const RISK_MULTIPLIER = {
  low: 1,
  moderate: 1.35,
  high: 1.8
};

const CONTRABAND_PAYLOADS = [
  "undocumented settlers",
  "dissident courier cell",
  "forbidden tech cores",
  "banned print cylinders",
  "criminal witness transit",
  "forced-labor escapees"
];

const SOURCES = [
  "Dockside broker",
  "Free-port syndicate",
  "Quiet consulate",
  "Mutual aid cell",
  "Insurance factor",
  "Belt liaison"
];

const BOUNTY_TARGETS = [
  "Kade Marrow",
  "Sera Voss",
  "The Glass Jackal",
  "Oren Pike",
  "Nyx Calder",
  "Vega Cross"
];

const ENEMY_BY_RISK = {
  low: "falcon",
  moderate: "vanguard",
  high: "bastion"
};

export function createMissionState(state) {
  return {
    offers: generateMissionOffers(state),
    accepted: null,
    active: null,
    completed: []
  };
}

export function ensureMissionState(state) {
  return state.missions ?? createMissionState(state);
}

export function refreshMissionOffers(state) {
  const missions = ensureMissionState(state);
  return {
    ...state,
    missions: {
      ...missions,
      offers: generateMissionOffers(state),
      accepted: null,
      active: null
    }
  };
}

export function generateMissionOffers(state) {
  const origin = getPlanet(state.currentPlanetId);
  const seed = hashString(`${origin.id}:${state.currentDate}`);
  const contrabandDestination = pickDestination(origin.id, seed, 1);
  const patrolDestination = pickDestination(origin.id, seed, 4);
  const bountyDestination = pickDestination(origin.id, seed, 7);
  const escortDestination = pickDestination(origin.id, seed, 10);

  return [
    createContrabandMission(origin, contrabandDestination, seed),
    createPatrolMission(origin, patrolDestination, seed + 13),
    createBountyMission(origin, bountyDestination, seed + 29),
    createEscortMission(origin, escortDestination, seed + 47)
  ];
}

export function acceptMission(state, missionId) {
  const missions = ensureMissionState(state);
  if (missions.accepted || missions.active) {
    return fail(state, "Only one mission can be active at a time.");
  }

  const mission = missions.offers.find((offer) => offer.id === missionId);
  if (!mission) {
    return fail(state, "Mission offer is no longer available.");
  }

  if (getCargoAvailableForMission(state) < mission.cargoRequired) {
    return fail(state, `Mission requires ${mission.cargoRequired} open cargo slots.`);
  }

  const accepted = {
    ...mission,
    status: "accepted",
    acceptedAtDate: state.currentDate
  };

  return succeed(
    {
      ...state,
      tradedAtCurrentLocation: true,
      missions: {
        ...missions,
        accepted
      }
    },
    `Accepted mission: ${mission.title}. Depart for ${getPlanet(mission.destinationPlanetId).name} to proceed.`
  );
}

export function abandonAcceptedMission(state) {
  const missions = ensureMissionState(state);
  if (!missions.accepted) {
    return fail(state, "No accepted mission to abandon.");
  }

  return succeed(
    {
      ...state,
      missions: {
        ...missions,
        accepted: null
      }
    },
    `Abandoned mission: ${missions.accepted.title}.`
  );
}

export function validateMissionDeparture(state, destinationPlanetId) {
  const mission = ensureMissionState(state).accepted;
  if (!mission) return "";
  if (mission.destinationPlanetId !== destinationPlanetId) {
    return `Accepted mission requires immediate departure to ${getPlanet(mission.destinationPlanetId).name}.`;
  }
  return "";
}

export function activateMissionForDeparture(state, destinationPlanetId) {
  const missions = ensureMissionState(state);
  const accepted = missions.accepted;
  if (!accepted) {
    return {
      ...state,
      missions: {
        ...missions,
        offers: []
      }
    };
  }

  return {
    ...state,
    missions: {
      ...missions,
      offers: [],
      accepted: null,
      active: {
        ...accepted,
        status: "active",
        destinationPlanetId,
        departedAtDate: state.currentDate
      }
    }
  };
}

export function resolveMissionDepartureEvent(state, rng) {
  const mission = ensureMissionState(state).active;
  if (!mission) {
    return { state, message: "", encounter: null };
  }

  if (mission.type === MISSION_TYPES.contraband) {
    const roll = rng.next();
    if (roll < mission.failureChance) {
      return failMissionState(
        state,
        `Mission failed: port authority sweep exposed ${mission.payload}.`
      );
    }
    return { state, message: `Mission cargo cleared departure: ${mission.payload}.`, encounter: null };
  }

  if (mission.type === MISSION_TYPES.bounty) {
    return {
      state,
      message: `Bounty target located on departure: ${mission.targetName}.`,
      encounter: {
        missionId: mission.id,
        type: mission.type,
        enemyClassId: mission.enemyClassId,
        chance: 1
      }
    };
  }

  if (mission.type === MISSION_TYPES.patrol || mission.type === MISSION_TYPES.escort) {
    const roll = rng.next();
    if (roll < mission.encounterChance) {
      return {
        state,
        message: mission.type === MISSION_TYPES.patrol
          ? "Patrol sweep found a hostile contact."
          : "Escort convoy intercepted by a hostile ship.",
        encounter: {
          missionId: mission.id,
          type: mission.type,
          enemyClassId: mission.enemyClassId,
          chance: mission.encounterChance
        }
      };
    }
  }

  return { state, message: "", encounter: null };
}

export function getActiveMissionCombatContext(state) {
  const mission = ensureMissionState(state).active;
  if (!mission) return null;
  return {
    missionId: mission.id,
    type: mission.type
  };
}

export function resolveMissionBattleOutcome(state, winner) {
  const mission = ensureMissionState(state).active;
  if (!mission) {
    return { state, message: "" };
  }

  if (winner === "enemy" || winner === "draw") {
    return failMissionState(state, "Mission failed: ship destroyed before completion.");
  }

  if (mission.type === MISSION_TYPES.bounty) {
    if (winner === "player") {
      return completeMissionState(state, `Bounty paid: ${mission.targetName} neutralized.`);
    }
    if (winner === "escaped" || winner === "enemyEscaped") {
      return failMissionState(state, `Mission failed: ${mission.targetName} escaped the bounty net.`);
    }
  }

  if (mission.type === MISSION_TYPES.patrol) {
    if (winner === "player" || winner === "enemyEscaped") {
      return completeMissionState(state, "Patrol complete: hostile contact driven off.");
    }
    if (winner === "escaped") {
      return failMissionState(state, "Mission failed: patrol coordinates abandoned.");
    }
  }

  if (mission.type === MISSION_TYPES.escort) {
    if (winner === "player" || winner === "enemyEscaped") {
      return completeMissionState(state, "Escort complete: merchant ship survived contact.");
    }
    if (winner === "escaped") {
      return failMissionState(state, "Mission failed: merchant escort abandoned during combat.");
    }
  }

  return { state, message: "" };
}

export function resolveMissionArrival(state, destinationPlanetId) {
  const mission = ensureMissionState(state).active;
  if (!mission) {
    return { state, message: "" };
  }

  if (mission.destinationPlanetId !== destinationPlanetId) {
    return failMissionState(state, `Mission failed: missed arrival at ${getPlanet(mission.destinationPlanetId).name}.`);
  }

  if (mission.type === MISSION_TYPES.contraband) {
    return completeMissionState(state, `Delivery complete: ${mission.payload} received.`);
  }

  if (mission.type === MISSION_TYPES.patrol) {
    return completeMissionState(state, "Patrol complete: coordinates logged clear.");
  }

  if (mission.type === MISSION_TYPES.escort) {
    return completeMissionState(state, "Escort complete: merchant ship reached port.");
  }

  return failMissionState(state, "Mission failed: bounty target was not resolved before arrival.");
}

export function getMissionCargoUsed(state) {
  const missions = ensureMissionState(state);
  const mission = missions.accepted ?? missions.active;
  return mission?.cargoRequired ?? 0;
}

export function getMissionTypeLabel(type) {
  return MISSION_TYPE_LABELS[type] ?? "Mission";
}

function createContrabandMission(origin, destination, seed) {
  const cargoRequired = 2 + (seed % 3);
  const payload = pick(CONTRABAND_PAYLOADS, seed, 2);
  const rewardCredits = scaleReward(520, 78, origin.id, destination.id, destination.riskLevel) + cargoRequired * 90;
  return baseMission({
    type: MISSION_TYPES.contraband,
    origin,
    destination,
    seed,
    title: `Move ${payload}`,
    summary: `${cargoRequired} sealed units must reach ${destination.name}.`,
    source: pick(SOURCES, seed, 3),
    rewardCredits,
    cargoRequired,
    payload,
    failureChance: clamp(0.08 + riskValue(destination.riskLevel) * 0.04, 0.08, 0.22)
  });
}

function createPatrolMission(origin, destination, seed) {
  return baseMission({
    type: MISSION_TYPES.patrol,
    origin,
    destination,
    seed,
    title: `Patrol ${destination.name} transfer lane`,
    summary: `Sweep the departure corridor and log any hostile activity.`,
    source: pick(SOURCES, seed, 5),
    rewardCredits: scaleReward(420, 64, origin.id, destination.id, destination.riskLevel),
    cargoRequired: 0,
    encounterChance: clamp(0.14 + riskValue(destination.riskLevel) * 0.13, 0.14, 0.54),
    enemyClassId: ENEMY_BY_RISK[destination.riskLevel] ?? "vanguard"
  });
}

function createBountyMission(origin, destination, seed) {
  const targetName = pick(BOUNTY_TARGETS, seed, 7);
  return baseMission({
    type: MISSION_TYPES.bounty,
    origin,
    destination,
    seed,
    title: `Bounty: ${targetName}`,
    summary: `Intercept a wanted captain before the ship clears the route.`,
    source: pick(SOURCES, seed, 11),
    rewardCredits: scaleReward(850, 108, origin.id, destination.id, destination.riskLevel),
    cargoRequired: 0,
    targetName,
    enemyClassId: ENEMY_BY_RISK[destination.riskLevel] ?? "vanguard"
  });
}

function createEscortMission(origin, destination, seed) {
  return baseMission({
    type: MISSION_TYPES.escort,
    origin,
    destination,
    seed,
    title: `Escort merchant to ${destination.name}`,
    summary: `An unarmed merchant hull needs cover on departure.`,
    source: pick(SOURCES, seed, 13),
    rewardCredits: scaleReward(620, 72, origin.id, destination.id, destination.riskLevel),
    cargoRequired: 0,
    encounterChance: clamp(0.18 + riskValue(destination.riskLevel) * 0.11, 0.18, 0.5),
    enemyClassId: ENEMY_BY_RISK[destination.riskLevel] ?? "vanguard"
  });
}

function baseMission(options) {
  return {
    id: `${options.origin.id}-${options.destination.id}-${options.type}-${options.seed}`,
    type: options.type,
    title: options.title,
    summary: options.summary,
    source: options.source,
    originPlanetId: options.origin.id,
    destinationPlanetId: options.destination.id,
    rewardCredits: options.rewardCredits,
    cargoRequired: options.cargoRequired,
    riskLevel: options.destination.riskLevel,
    status: "available",
    expiresOnDeparture: true,
    payload: options.payload,
    targetName: options.targetName,
    enemyClassId: options.enemyClassId,
    encounterChance: options.encounterChance ?? 0,
    failureChance: options.failureChance ?? 0
  };
}

function completeMissionState(state, message) {
  const missions = ensureMissionState(state);
  const mission = missions.active;
  if (!mission) return { state, message: "" };
  const completedMission = {
    ...mission,
    status: "completed",
    completedAtDate: state.currentDate
  };

  return {
    state: {
      ...state,
      credits: state.credits + mission.rewardCredits,
      missions: {
        ...missions,
        active: null,
        completed: [completedMission, ...(missions.completed ?? [])].slice(0, 5)
      }
    },
    message: `${message} Mission reward: ${formatCredits(mission.rewardCredits)}.`
  };
}

function failMissionState(state, message) {
  const missions = ensureMissionState(state);
  const mission = missions.active;
  if (!mission) return { state, message: "" };
  const failedMission = {
    ...mission,
    status: "failed",
    failedAtDate: state.currentDate,
    failureReason: message
  };

  return {
    state: {
      ...state,
      missions: {
        ...missions,
        active: null,
        completed: [failedMission, ...(missions.completed ?? [])].slice(0, 5)
      }
    },
    message
  };
}

function getCargoAvailableForMission(state) {
  const cargoUsed = Object.values(state.cargo ?? {}).reduce((sum, quantity) => sum + quantity, 0);
  return state.cargoCapacity - cargoUsed - getMissionCargoUsed(state);
}

function scaleReward(base, perFuel, originId, destinationId, riskLevel) {
  const reward = base + getTravelCost(originId, destinationId) * perFuel;
  return Math.round(reward * (RISK_MULTIPLIER[riskLevel] ?? 1));
}

function pickDestination(originPlanetId, seed, offset) {
  const candidates = planets.filter((planet) => planet.id !== originPlanetId);
  return candidates[(seed + offset) % candidates.length];
}

function getTravelCost(fromPlanetId, toPlanetId) {
  const from = getPlanet(fromPlanetId);
  const to = getPlanet(toPlanetId);
  const dx = from.position.x - to.position.x;
  const dy = from.position.y - to.position.y;
  return Math.max(4, Math.ceil(Math.sqrt(dx * dx + dy * dy) / 34));
}

function getPlanet(planetId) {
  const planet = PLANET_BY_ID[planetId];
  if (!planet) throw new Error(`Unknown planet: ${planetId}`);
  return planet;
}

function pick(values, seed, offset) {
  return values[(seed + offset) % values.length];
}

function riskValue(riskLevel) {
  if (riskLevel === "high") return 3;
  if (riskLevel === "moderate") return 2;
  return 1;
}

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function succeed(nextState, message) {
  return {
    ok: true,
    message,
    state: appendMessage(nextState, message)
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
    messages: [message, ...(state.messages ?? [])].slice(0, 8)
  };
}

function formatCredits(value) {
  return `${new Intl.NumberFormat("en-US").format(value)} cr`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

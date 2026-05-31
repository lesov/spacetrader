import { PLAYER_CLASS_ID, SHIP_CLASSES } from "./combat/data.js";
import { buildShipState } from "./combat/rules.js";
import { cloneCombatPresets } from "./combat/uiState.js";
import { FUEL_RESOURCE_ID, campaign, planets, resources, startingPlayer } from "./data.js";
import { applyMarketModifier, getMarketModifier } from "./events.js";
import { createMissionState, getMissionCargoUsed } from "./missions.js";

export const PLANET_BY_ID = Object.fromEntries(planets.map((planet) => [planet.id, planet]));
export const RESOURCE_BY_ID = Object.fromEntries(resources.map((resource) => [resource.id, resource]));
export const RESOURCE_IDS = resources.map((resource) => resource.id);
export const PLANET_IDS = planets.map((planet) => planet.id);

// ── Upgrade constants ─────────────────────────────────────────────────────────

export const CARGO_UPGRADE = { step: 6, max: 4 };
export const POWER_UPGRADE = { step: 1, max: 4 };

// ── Effective capacity getters ────────────────────────────────────────────────

export function getEffectivePowerCapacity(state) {
  const classId = state.playerCombatShip?.classId ?? PLAYER_CLASS_ID;
  const cls = SHIP_CLASSES[classId];
  return cls.powerCapacity + (state.shipUpgrades?.power ?? 0) * POWER_UPGRADE.step;
}

export function getEffectiveCargoCapacity(state) {
  const classId = state.playerCombatShip?.classId ?? PLAYER_CLASS_ID;
  const cls = SHIP_CLASSES[classId];
  return cls.cargoCapacity + (state.shipUpgrades?.cargo ?? 0) * CARGO_UPGRADE.step;
}

// ── State initialization ──────────────────────────────────────────────────────

export function createInitialState() {
  const startingPlanet = getPlanet(startingPlayer.currentPlanetId);
  const initialShipUpgrades = { cargo: 0, power: 0 };
  const initialCombatShip = createInitialCombatShip();

  // Build a minimal stub so getEffectiveCargoCapacity can read classId
  const stub = {
    playerCombatShip: initialCombatShip,
    shipUpgrades: initialShipUpgrades
  };

  return {
    credits: startingPlayer.credits,
    currentPlanetId: startingPlayer.currentPlanetId,
    currentDate: campaign.startDate,
    fuel: startingPlayer.fuel,
    cargoCapacity: getEffectiveCargoCapacity(stub),
    cargo: {},
    combatPresets: cloneCombatPresets(),
    shipUpgrades: initialShipUpgrades,
    missions: createMissionState({
      currentPlanetId: startingPlayer.currentPlanetId,
      currentDate: campaign.startDate
    }),
    tradedAtCurrentLocation: false,
    mode: "trade",
    pendingTravel: null,
    combat: null,
    playerCombatShip: initialCombatShip,
    messages: [`Docked at ${startingPlanet.name}. ${campaign.startLabel} trading charter initialized.`]
  };
}

export function createInitialCombatShip() {
  return serializeCombatShip(buildShipState(PLAYER_CLASS_ID), true);
}

export function serializeCombatShip(ship, restoreShields = false) {
  return {
    classId: ship.classId,
    hull: ship.hull,
    shield: restoreShields ? ship.shieldMax : ship.shield,
    weapons: ship.weapons.map((weapon) => ({ ...weapon }))
  };
}

export function getPlanet(planetId) {
  const planet = PLANET_BY_ID[planetId];
  if (!planet) {
    throw new Error(`Unknown planet: ${planetId}`);
  }
  return planet;
}

export function getResource(resourceId) {
  const resource = RESOURCE_BY_ID[resourceId];
  if (!resource) {
    throw new Error(`Unknown resource: ${resourceId}`);
  }
  return resource;
}

export function isFuel(resourceId) {
  return resourceId === FUEL_RESOURCE_ID;
}

export const EMERGENCY_FUEL_MULTIPLIER = 5;

export function getMarketPrice(planetId, resourceId, dateText = campaign.startDate) {
  const planet = getPlanet(planetId);
  getResource(resourceId);
  const range = planet.priceRanges[resourceId];
  if (!range) {
    throw new Error(`Missing price range for ${resourceId} on ${planetId}`);
  }
  const basePrice = Math.round((range.min + range.max) / 2);
  return applyMarketModifier(basePrice, getMarketModifier(dateText, planetId, resourceId));
}

export function getEmergencyFuelQuote(state, destinationPlanetId) {
  const destination = getPlanet(destinationPlanetId);
  if (destination.id === state.currentPlanetId) {
    return { neededFuel: 0, unitPrice: 0, total: 0, canAfford: true };
  }

  const travelCost = getTravelCost(state.currentPlanetId, destination.id);
  const neededFuel = Math.max(0, travelCost - state.fuel);
  const unitPrice = getMarketPrice(state.currentPlanetId, FUEL_RESOURCE_ID, state.currentDate) * EMERGENCY_FUEL_MULTIPLIER;
  const total = neededFuel * unitPrice;
  return {
    neededFuel,
    unitPrice,
    total,
    canAfford: neededFuel > 0 && state.credits >= total
  };
}

export function getCargoUsed(state) {
  return Object.values(state.cargo).reduce((total, quantity) => total + quantity, 0) + getMissionCargoUsed(state);
}

export function getCargoRemaining(state) {
  return state.cargoCapacity - getCargoUsed(state);
}

export function getOwnedQuantity(state, resourceId) {
  return state.cargo[resourceId] ?? 0;
}

export function getTravelCost(fromPlanetId, toPlanetId) {
  const from = getPlanet(fromPlanetId);
  const to = getPlanet(toPlanetId);
  if (from.id === to.id) {
    return 0;
  }

  const dx = from.position.x - to.position.x;
  const dy = from.position.y - to.position.y;
  return Math.max(4, Math.ceil(Math.sqrt(dx * dx + dy * dy) / 34));
}

export function getTravelDurationDays(fuelCost) {
  return fuelCost * campaign.travelDaysPerFuel;
}

export function advanceDate(dateText, days) {
  const date = parseGameDate(dateText);
  date.setUTCDate(date.getUTCDate() + days);
  return formatGameDateIso(date);
}

export function getDestinations(currentPlanetId) {
  getPlanet(currentPlanetId);
  return planets
    .filter((planet) => planet.id !== currentPlanetId)
    .map((planet) => ({
      ...planet,
      fuelCost: getTravelCost(currentPlanetId, planet.id),
      travelDurationDays: getTravelDurationDays(getTravelCost(currentPlanetId, planet.id))
    }));
}

export function buyResource(state, resourceId, quantity) {
  const validationError = validateTrade(resourceId, quantity);
  if (validationError) {
    return fail(state, validationError);
  }

  const resource = getResource(resourceId);
  const price = getMarketPrice(state.currentPlanetId, resourceId, state.currentDate);
  const total = price * quantity;
  if (state.credits < total) {
    return fail(state, `Need ${formatNumber(total)} credits to buy ${quantity} ${resource.name}.`);
  }

  if (isFuel(resourceId)) {
    return succeed(
      {
        ...state,
        credits: state.credits - total,
        fuel: state.fuel + quantity,
        tradedAtCurrentLocation: true
      },
      `Bought ${quantity} ${resource.name} for ${formatNumber(total)} credits.`
    );
  }

  if (getCargoRemaining(state) < quantity) {
    return fail(state, `Cargo hold needs ${quantity} open slots.`);
  }

  return succeed(
    {
      ...state,
      credits: state.credits - total,
      tradedAtCurrentLocation: true,
      cargo: {
        ...state.cargo,
        [resourceId]: getOwnedQuantity(state, resourceId) + quantity
      }
    },
    `Bought ${quantity} ${resource.name} for ${formatNumber(total)} credits.`
  );
}

export function sellResource(state, resourceId, quantity) {
  const validationError = validateTrade(resourceId, quantity);
  if (validationError) {
    return fail(state, validationError);
  }

  const resource = getResource(resourceId);
  const price = getMarketPrice(state.currentPlanetId, resourceId, state.currentDate);

  if (isFuel(resourceId)) {
    if (state.fuel < quantity) {
      return fail(state, `Only ${state.fuel} ${resource.name} available to sell.`);
    }

    const total = price * quantity;
    return succeed(
      {
        ...state,
        credits: state.credits + total,
        fuel: state.fuel - quantity,
        tradedAtCurrentLocation: true
      },
      `Sold ${quantity} ${resource.name} for ${formatNumber(total)} credits.`
    );
  }

  const owned = getOwnedQuantity(state, resourceId);
  if (owned < quantity) {
    return fail(state, `Only ${owned} ${resource.name} available to sell.`);
  }

  const total = price * quantity;
  const nextCargo = { ...state.cargo, [resourceId]: owned - quantity };
  if (nextCargo[resourceId] === 0) {
    delete nextCargo[resourceId];
  }

  return succeed(
    {
      ...state,
      credits: state.credits + total,
      tradedAtCurrentLocation: true,
      cargo: nextCargo
    },
    `Sold ${quantity} ${resource.name} for ${formatNumber(total)} credits.`
  );
}

export function buyEmergencyFuelForTravel(state, destinationPlanetId) {
  const destination = getPlanet(destinationPlanetId);
  const quote = getEmergencyFuelQuote(state, destination.id);

  if (quote.neededFuel <= 0) {
    return fail(state, `Fuel tanks already cover the route to ${destination.name}.`);
  }

  if (state.credits < quote.total) {
    return fail(
      state,
      `Emergency fuel to ${destination.name} requires ${formatNumber(quote.total)} credits (${quote.neededFuel} fuel at ${formatNumber(quote.unitPrice)} each).`
    );
  }

  return succeed(
    {
      ...state,
      credits: state.credits - quote.total,
      fuel: state.fuel + quote.neededFuel,
      tradedAtCurrentLocation: true
    },
    `Emergency fueling bought ${quote.neededFuel} fuel for ${formatNumber(quote.total)} credits.`
  );
}

export function travelToPlanet(state, destinationPlanetId, options = {}) {
  const { confirmed = false } = options;
  const destination = getPlanet(destinationPlanetId);
  if (destination.id === state.currentPlanetId) {
    return fail(state, `Already docked at ${destination.name}.`);
  }

  const cost = getTravelCost(state.currentPlanetId, destination.id);
  if (state.fuel < cost) {
    return fail(state, `Need ${cost} fuel to reach ${destination.name}.`);
  }

  if (!state.tradedAtCurrentLocation && !confirmed) {
    const origin = getPlanet(state.currentPlanetId);
    const message = `Leave ${origin.name} without trading? Confirm travel to ${destination.name}.`;
    return {
      ok: false,
      requiresConfirmation: true,
      destinationPlanetId: destination.id,
      message,
      state: appendMessage(state, message)
    };
  }

  return succeed(
    {
      ...state,
      currentPlanetId: destination.id,
      fuel: state.fuel - cost,
      currentDate: advanceDate(state.currentDate, getTravelDurationDays(cost)),
      tradedAtCurrentLocation: false
    },
    `Traveled to ${destination.name}. Fuel spent: ${cost}. Time elapsed: ${formatDuration(getTravelDurationDays(cost))}.`
  );
}

export function cancelTravelConfirmation(state, destinationPlanetId) {
  const destination = getPlanet(destinationPlanetId);
  return {
    ok: false,
    canceled: true,
    message: `Stayed docked. Travel to ${destination.name} canceled.`,
    state: appendMessage(state, `Stayed docked. Travel to ${destination.name} canceled.`)
  };
}

// Industrial worlds (per lore): Luna, Ganymede, Titan, Mars.
const INDUSTRIAL_PLANET_IDS = new Set(['luna', 'ganymede', 'titan', 'mars']);

export function validateMarketData() {
  const errors = [];
  const allowedLocationNames = new Set([
    "Callisto",
    "Ceres",
    "Earth",
    "Enceladus",
    "Europa",
    "Ganymede",
    "Io",
    "Luna",
    "Mars",
    "Mercury",
    "Titan",
    "Triton",
    "Venus"
  ]);
  const allowedAlignments = new Set([
    "Earth-aligned",
    "Mars-aligned",
    "Titan-influenced",
    "neutral",
    "contested",
    "independent"
  ]);
  const allowedRiskLevels = new Set(["low", "moderate", "high"]);

  for (const planet of planets) {
    if (!allowedLocationNames.has(planet.name)) {
      errors.push(`${planet.name} is not an approved Solar System MVP location.`);
    }

    if (!planet.type) {
      errors.push(`${planet.name} must define a Solar System location type.`);
    }

    if (!allowedAlignments.has(planet.factionAlignment)) {
      errors.push(`${planet.name} must define an approved faction alignment.`);
    }

    if (!allowedRiskLevels.has(planet.riskLevel)) {
      errors.push(`${planet.name} must define an approved risk level.`);
    }

    if (!planet.summary || !planet.strategicContext || !planet.note) {
      errors.push(`${planet.name} must define player-facing setting context.`);
    }

    if (planet.produces.length !== 3) {
      errors.push(`${planet.name} must produce exactly three resources.`);
    }

    // Validate industrial flag: must be a boolean and match lore-defined list.
    if (typeof planet.industrial !== 'boolean') {
      errors.push(`${planet.name} must define industrial as a boolean.`);
    } else {
      const expectedIndustrial = INDUSTRIAL_PLANET_IDS.has(planet.id);
      if (planet.industrial !== expectedIndustrial) {
        errors.push(`${planet.name} industrial flag should be ${expectedIndustrial} per lore (got ${planet.industrial}).`);
      }
    }

    for (const resource of resources) {
      const range = planet.priceRanges[resource.id];
      if (!range) {
        errors.push(`${planet.name} missing price range for ${resource.name}.`);
      } else if (!Number.isInteger(range.min) || !Number.isInteger(range.max) || range.min <= 0 || range.max < range.min) {
        errors.push(`${planet.name} has invalid price range for ${resource.name}.`);
      }
    }
  }

  return errors;
}

function validateTrade(resourceId, quantity) {
  getResource(resourceId);
  if (!Number.isInteger(quantity) || quantity <= 0) {
    return "Quantity must be a positive whole number.";
  }
  return "";
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
    messages: [message, ...state.messages].slice(0, 8)
  };
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDuration(days) {
  if (days % 7 === 0) {
    const weeks = days / 7;
    return `${weeks} ${weeks === 1 ? "week" : "weeks"}`;
  }
  return `${days} ${days === 1 ? "day" : "days"}`;
}

function parseGameDate(dateText) {
  const [year, month, day] = dateText.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatGameDateIso(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

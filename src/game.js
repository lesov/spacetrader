import { FUEL_RESOURCE_ID, planets, resources, startingPlayer } from "./data.js";

export const PLANET_BY_ID = Object.fromEntries(planets.map((planet) => [planet.id, planet]));
export const RESOURCE_BY_ID = Object.fromEntries(resources.map((resource) => [resource.id, resource]));
export const RESOURCE_IDS = resources.map((resource) => resource.id);
export const PLANET_IDS = planets.map((planet) => planet.id);

export function createInitialState() {
  const startingPlanet = getPlanet(startingPlayer.currentPlanetId);
  return {
    credits: startingPlayer.credits,
    currentPlanetId: startingPlayer.currentPlanetId,
    fuel: startingPlayer.fuel,
    cargoCapacity: startingPlayer.cargoCapacity,
    cargo: {},
    tradedAtCurrentLocation: false,
    messages: [`Docked at ${startingPlanet.name}. Arbitrage run initialized.`]
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

export function getMarketPrice(planetId, resourceId) {
  const planet = getPlanet(planetId);
  getResource(resourceId);
  const range = planet.priceRanges[resourceId];
  if (!range) {
    throw new Error(`Missing price range for ${resourceId} on ${planetId}`);
  }
  return Math.round((range.min + range.max) / 2);
}

export function getCargoUsed(state) {
  return Object.values(state.cargo).reduce((total, quantity) => total + quantity, 0);
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

export function getDestinations(currentPlanetId) {
  getPlanet(currentPlanetId);
  return planets
    .filter((planet) => planet.id !== currentPlanetId)
    .map((planet) => ({
      ...planet,
      fuelCost: getTravelCost(currentPlanetId, planet.id)
    }));
}

export function buyResource(state, resourceId, quantity) {
  const validationError = validateTrade(resourceId, quantity);
  if (validationError) {
    return fail(state, validationError);
  }

  const resource = getResource(resourceId);
  const price = getMarketPrice(state.currentPlanetId, resourceId);
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

  if (isFuel(resourceId)) {
    return fail(state, "Fuel is stored in tanks and cannot be sold in this MVP.");
  }

  const resource = getResource(resourceId);
  const owned = getOwnedQuantity(state, resourceId);
  if (owned < quantity) {
    return fail(state, `Only ${owned} ${resource.name} available to sell.`);
  }

  const price = getMarketPrice(state.currentPlanetId, resourceId);
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
      tradedAtCurrentLocation: false
    },
    `Traveled to ${destination.name}. Fuel spent: ${cost}.`
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

export function validateMarketData() {
  const errors = [];
  const allowedLocationNames = new Set(["Mars", "Europa", "Titan", "Mercury", "Ganymede", "Luna"]);

  for (const planet of planets) {
    if (!allowedLocationNames.has(planet.name)) {
      errors.push(`${planet.name} is not an approved Solar System MVP location.`);
    }

    if (!planet.type) {
      errors.push(`${planet.name} must define a Solar System location type.`);
    }

    if (planet.produces.length !== 3) {
      errors.push(`${planet.name} must produce exactly three resources.`);
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

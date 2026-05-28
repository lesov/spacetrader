import {
  FUEL_RESOURCE_ID,
  planets,
  resources
} from "./data.js";
import {
  getCargoRemaining,
  getCargoUsed,
  getDestinations,
  getMarketPrice,
  getOwnedQuantity,
  getPlanet,
  getTravelCost
} from "./game.js";

export function formatCredits(value) {
  return `${new Intl.NumberFormat("en-US").format(value)} cr`;
}

export function formatFuel(value) {
  return `${value} units`;
}

export function formatCargo(used, capacity) {
  return `${used}/${capacity}`;
}

export function getStatusView(state) {
  const planet = getPlanet(state.currentPlanetId);
  const cargoUsed = getCargoUsed(state);
  return {
    credits: formatCredits(state.credits),
    fuel: formatFuel(state.fuel),
    cargo: formatCargo(cargoUsed, state.cargoCapacity),
    currentPlanet: planet.name,
    routeLine: `${planet.name} orbit | ${getCargoRemaining(state)} cargo slots open`
  };
}

export function getMarketRows(state) {
  const planet = getPlanet(state.currentPlanetId);
  return resources.map((resource) => {
    const price = getMarketPrice(planet.id, resource.id);
    const owned = resource.id === FUEL_RESOURCE_ID ? state.fuel : getOwnedQuantity(state, resource.id);
    const canBuyOne = state.credits >= price && (resource.id === FUEL_RESOURCE_ID || getCargoRemaining(state) >= 1);
    const canSellOne = resource.id !== FUEL_RESOURCE_ID && owned >= 1;

    return {
      id: resource.id,
      name: resource.name,
      price,
      priceLabel: formatCredits(price),
      owned,
      producedHere: planet.produces.includes(resource.id),
      canBuyOne,
      canSellOne
    };
  });
}

export function getDestinationRows(state) {
  return getDestinations(state.currentPlanetId).map((planet) => ({
    id: planet.id,
    name: planet.name,
    fuelCost: getTravelCost(state.currentPlanetId, planet.id),
    canTravel: state.fuel >= getTravelCost(state.currentPlanetId, planet.id)
  }));
}

export function getCargoRows(state) {
  return resources
    .filter((resource) => resource.id !== FUEL_RESOURCE_ID)
    .map((resource) => ({
      id: resource.id,
      name: resource.name,
      quantity: getOwnedQuantity(state, resource.id)
    }));
}

export function getPlanetMapView(state) {
  return planets.map((planet) => ({
    id: planet.id,
    name: planet.name,
    x: planet.position.x,
    y: planet.position.y,
    active: planet.id === state.currentPlanetId,
    produces: planet.produces
  }));
}

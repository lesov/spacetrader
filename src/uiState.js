import {
  FUEL_RESOURCE_ID,
  campaign,
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
    campaignLabel: campaign.startLabel,
    marketClimate: campaign.marketClimate,
    credits: formatCredits(state.credits),
    fuel: formatFuel(state.fuel),
    cargo: formatCargo(cargoUsed, state.cargoCapacity),
    currentPlanet: planet.name,
    routeLine: `${planet.name} ${planet.type.toLowerCase()} trade hub | ${getCargoRemaining(state)} cargo slots open`,
    tradeStatus: state.tradedAtCurrentLocation ? "Trade logged here" : "No local trade yet"
  };
}

export function getMarketRows(state) {
  const planet = getPlanet(state.currentPlanetId);
  return resources.map((resource) => {
    const price = getMarketPrice(planet.id, resource.id);
    const owned = resource.id === FUEL_RESOURCE_ID ? state.fuel : getOwnedQuantity(state, resource.id);
    const affordableQuantity = Math.floor(state.credits / price);
    const buyMax = resource.id === FUEL_RESOURCE_ID
      ? affordableQuantity
      : Math.min(affordableQuantity, getCargoRemaining(state));
    const sellMax = resource.id === FUEL_RESOURCE_ID ? 0 : owned;

    return {
      id: resource.id,
      name: resource.name,
      price,
      priceLabel: formatCredits(price),
      owned,
      producedHere: planet.produces.includes(resource.id),
      buyMax,
      sellMax,
      buySlider: getSliderView(buyMax),
      sellSlider: getSliderView(sellMax),
      canBuyOne: buyMax >= 1,
      canSellOne: sellMax >= 1
    };
  });
}

export function getDestinationRows(state) {
  return getDestinations(state.currentPlanetId).map((planet) => ({
    id: planet.id,
    name: planet.name,
    type: planet.type,
    factionAlignment: planet.factionAlignment,
    riskLevel: planet.riskLevel,
    fuelCost: getTravelCost(state.currentPlanetId, planet.id),
    canTravel: state.fuel >= getTravelCost(state.currentPlanetId, planet.id),
    requiresConfirmation: !state.tradedAtCurrentLocation
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
    type: planet.type,
    x: planet.position.x,
    y: planet.position.y,
    active: planet.id === state.currentPlanetId,
    riskLevel: planet.riskLevel,
    produces: planet.produces
  }));
}

function getSliderView(max) {
  return {
    min: max > 0 ? 1 : 0,
    max,
    value: max > 0 ? 1 : 0,
    disabled: max <= 0,
    label: max > 0 ? "1" : "0"
  };
}

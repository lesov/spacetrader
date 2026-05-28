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
import { getEncounterChance } from "./travelCombat.js";

export const MAP_MARKER_COLORS = {
  current: "#f4f0e8",
  low: "#6ad3d1",
  moderate: "#f7b955",
  high: "#f06d6d"
};

export function formatCredits(value) {
  return `${new Intl.NumberFormat("en-US").format(value)} cr`;
}

export function formatFuel(value) {
  return `${value} units`;
}

export function formatCargo(used, capacity) {
  return `${used}/${capacity}`;
}

export function formatDate(dateText) {
  const [year, month, day] = dateText.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC"
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatDuration(days) {
  if (days % 7 === 0) {
    const weeks = days / 7;
    return `${weeks} ${weeks === 1 ? "week" : "weeks"}`;
  }
  return `${days} ${days === 1 ? "day" : "days"}`;
}

export function getStatusView(state) {
  const planet = getPlanet(state.currentPlanetId);
  const cargoUsed = getCargoUsed(state);
  return {
    campaignLabel: campaign.startLabel,
    marketClimate: campaign.marketClimate,
    currentDate: formatDate(state.currentDate),
    credits: formatCredits(state.credits),
    fuel: formatFuel(state.fuel),
    cargo: formatCargo(cargoUsed, state.cargoCapacity),
    currentPlanet: planet.name,
    routeLine: `${planet.name} ${planet.type.toLowerCase()} trade hub | ${getCargoRemaining(state)} cargo slots open`,
    tradeStatus: state.mode === "combat" ? "In combat" : state.tradedAtCurrentLocation ? "Trade logged here" : "No local trade yet"
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
    encounterChance: getEncounterChance(state, planet.id),
    encounterRiskLabel: `${Math.round(getEncounterChance(state, planet.id) * 100)}% battle risk`,
    travelDurationDays: planet.travelDurationDays,
    travelDurationLabel: formatDuration(planet.travelDurationDays),
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

export function getProjectedMapView(mapPlanets, width, height) {
  const padding = getMapPadding(width, height);
  const bounds = getMapBounds(mapPlanets);
  const drawableWidth = Math.max(1, width - padding.left - padding.right);
  const drawableHeight = Math.max(1, height - padding.top - padding.bottom);
  const sourceWidth = Math.max(1, bounds.maxX - bounds.minX);
  const sourceHeight = Math.max(1, bounds.maxY - bounds.minY);
  const scale = Math.min(drawableWidth / sourceWidth, drawableHeight / sourceHeight);
  const renderedWidth = sourceWidth * scale;
  const renderedHeight = sourceHeight * scale;
  const offsetX = padding.left + (drawableWidth - renderedWidth) / 2;
  const offsetY = padding.top + (drawableHeight - renderedHeight) / 2;

  return mapPlanets.map((planet) => ({
    ...planet,
    x: offsetX + (planet.x - bounds.minX) * scale,
    y: offsetY + (planet.y - bounds.minY) * scale
  }));
}

export function getMapLegendRows() {
  return [
    { id: "current", label: "Current location", color: MAP_MARKER_COLORS.current },
    { id: "low", label: "Low risk", color: MAP_MARKER_COLORS.low },
    { id: "moderate", label: "Moderate risk", color: MAP_MARKER_COLORS.moderate },
    { id: "high", label: "High risk", color: MAP_MARKER_COLORS.high }
  ];
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

function getMapBounds(mapPlanets) {
  return mapPlanets.reduce(
    (bounds, planet) => ({
      minX: Math.min(bounds.minX, planet.x),
      maxX: Math.max(bounds.maxX, planet.x),
      minY: Math.min(bounds.minY, planet.y),
      maxY: Math.max(bounds.maxY, planet.y)
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY
    }
  );
}

function getMapPadding(width, height) {
  return {
    left: Math.min(54, Math.max(28, width * 0.08)),
    right: Math.min(118, Math.max(72, width * 0.15)),
    top: Math.min(48, Math.max(28, height * 0.1)),
    bottom: Math.min(54, Math.max(34, height * 0.12))
  };
}

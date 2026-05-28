import assert from "node:assert/strict";
import test from "node:test";

import { FUEL_RESOURCE_ID, planets, resources } from "../src/data.js";
import {
  buyResource,
  cancelTravelConfirmation,
  createInitialState,
  getCargoRemaining,
  getCargoUsed,
  getMarketPrice,
  getTravelCost,
  sellResource,
  travelToPlanet,
  validateMarketData
} from "../src/game.js";
import {
  formatCargo,
  formatCredits,
  formatFuel,
  getDestinationRows,
  getMarketRows,
  getStatusView
} from "../src/uiState.js";

test("buying goods reduces credits and increases cargo", () => {
  const state = createInitialState();
  const price = getMarketPrice(state.currentPlanetId, "ore");

  const result = buyResource(state, "ore", 3);

  assert.equal(result.ok, true);
  assert.equal(result.state.credits, state.credits - price * 3);
  assert.equal(result.state.cargo.ore, 3);
  assert.equal(result.state.tradedAtCurrentLocation, true);
  assert.equal(getCargoUsed(result.state), 3);
});

test("buying fails when credits are insufficient", () => {
  const state = { ...createInitialState(), credits: 1 };

  const result = buyResource(state, "medicine", 1);

  assert.equal(result.ok, false);
  assert.equal(result.state.credits, 1);
  assert.equal(result.state.cargo.medicine, undefined);
});

test("buying fails when cargo capacity would be exceeded", () => {
  const state = {
    ...createInitialState(),
    cargo: { ore: 20 }
  };

  const result = buyResource(state, "water", 1);

  assert.equal(result.ok, false);
  assert.equal(result.state.cargo.water, undefined);
  assert.equal(getCargoRemaining(result.state), 0);
});

test("selling goods increases credits and decreases cargo", () => {
  const state = {
    ...createInitialState(),
    credits: 500,
    cargo: { ore: 4 }
  };
  const price = getMarketPrice(state.currentPlanetId, "ore");

  const result = sellResource(state, "ore", 2);

  assert.equal(result.ok, true);
  assert.equal(result.state.credits, 500 + price * 2);
  assert.equal(result.state.cargo.ore, 2);
});

test("selling fails when inventory is insufficient", () => {
  const state = {
    ...createInitialState(),
    cargo: { ore: 1 }
  };

  const result = sellResource(state, "ore", 2);

  assert.equal(result.ok, false);
  assert.equal(result.state.cargo.ore, 1);
});

test("fuel purchases increase fuel and reduce credits outside cargo", () => {
  const state = createInitialState();
  const price = getMarketPrice(state.currentPlanetId, FUEL_RESOURCE_ID);

  const result = buyResource(state, FUEL_RESOURCE_ID, 5);

  assert.equal(result.ok, true);
  assert.equal(result.state.fuel, state.fuel + 5);
  assert.equal(result.state.credits, state.credits - price * 5);
  assert.equal(result.state.tradedAtCurrentLocation, true);
  assert.equal(getCargoUsed(result.state), 0);
});

test("fuel purchases fail when credits are insufficient", () => {
  const state = { ...createInitialState(), credits: 1 };

  const result = buyResource(state, FUEL_RESOURCE_ID, 10);

  assert.equal(result.ok, false);
  assert.equal(result.state.fuel, state.fuel);
});

test("travel consumes fuel and changes current location after local trade", () => {
  const state = buyResource(createInitialState(), "ore", 1).state;
  const cost = getTravelCost("mars", "europa");

  const result = travelToPlanet(state, "europa");

  assert.equal(result.ok, true);
  assert.equal(result.state.currentPlanetId, "europa");
  assert.equal(result.state.fuel, state.fuel - cost);
  assert.equal(result.state.tradedAtCurrentLocation, false);
});

test("travel fails when fuel is insufficient", () => {
  const state = { ...createInitialState(), fuel: 0 };

  const result = travelToPlanet(state, "titan");

  assert.equal(result.ok, false);
  assert.equal(result.state.currentPlanetId, "mars");
  assert.equal(result.state.fuel, 0);
});

test("travel from an untraded location requires confirmation before fuel is spent", () => {
  const state = createInitialState();

  const result = travelToPlanet(state, "europa");

  assert.equal(result.ok, false);
  assert.equal(result.requiresConfirmation, true);
  assert.equal(result.destinationPlanetId, "europa");
  assert.equal(result.state.currentPlanetId, "mars");
  assert.equal(result.state.fuel, state.fuel);
  assert.match(result.message, /Leave Mars without trading/);
});

test("confirmed travel from an untraded location consumes fuel and changes location", () => {
  const state = createInitialState();
  const cost = getTravelCost("mars", "europa");

  const result = travelToPlanet(state, "europa", { confirmed: true });

  assert.equal(result.ok, true);
  assert.equal(result.state.currentPlanetId, "europa");
  assert.equal(result.state.fuel, state.fuel - cost);
  assert.equal(result.state.tradedAtCurrentLocation, false);
});

test("canceled travel from an untraded location keeps fuel and location unchanged", () => {
  const state = travelToPlanet(createInitialState(), "europa").state;

  const result = cancelTravelConfirmation(state, "europa");

  assert.equal(result.ok, false);
  assert.equal(result.canceled, true);
  assert.equal(result.state.currentPlanetId, "mars");
  assert.equal(result.state.fuel, 30);
  assert.match(result.message, /canceled/);
});

test("market data includes every resource at every trade location", () => {
  assert.deepEqual(validateMarketData(), []);

  for (const planet of planets) {
    for (const resource of resources) {
      assert.ok(planet.priceRanges[resource.id], `${planet.name} has ${resource.name}`);
    }
  }
});

test("each trade location produces exactly three resources", () => {
  for (const planet of planets) {
    assert.equal(planet.produces.length, 3, planet.name);
  }
});

test("produced resources are cheaper than at least one non-producing location", () => {
  for (const resource of resources) {
    const producerPrices = planets
      .filter((planet) => planet.produces.includes(resource.id))
      .map((planet) => getMarketPrice(planet.id, resource.id));
    const nonProducerPrices = planets
      .filter((planet) => !planet.produces.includes(resource.id))
      .map((planet) => getMarketPrice(planet.id, resource.id));

    assert.ok(
      producerPrices.some((producerPrice) => nonProducerPrices.some((nonProducerPrice) => producerPrice < nonProducerPrice)),
      `${resource.name} has an arbitrage spread`
    );
  }
});

test("initial data uses real Solar System planets or satellites", () => {
  const locationNames = planets.map((planet) => planet.name).sort();

  assert.deepEqual(locationNames, ["Europa", "Ganymede", "Luna", "Mars", "Mercury", "Titan"]);
  assert.equal(planets.every((planet) => planet.type), true);
});

test("ui state derives cargo capacity and formatted quantities", () => {
  const state = {
    ...createInitialState(),
    cargo: { ore: 4, water: 3 }
  };

  assert.equal(formatCredits(1200), "1,200 cr");
  assert.equal(formatFuel(12), "12 units");
  assert.equal(formatCargo(getCargoUsed(state), state.cargoCapacity), "7/20");
  assert.equal(getStatusView(state).routeLine, "Mars planet port | 13 cargo slots open");
  assert.equal(getStatusView(state).tradeStatus, "No local trade yet");
});

test("ui state exposes slider limits and disabled buy, sell, and travel controls", () => {
  const state = {
    ...createInitialState(),
    credits: 1,
    fuel: 0,
    cargo: {}
  };

  const marketRows = getMarketRows(state);
  assert.equal(marketRows.find((row) => row.id === "ore").canBuyOne, false);
  assert.equal(marketRows.find((row) => row.id === "ore").canSellOne, false);
  assert.equal(marketRows.find((row) => row.id === "ore").buySlider.disabled, true);
  assert.equal(marketRows.find((row) => row.id === "ore").sellSlider.disabled, true);
  assert.equal(getDestinationRows(state).every((row) => row.canTravel === false), true);
});

test("ui state exposes useful slider maximums for multi-unit buy and sell actions", () => {
  const state = {
    ...createInitialState(),
    credits: 1000,
    cargo: { ore: 4 }
  };

  const oreRow = getMarketRows(state).find((row) => row.id === "ore");

  assert.equal(oreRow.buyMax, 16);
  assert.equal(oreRow.buySlider.min, 1);
  assert.equal(oreRow.buySlider.value, 1);
  assert.equal(oreRow.buySlider.disabled, false);
  assert.equal(oreRow.sellMax, 4);
  assert.equal(oreRow.sellSlider.max, 4);
  assert.equal(oreRow.sellSlider.disabled, false);
});

test("destination rows expose confirmation state for untraded locations", () => {
  const state = createInitialState();
  const destinations = getDestinationRows(state);

  assert.equal(destinations.every((row) => row.requiresConfirmation === true), true);

  const tradedState = buyResource(state, "ore", 1).state;
  assert.equal(getDestinationRows(tradedState).every((row) => row.requiresConfirmation === false), true);
});

test("messages are generated for successful and failed actions", () => {
  const success = buyResource(createInitialState(), "ore", 1);
  const failure = sellResource(createInitialState(), "ore", 1);

  assert.equal(success.ok, true);
  assert.match(success.message, /Bought 1 Ore/);
  assert.equal(success.state.messages[0], success.message);
  assert.equal(failure.ok, false);
  assert.match(failure.message, /Only 0 Ore/);
  assert.equal(failure.state.messages[0], failure.message);
});

import assert from "node:assert/strict";
import test from "node:test";

import { FUEL_RESOURCE_ID, planets, resources } from "../src/data.js";
import {
  buyResource,
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
  assert.equal(getCargoUsed(result.state), 0);
});

test("fuel purchases fail when credits are insufficient", () => {
  const state = { ...createInitialState(), credits: 1 };

  const result = buyResource(state, FUEL_RESOURCE_ID, 10);

  assert.equal(result.ok, false);
  assert.equal(result.state.fuel, state.fuel);
});

test("travel consumes fuel and changes current planet", () => {
  const state = createInitialState();
  const cost = getTravelCost("aster", "brine");

  const result = travelToPlanet(state, "brine");

  assert.equal(result.ok, true);
  assert.equal(result.state.currentPlanetId, "brine");
  assert.equal(result.state.fuel, state.fuel - cost);
});

test("travel fails when fuel is insufficient", () => {
  const state = { ...createInitialState(), fuel: 0 };

  const result = travelToPlanet(state, "helio");

  assert.equal(result.ok, false);
  assert.equal(result.state.currentPlanetId, "aster");
  assert.equal(result.state.fuel, 0);
});

test("market data includes every resource on every planet", () => {
  assert.deepEqual(validateMarketData(), []);

  for (const planet of planets) {
    for (const resource of resources) {
      assert.ok(planet.priceRanges[resource.id], `${planet.name} has ${resource.name}`);
    }
  }
});

test("each planet produces exactly three resources", () => {
  for (const planet of planets) {
    assert.equal(planet.produces.length, 3, planet.name);
  }
});

test("produced resources are cheaper than at least one non-producing planet", () => {
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

test("ui state derives cargo capacity and formatted quantities", () => {
  const state = {
    ...createInitialState(),
    cargo: { ore: 4, water: 3 }
  };

  assert.equal(formatCredits(1200), "1,200 cr");
  assert.equal(formatFuel(12), "12 units");
  assert.equal(formatCargo(getCargoUsed(state), state.cargoCapacity), "7/20");
  assert.equal(getStatusView(state).routeLine, "Aster orbit | 13 cargo slots open");
});

test("ui state exposes disabled buy, sell, and travel controls", () => {
  const state = {
    ...createInitialState(),
    credits: 1,
    fuel: 0,
    cargo: {}
  };

  const marketRows = getMarketRows(state);
  assert.equal(marketRows.find((row) => row.id === "ore").canBuyOne, false);
  assert.equal(marketRows.find((row) => row.id === "ore").canSellOne, false);
  assert.equal(getDestinationRows(state).every((row) => row.canTravel === false), true);
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

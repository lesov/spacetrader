import assert from "node:assert/strict";
import test from "node:test";

import { FUEL_RESOURCE_ID, campaign, planets, resources } from "../src/data.js";
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
  getPlanetMapView,
  getProjectedMapView,
  getStatusView
} from "../src/uiState.js";

test("buying goods reduces credits and increases cargo", () => {
  const state = createInitialState();
  const price = getMarketPrice(state.currentPlanetId, "metals");

  const result = buyResource(state, "metals", 3);

  assert.equal(result.ok, true);
  assert.equal(result.state.credits, state.credits - price * 3);
  assert.equal(result.state.cargo.metals, 3);
  assert.equal(result.state.tradedAtCurrentLocation, true);
  assert.equal(getCargoUsed(result.state), 3);
});

test("buying fails when credits are insufficient", () => {
  const state = { ...createInitialState(), credits: 1 };

  const result = buyResource(state, "biomaterials", 1);

  assert.equal(result.ok, false);
  assert.equal(result.state.credits, 1);
  assert.equal(result.state.cargo.biomaterials, undefined);
});

test("buying fails when cargo capacity would be exceeded", () => {
  const state = {
    ...createInitialState(),
    cargo: { metals: 20 }
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
    cargo: { metals: 4 }
  };
  const price = getMarketPrice(state.currentPlanetId, "metals");

  const result = sellResource(state, "metals", 2);

  assert.equal(result.ok, true);
  assert.equal(result.state.credits, 500 + price * 2);
  assert.equal(result.state.cargo.metals, 2);
});

test("selling fails when inventory is insufficient", () => {
  const state = {
    ...createInitialState(),
    cargo: { metals: 1 }
  };

  const result = sellResource(state, "metals", 2);

  assert.equal(result.ok, false);
  assert.equal(result.state.cargo.metals, 1);
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
  const state = buyResource(createInitialState(), "metals", 1).state;
  const cost = getTravelCost("luna", "europa");

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
  assert.equal(result.state.currentPlanetId, "luna");
  assert.equal(result.state.fuel, 0);
});

test("travel from an untraded location requires confirmation before fuel is spent", () => {
  const state = createInitialState();

  const result = travelToPlanet(state, "europa");

  assert.equal(result.ok, false);
  assert.equal(result.requiresConfirmation, true);
  assert.equal(result.destinationPlanetId, "europa");
  assert.equal(result.state.currentPlanetId, "luna");
  assert.equal(result.state.fuel, state.fuel);
  assert.match(result.message, /Leave Luna without trading/);
});

test("confirmed travel from an untraded location consumes fuel and changes location", () => {
  const state = createInitialState();
  const cost = getTravelCost("luna", "europa");

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
  assert.equal(result.state.currentPlanetId, "luna");
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

  assert.deepEqual(locationNames, [
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
  assert.equal(planets.every((planet) => planet.type), true);
});

test("2175 campaign metadata is exposed without future crisis spoilers", () => {
  assert.equal(campaign.startYear, 2175);
  assert.equal(campaign.startLabel, "Late 2175");
  assert.equal(campaign.marketClimate, "Post-Enceladus realignment");
  assert.equal(createInitialState().currentPlanetId, "luna");
  assert.equal(planets.some((planet) => /Deimos/i.test(`${planet.note} ${planet.summary} ${planet.strategicContext}`)), false);
});

test("location setting metadata is complete and era appropriate", () => {
  const titan = planets.find((planet) => planet.id === "titan");
  const mars = planets.find((planet) => planet.id === "mars");

  for (const planet of planets) {
    assert.ok(planet.factionAlignment, `${planet.name} alignment`);
    assert.match(planet.riskLevel, /^(low|moderate|high)$/, `${planet.name} risk`);
    assert.ok(planet.summary, `${planet.name} summary`);
    assert.ok(planet.strategicContext, `${planet.name} strategic context`);
  }

  assert.match(titan.summary, /not yet/i);
  assert.match(mars.note, /rival/i);
  assert.doesNotMatch(`${mars.note} ${mars.summary}`, /collapsed|declining/i);
});

test("player-facing setting data does not expose the hidden real-world mapping", () => {
  const forbidden = [
    /United States/i,
    /Soviet/i,
    /Russia/i,
    /China/i,
    /NATO/i,
    /Ukraine/i,
    /Vietnam/i,
    /Cold War/i,
    /1975/,
    /2025/,
    /Gerald Ford/i,
    /Brezhnev/i,
    /Deng/i
  ];
  const visibleText = [
    campaign.startLabel,
    campaign.marketClimate,
    ...resources.map((resource) => resource.name),
    ...planets.flatMap((planet) => [
      planet.name,
      planet.type,
      planet.factionAlignment,
      planet.riskLevel,
      planet.note,
      planet.summary,
      planet.strategicContext
    ])
  ].join("\n");

  for (const pattern of forbidden) {
    assert.doesNotMatch(visibleText, pattern);
  }
});

test("ui state derives cargo capacity and formatted quantities", () => {
  const state = {
    ...createInitialState(),
    cargo: { metals: 4, water: 3 }
  };

  assert.equal(formatCredits(1200), "1,200 cr");
  assert.equal(formatFuel(12), "12 units");
  assert.equal(formatCargo(getCargoUsed(state), state.cargoCapacity), "7/20");
  assert.equal(getStatusView(state).routeLine, "Luna earth moon trade hub | 13 cargo slots open");
  assert.equal(getStatusView(state).campaignLabel, "Late 2175");
  assert.equal(getStatusView(state).marketClimate, "Post-Enceladus realignment");
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
  assert.equal(marketRows.find((row) => row.id === "metals").canBuyOne, false);
  assert.equal(marketRows.find((row) => row.id === "metals").canSellOne, false);
  assert.equal(marketRows.find((row) => row.id === "metals").buySlider.disabled, true);
  assert.equal(marketRows.find((row) => row.id === "metals").sellSlider.disabled, true);
  assert.equal(getDestinationRows(state).every((row) => row.canTravel === false), true);
});

test("ui state exposes useful slider maximums for multi-unit buy and sell actions", () => {
  const state = {
    ...createInitialState(),
    credits: 1000,
    cargo: { metals: 4 }
  };

  const metalsRow = getMarketRows(state).find((row) => row.id === "metals");

  assert.equal(metalsRow.buyMax, 16);
  assert.equal(metalsRow.buySlider.min, 1);
  assert.equal(metalsRow.buySlider.value, 1);
  assert.equal(metalsRow.buySlider.disabled, false);
  assert.equal(metalsRow.sellMax, 4);
  assert.equal(metalsRow.sellSlider.max, 4);
  assert.equal(metalsRow.sellSlider.disabled, false);
});

test("destination rows expose confirmation state for untraded locations", () => {
  const state = createInitialState();
  const destinations = getDestinationRows(state);

  assert.equal(destinations.every((row) => row.requiresConfirmation === true), true);
  assert.equal(destinations.every((row) => row.factionAlignment && row.riskLevel), true);

  const tradedState = buyResource(state, "metals", 1).state;
  assert.equal(getDestinationRows(tradedState).every((row) => row.requiresConfirmation === false), true);
});

test("map projection keeps all trade locations visible in desktop and mobile viewports", () => {
  const mapPlanets = getPlanetMapView(createInitialState());
  const viewports = [
    { width: 900, height: 420 },
    { width: 320, height: 280 }
  ];

  for (const viewport of viewports) {
    const projected = getProjectedMapView(mapPlanets, viewport.width, viewport.height);
    for (const planet of projected) {
      assert.ok(planet.x >= 24, `${planet.name} left edge in ${viewport.width}px`);
      assert.ok(planet.x <= viewport.width - 64, `${planet.name} right label room in ${viewport.width}px`);
      assert.ok(planet.y >= 24, `${planet.name} top edge in ${viewport.height}px`);
      assert.ok(planet.y <= viewport.height - 28, `${planet.name} bottom edge in ${viewport.height}px`);
    }
  }
});

test("messages are generated for successful and failed actions", () => {
  const success = buyResource(createInitialState(), "metals", 1);
  const failure = sellResource(createInitialState(), "metals", 1);

  assert.equal(success.ok, true);
  assert.match(success.message, /Bought 1 Refined Metals/);
  assert.equal(success.state.messages[0], success.message);
  assert.equal(failure.ok, false);
  assert.match(failure.message, /Only 0 Refined Metals/);
  assert.equal(failure.state.messages[0], failure.message);
});

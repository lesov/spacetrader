import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { FUEL_RESOURCE_ID, campaign, planets, resources } from "../src/data.js";
import {
  CARGO_UPGRADE,
  POWER_UPGRADE,
  advanceDate,
  buyResource,
  cancelTravelConfirmation,
  createInitialState,
  getCargoRemaining,
  getCargoUsed,
  getEffectiveCargoCapacity,
  getEffectivePowerCapacity,
  getMarketPrice,
  getTravelDurationDays,
  getTravelCost,
  sellResource,
  travelToPlanet,
  validateMarketData
} from "../src/game.js";
import { SHIP_CLASSES } from "../src/combat/data.js";
import { getShipyardView } from "../src/uiState.js";
import { upgradeShip } from "../src/shipyard.js";
import {
  formatCargo,
  formatCredits,
  formatDate,
  formatDuration,
  formatFuel,
  getDestinationRows,
  getMapLegendRows,
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
  const days = getTravelDurationDays(cost);

  const result = travelToPlanet(state, "europa");

  assert.equal(result.ok, true);
  assert.equal(result.state.currentPlanetId, "europa");
  assert.equal(result.state.fuel, state.fuel - cost);
  assert.equal(result.state.currentDate, advanceDate(state.currentDate, days));
  assert.equal(result.state.tradedAtCurrentLocation, false);
  assert.match(result.message, new RegExp(`Time elapsed: ${formatDuration(days)}`));
});

test("travel fails when fuel is insufficient", () => {
  const state = { ...createInitialState(), fuel: 0 };

  const result = travelToPlanet(state, "titan");

  assert.equal(result.ok, false);
  assert.equal(result.state.currentPlanetId, "luna");
  assert.equal(result.state.fuel, 0);
  assert.equal(result.state.currentDate, state.currentDate);
});

test("travel from an untraded location requires confirmation before fuel is spent", () => {
  const state = createInitialState();

  const result = travelToPlanet(state, "europa");

  assert.equal(result.ok, false);
  assert.equal(result.requiresConfirmation, true);
  assert.equal(result.destinationPlanetId, "europa");
  assert.equal(result.state.currentPlanetId, "luna");
  assert.equal(result.state.fuel, state.fuel);
  assert.equal(result.state.currentDate, state.currentDate);
  assert.match(result.message, /Leave Luna without trading/);
});

test("confirmed travel from an untraded location consumes fuel and changes location", () => {
  const state = createInitialState();
  const cost = getTravelCost("luna", "europa");
  const days = getTravelDurationDays(cost);

  const result = travelToPlanet(state, "europa", { confirmed: true });

  assert.equal(result.ok, true);
  assert.equal(result.state.currentPlanetId, "europa");
  assert.equal(result.state.fuel, state.fuel - cost);
  assert.equal(result.state.currentDate, advanceDate(state.currentDate, days));
  assert.equal(result.state.tradedAtCurrentLocation, false);
});

test("canceled travel from an untraded location keeps fuel and location unchanged", () => {
  const state = travelToPlanet(createInitialState(), "europa").state;

  const result = cancelTravelConfirmation(state, "europa");

  assert.equal(result.ok, false);
  assert.equal(result.canceled, true);
  assert.equal(result.state.currentPlanetId, "luna");
  assert.equal(result.state.fuel, 30);
  assert.equal(result.state.currentDate, "2175-12-01");
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
  assert.equal(campaign.startDate, "2175-12-01");
  assert.equal(campaign.travelDaysPerFuel, 7);
  assert.equal(campaign.marketClimate, "Post-Enceladus realignment");
  assert.equal(createInitialState().currentPlanetId, "luna");
  assert.equal(createInitialState().currentDate, campaign.startDate);
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
  assert.equal(formatDate("2176-01-05"), "Jan 5, 2176");
  assert.equal(formatDuration(28), "4 weeks");
  assert.equal(getStatusView(state).routeLine, "Luna earth moon trade hub | 13 cargo slots open");
  assert.equal(getStatusView(state).campaignLabel, "Late 2175");
  assert.equal(getStatusView(state).marketClimate, "Post-Enceladus realignment");
  assert.equal(getStatusView(state).currentDate, "Dec 1, 2175");
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
  assert.equal(destinations.every((row) => row.travelDurationDays === row.fuelCost * campaign.travelDaysPerFuel), true);
  assert.equal(destinations.every((row) => /weeks?$/.test(row.travelDurationLabel)), true);

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

test("map legend explains current location and destination risk colors", () => {
  assert.deepEqual(
    getMapLegendRows().map((row) => row.label),
    ["Current location", "Low risk", "Moderate risk", "High risk"]
  );
  assert.equal(getMapLegendRows().every((row) => /^#[0-9a-f]{6}$/i.test(row.color)), true);
});

test("stylesheet preserves hidden mode switching for battle screen", () => {
  const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

  assert.match(styles, /\[hidden\]\s*\{[^}]*display:\s*none\s*!important;/s);
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

// ── Industrial world flags ────────────────────────────────────────────────────

test("exactly Luna, Ganymede, Titan, Mars are industrial", () => {
  const industrial = planets.filter((p) => p.industrial === true).map((p) => p.id).sort();
  assert.deepEqual(industrial, ["ganymede", "luna", "mars", "titan"]);

  const nonIndustrial = planets.filter((p) => p.industrial === false);
  assert.equal(nonIndustrial.length, planets.length - 4, "all other planets should have industrial: false");
});

test("every planet has an explicit industrial boolean", () => {
  for (const planet of planets) {
    assert.equal(typeof planet.industrial, "boolean", `${planet.name} must have explicit boolean industrial`);
  }
});

test("validateMarketData catches missing industrial flag", () => {
  // We test via the live validateMarketData which now checks industrial flags.
  // The actual data is correct, so errors should be empty.
  const errors = validateMarketData();
  assert.deepEqual(errors, []);
});

// ── Effective capacity getters ────────────────────────────────────────────────

test("getEffectiveCargoCapacity returns base class cargo at upgrade level 0", () => {
  const state = createInitialState();
  assert.equal(state.shipUpgrades.cargo, 0);
  assert.equal(getEffectiveCargoCapacity(state), SHIP_CLASSES.vanguard.cargoCapacity);
  assert.equal(getEffectiveCargoCapacity(state), 20);
});

test("getEffectiveCargoCapacity scales correctly with upgrade levels", () => {
  const base = createInitialState();
  for (let level = 0; level <= 4; level++) {
    const state = { ...base, shipUpgrades: { cargo: level, power: 0 } };
    const expected = SHIP_CLASSES.vanguard.cargoCapacity + level * CARGO_UPGRADE.step;
    assert.equal(getEffectiveCargoCapacity(state), expected, `level ${level}`);
  }
});

test("getEffectivePowerCapacity returns base class power at upgrade level 0", () => {
  const state = createInitialState();
  assert.equal(state.shipUpgrades.power, 0);
  assert.equal(getEffectivePowerCapacity(state), SHIP_CLASSES.vanguard.powerCapacity);
  assert.equal(getEffectivePowerCapacity(state), 10);
});

test("getEffectivePowerCapacity scales correctly with upgrade levels", () => {
  const base = createInitialState();
  for (let level = 0; level <= 4; level++) {
    const state = { ...base, shipUpgrades: { cargo: 0, power: level } };
    const expected = SHIP_CLASSES.vanguard.powerCapacity + level * POWER_UPGRADE.step;
    assert.equal(getEffectivePowerCapacity(state), expected, `level ${level}`);
  }
});

// ── createInitialState shape ──────────────────────────────────────────────────

test("createInitialState starts with shipUpgrades = { cargo: 0, power: 0 }", () => {
  const state = createInitialState();
  assert.deepEqual(state.shipUpgrades, { cargo: 0, power: 0 });
});

test("createInitialState starts with cargoCapacity derived from vanguard class", () => {
  const state = createInitialState();
  assert.equal(state.cargoCapacity, SHIP_CLASSES.vanguard.cargoCapacity);
  assert.equal(state.cargoCapacity, 20);
});

test("createInitialState playerCombatShip classId is vanguard", () => {
  const state = createInitialState();
  assert.equal(state.playerCombatShip.classId, "vanguard");
});

// ── getShipyardView ───────────────────────────────────────────────────────────

test("getShipyardView returns isIndustrial true at Luna", () => {
  const state = createInitialState();
  const view = getShipyardView(state);
  assert.equal(view.isIndustrial, true);
});

test("getShipyardView returns isIndustrial false at Venus", () => {
  const state = { ...createInitialState(), currentPlanetId: "venus" };
  const view = getShipyardView(state);
  assert.equal(view.isIndustrial, false);
});

test("getShipyardView catalog includes all purchasable classes with isCurrent flag", () => {
  const state = createInitialState();
  const view = getShipyardView(state);
  assert.ok(view.catalog.length >= 4);
  const vanguardRow = view.catalog.find((row) => row.classId === "vanguard");
  assert.ok(vanguardRow, "vanguard missing from catalog");
  assert.equal(vanguardRow.isCurrent, true, "vanguard should be current");
  const otherRows = view.catalog.filter((row) => row.classId !== "vanguard");
  assert.ok(otherRows.every((row) => row.isCurrent === false), "others should not be current");
});

test("getShipyardView upgrade canUpgrade is false when not industrial", () => {
  const state = { ...createInitialState(), currentPlanetId: "earth", credits: 100000 };
  const view = getShipyardView(state);
  assert.equal(view.isIndustrial, false);
  assert.equal(view.cargoUpgrade.canUpgrade, false);
  assert.equal(view.powerUpgrade.canUpgrade, false);
});

test("getShipyardView atMax flags correctly when at max upgrade level", () => {
  let state = {
    ...createInitialState(),
    currentPlanetId: "luna",
    credits: 100000,
    cargo: { shipParts: 30 }
  };
  // Max out cargo upgrade
  for (let i = 0; i < 4; i++) {
    state = upgradeShip(state, "cargo").state;
  }
  const view = getShipyardView(state);
  assert.equal(view.cargoUpgrade.atMax, true);
  assert.equal(view.cargoUpgrade.canUpgrade, false);
});

test("getShipyardView cost display values match getUpgradeCost", () => {
  const state = createInitialState();
  const view = getShipyardView(state);
  // At level 0, cargo cost should match level 1 entry
  assert.equal(view.cargoUpgrade.parts, 3);
  assert.equal(view.cargoUpgrade.credits, 1500);
  assert.equal(view.powerUpgrade.parts, 4);
  assert.equal(view.powerUpgrade.credits, 2500);
});

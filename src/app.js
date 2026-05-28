import { resources } from "./data.js";
import {
  buyResource,
  cancelTravelConfirmation,
  createInitialState,
  getPlanet,
  sellResource
} from "./game.js";
import {
  beginTravel,
  prepareCombatActionPhase,
  resolveIntegratedBattleTurn,
  setPlayerAllocation,
  updatePlayerAllocation
} from "./travelCombat.js";
import {
  MAP_MARKER_COLORS,
  getCargoRows,
  getDestinationRows,
  getMapLegendRows,
  getMarketRows,
  getPlanetMapView,
  getProjectedMapView,
  getShipyardView,
  getStatusView
} from "./uiState.js";
import { upgradeShip, buyShip } from "./shipyard.js";
import { createRng } from "./combat/rng.js";
import { effectivePoints, runAwayChance } from "./combat/rules.js";
import {
  SYSTEMS,
  SYSTEM_LABELS,
  PRESETS,
  allocationRemaining,
  battleResultLabel,
  computePresetAllocation,
  formatBar,
  formatHull,
  formatShield,
  getWeaponRows,
  isAllocationValid,
  phaseLabel,
  systemTooltip
} from "./combat/uiState.js";

let state = createInitialState();
let rng = createRng(Date.now());
let pendingTravel = null;

const elements = {
  tradeTopbar: document.querySelector("#trade-topbar"),
  tradeFlightDeck: document.querySelector("#trade-flight-deck"),
  tradeLayout: document.querySelector("#trade-layout"),
  shipyardPanel: document.querySelector("#shipyard-panel"),
  shipyardStatus: document.querySelector("#shipyard-status"),
  shipyardBody: document.querySelector("#shipyard-body"),
  combatMode: document.querySelector("#combat-mode"),
  gameOverPanel: document.querySelector("#game-over-panel"),
  gameOverMessage: document.querySelector("#game-over-message"),
  gameOverReset: document.querySelector("#game-over-reset"),
  campaignLabel: document.querySelector("#campaign-label"),
  marketClimate: document.querySelector("#market-climate"),
  credits: document.querySelector("#credits"),
  fuel: document.querySelector("#fuel"),
  cargoSpace: document.querySelector("#cargo-space"),
  currentDate: document.querySelector("#current-date"),
  currentPlanet: document.querySelector("#current-planet"),
  tradeStatus: document.querySelector("#trade-status"),
  routeLine: document.querySelector("#route-line"),
  planetHeading: document.querySelector("#planet-heading"),
  planetNote: document.querySelector("#planet-note"),
  locationAlignment: document.querySelector("#location-alignment"),
  locationRisk: document.querySelector("#location-risk"),
  strategicContext: document.querySelector("#strategic-context"),
  productionList: document.querySelector("#production-list"),
  destinations: document.querySelector("#destinations"),
  mapLegend: document.querySelector("#map-legend"),
  marketBody: document.querySelector("#market-body"),
  marketContext: document.querySelector("#market-context"),
  cargoList: document.querySelector("#cargo-list"),
  cargoContext: document.querySelector("#cargo-context"),
  messageLog: document.querySelector("#message-log"),
  resetButton: document.querySelector("#reset-button"),
  travelDialog: document.querySelector("#travel-confirmation"),
  travelConfirmationMessage: document.querySelector("#travel-confirmation-message"),
  cancelTravelButton: document.querySelector("#cancel-travel"),
  confirmTravelButton: document.querySelector("#confirm-travel"),
  canvas: document.querySelector("#star-map"),
  playerName: document.querySelector("#player-name"),
  playerHull: document.querySelector("#player-hull"),
  playerHullBar: document.querySelector("#player-hull-bar"),
  playerShield: document.querySelector("#player-shield"),
  playerShieldBar: document.querySelector("#player-shield-bar"),
  playerPower: document.querySelector("#player-power"),
  enemyName: document.querySelector("#enemy-name"),
  enemyHull: document.querySelector("#enemy-hull"),
  enemyHullBar: document.querySelector("#enemy-hull-bar"),
  enemyShield: document.querySelector("#enemy-shield"),
  enemyShieldBar: document.querySelector("#enemy-shield-bar"),
  turnNumber: document.querySelector("#turn-number"),
  phaseLabel: document.querySelector("#phase-label"),
  allocationPanel: document.querySelector("#allocation-panel"),
  presetRow: document.querySelector("#preset-row"),
  allocationGrid: document.querySelector("#allocation-grid"),
  powerRemaining: document.querySelector("#power-remaining"),
  powerRemainingWrap: document.querySelector("#power-remaining-wrap"),
  endAllocation: document.querySelector("#end-allocation"),
  actionPanel: document.querySelector("#action-panel"),
  actionButtons: document.querySelector("#action-buttons"),
  battleEndPanel: document.querySelector("#battle-end-panel"),
  resultHeading: document.querySelector("#result-heading"),
  resultSubtext: document.querySelector("#result-subtext"),
  combatLog: document.querySelector("#combat-log")
};

const ctx = elements.canvas.getContext("2d");
const stars = Array.from({ length: 90 }, (_, index) => ({
  x: ((index * 67) % 720) / 720,
  y: ((index * 37) % 420) / 420,
  radius: 0.7 + (index % 3) * 0.35,
  drift: 0.08 + (index % 5) * 0.015
}));

elements.resetButton.addEventListener("click", resetRun);
elements.gameOverReset.addEventListener("click", resetRun);

function resetRun() {
  pendingTravel = null;
  closeTravelDialog();
  rng = createRng(Date.now());
  state = createInitialState();
  render();
}

elements.cancelTravelButton.addEventListener("click", () => {
  if (!pendingTravel) {
    closeTravelDialog();
    return;
  }

  applyResult(cancelTravelConfirmation(state, pendingTravel.destinationPlanetId));
  pendingTravel = null;
  closeTravelDialog();
});

elements.confirmTravelButton.addEventListener("click", () => {
  if (!pendingTravel) {
    closeTravelDialog();
    return;
  }

  const destinationPlanetId = pendingTravel.destinationPlanetId;
  pendingTravel = null;
  closeTravelDialog();
  applyResult(beginTravel(state, destinationPlanetId, { confirmed: true }, rng));
});

elements.endAllocation.addEventListener("click", () => {
  applyResult(prepareCombatActionPhase(state, rng));
});

function render() {
  renderMode();
  if (state.mode === "combat") {
    renderCombat();
    return;
  }
  if (state.mode === "gameOver") {
    renderGameOver();
    return;
  }
  renderTrade();
}

function renderMode() {
  const tradeVisible = state.mode === "trade";
  elements.tradeTopbar.hidden = !tradeVisible;
  elements.tradeFlightDeck.hidden = !tradeVisible;
  elements.tradeLayout.hidden = !tradeVisible;
  elements.shipyardPanel.hidden = !tradeVisible;
  elements.combatMode.hidden = state.mode !== "combat";
  elements.gameOverPanel.hidden = state.mode !== "gameOver";
}

function renderTrade() {
  renderStatus();
  renderPlanetPanel();
  renderMapLegend();
  renderMarket();
  renderCargo();
  renderShipyard();
  renderLog();
  drawMap();
}

function renderStatus() {
  const status = getStatusView(state);
  elements.campaignLabel.textContent = status.campaignLabel;
  elements.marketClimate.textContent = status.marketClimate;
  elements.credits.textContent = status.credits;
  elements.fuel.textContent = status.fuel;
  elements.cargoSpace.textContent = status.cargo;
  elements.currentDate.textContent = status.currentDate;
  elements.currentPlanet.textContent = status.currentPlanet;
  elements.tradeStatus.textContent = status.tradeStatus;
  elements.routeLine.textContent = status.routeLine;
}

function renderPlanetPanel() {
  const planet = getPlanet(state.currentPlanetId);
  elements.planetHeading.textContent = planet.name;
  elements.planetNote.textContent = `${planet.type} | ${planet.summary}`;
  elements.locationAlignment.textContent = planet.factionAlignment;
  elements.locationRisk.textContent = `${planet.riskLevel} risk`;
  elements.locationRisk.dataset.risk = planet.riskLevel;
  elements.strategicContext.textContent = planet.strategicContext;

  elements.productionList.replaceChildren(
    ...planet.produces.map((resourceId) => {
      const resource = resources.find((item) => item.id === resourceId);
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = resource.name;
      return chip;
    })
  );

  elements.destinations.replaceChildren(
    ...getDestinationRows(state).map((destination) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "destination-button";
      button.disabled = !destination.canTravel;
      button.innerHTML = `<span>${destination.name}<small>${destination.type} | ${destination.factionAlignment} | ${destination.riskLevel} risk | ${destination.encounterRiskLabel}</small></span><strong>${destination.fuelCost} fuel | ${destination.travelDurationLabel}</strong>`;
      button.addEventListener("click", () => handleTravel(destination.id));
      return button;
    })
  );
}

function renderMarket() {
  const planet = getPlanet(state.currentPlanetId);
  elements.marketContext.textContent = `${planet.name} prices`;

  const rows = getMarketRows(state).map((row) => {
    const tr = document.createElement("tr");
    const buyQuantityId = `buy-qty-${row.id}`;
    const sellQuantityId = `sell-qty-${row.id}`;

    tr.innerHTML = `
      <td>
        <div class="resource-name">
          <span>${row.name}</span>
          ${row.producedHere ? '<small class="produced-tag">produced</small>' : ""}
        </div>
      </td>
      <td>${row.priceLabel}</td>
      <td>${row.owned}</td>
      <td>${renderSliderMarkup(buyQuantityId, `${row.name} buy quantity`, row.buySlider)}</td>
      <td><button class="trade-button buy" type="button" ${row.canBuyOne ? "" : "disabled"}>Buy</button></td>
      <td>${renderSliderMarkup(sellQuantityId, `${row.name} sell quantity`, row.sellSlider)}</td>
      <td><button class="trade-button sell" type="button" ${row.canSellOne ? "" : "disabled"}>Sell</button></td>
    `;

    const buyInput = tr.querySelector(`#${buyQuantityId}`);
    const sellInput = tr.querySelector(`#${sellQuantityId}`);
    bindSliderLabel(buyInput, tr.querySelector(`[data-slider-label="${buyQuantityId}"]`));
    bindSliderLabel(sellInput, tr.querySelector(`[data-slider-label="${sellQuantityId}"]`));

    tr.querySelector(".buy").addEventListener("click", () => {
      applyResult(buyResource(state, row.id, getQuantity(buyInput)));
    });
    tr.querySelector(".sell").addEventListener("click", () => {
      applyResult(sellResource(state, row.id, getQuantity(sellInput)));
    });

    return tr;
  });

  elements.marketBody.replaceChildren(...rows);
}

function renderCargo() {
  elements.cargoContext.textContent = "Hold contents";
  const rows = getCargoRows(state).map((row) => {
    const item = document.createElement("div");
    item.className = "cargo-row";
    item.innerHTML = `<span>${row.name}</span><strong>${row.quantity}</strong>`;
    return item;
  });
  elements.cargoList.replaceChildren(...rows);
}

function renderShipyard() {
  const view = getShipyardView(state);

  if (!view.isIndustrial) {
    elements.shipyardStatus.textContent = "No licensed shipyard at this port.";
    elements.shipyardBody.replaceChildren();
    return;
  }

  elements.shipyardStatus.textContent = `${view.planetName} Fleet Services`;

  const sections = [];

  // Current ship info
  const shipInfo = document.createElement("div");
  shipInfo.className = "shipyard-section";
  shipInfo.innerHTML = `
    <h3>Active Vessel</h3>
    <div class="shipyard-ship-info">
      <span class="shipyard-stat">Power: <strong>${view.currentShip.effectivePower}</strong></span>
      <span class="shipyard-stat">Cargo: <strong>${view.currentShip.effectiveCargo}</strong></span>
      <span class="shipyard-stat">Cargo upgrades: <strong>${view.currentShip.cargoUpgradeLevel}/${view.currentShip.cargoUpgradeMax}</strong></span>
      <span class="shipyard-stat">Engine upgrades: <strong>${view.currentShip.powerUpgradeLevel}/${view.currentShip.powerUpgradeMax}</strong></span>
    </div>
  `;
  sections.push(shipInfo);

  // Upgrades
  const upgradesSection = document.createElement("div");
  upgradesSection.className = "shipyard-section";
  upgradesSection.innerHTML = `<h3>Refit Services</h3>`;

  for (const [kind, upgrade, label] of [
    ['cargo', view.cargoUpgrade, 'Expand Cargo Bay'],
    ['power', view.powerUpgrade, 'Upgrade Fusion Drive']
  ]) {
    const item = document.createElement("div");
    item.className = "shipyard-upgrade-row";

    const costText = upgrade.atMax
      ? "Maximum level reached"
      : `${upgrade.parts} Ship Parts + ${new Intl.NumberFormat("en-US").format(upgrade.credits)} cr → Level ${upgrade.nextLevel}`;

    item.innerHTML = `
      <div class="upgrade-info">
        <strong>${label}</strong>
        <small>${costText}</small>
      </div>
    `;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "shipyard-btn";
    button.textContent = upgrade.atMax ? "Maxed" : "Upgrade";
    button.disabled = !upgrade.canUpgrade;
    if (!upgrade.canUpgrade && upgrade.reason) {
      button.title = upgrade.reason;
    }
    button.addEventListener("click", () => {
      applyResult(upgradeShip(state, kind));
    });

    item.appendChild(button);
    upgradesSection.appendChild(item);
  }
  sections.push(upgradesSection);

  // Ship catalog
  const catalogSection = document.createElement("div");
  catalogSection.className = "shipyard-section";
  catalogSection.innerHTML = `<h3>Available Hulls</h3>`;

  for (const entry of view.catalog) {
    const row = document.createElement("div");
    row.className = `shipyard-catalog-row${entry.isCurrent ? " current-ship" : ""}`;

    const basePowerText = Object.entries(entry.basePower)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `+${v} ${k}`)
      .join(", ");

    row.innerHTML = `
      <div class="catalog-info">
        <strong>${entry.label}${entry.isCurrent ? " (active)" : ""}</strong>
        <small>Power ${entry.powerCapacity} | Cargo ${entry.cargoCapacity} | Hull ${entry.hullMax} | Shield ${entry.shieldMax}${basePowerText ? ` | Innate: ${basePowerText}` : ""}</small>
        <small class="catalog-price">${entry.priceLabel}</small>
      </div>
    `;

    if (!entry.isCurrent) {
      const buyButton = document.createElement("button");
      buyButton.type = "button";
      buyButton.className = "shipyard-btn";
      buyButton.textContent = "Purchase";
      buyButton.disabled = !entry.canBuy;
      if (!entry.canBuy && entry.buyReason) {
        buyButton.title = entry.buyReason;
      }
      buyButton.addEventListener("click", () => {
        applyResult(buyShip(state, entry.classId));
      });
      row.appendChild(buyButton);
    }

    catalogSection.appendChild(row);
  }
  sections.push(catalogSection);

  elements.shipyardBody.replaceChildren(...sections);
}

function renderLog() {
  elements.messageLog.replaceChildren(
    ...state.messages.map((message) => {
      const item = document.createElement("li");
      item.textContent = message;
      return item;
    })
  );
}

function renderCombat() {
  const battle = state.combat.battle;
  const { player, enemy, turn, phase, winner, log } = battle;

  elements.playerName.textContent = player.label;
  elements.playerHull.textContent = formatHull(player.hull, player.hullMax);
  elements.playerHullBar.textContent = formatBar(player.hull, player.hullMax);
  elements.playerShield.textContent = formatShield(player.shield, player.shieldMax);
  elements.playerShieldBar.textContent = formatBar(player.shield, player.shieldMax);
  elements.playerPower.textContent = player.powerCapacity;

  elements.enemyName.textContent = enemy.label;
  elements.enemyHull.textContent = formatHull(enemy.hull, enemy.hullMax);
  elements.enemyHullBar.textContent = formatBar(enemy.hull, enemy.hullMax);
  elements.enemyShield.textContent = formatShield(enemy.shield, enemy.shieldMax);
  elements.enemyShieldBar.textContent = formatBar(enemy.shield, enemy.shieldMax);

  elements.turnNumber.textContent = turn;
  elements.phaseLabel.textContent = phaseLabel(phase);

  elements.allocationPanel.hidden = phase !== "allocate";
  elements.actionPanel.hidden = phase !== "action";
  elements.battleEndPanel.hidden = phase !== "ended";

  if (phase === "allocate") {
    renderAllocation(player);
  } else if (phase === "action") {
    renderActions(player);
  } else if (phase === "ended") {
    renderBattleEnd(winner);
  }

  elements.combatLog.replaceChildren(
    ...log.map((entry) => {
      const item = document.createElement("li");
      item.textContent = entry;
      return item;
    })
  );
}

function renderAllocation(player) {
  const remaining = allocationRemaining(player);
  const hullFull = player.hull >= player.hullMax;

  elements.powerRemaining.textContent = remaining;
  elements.powerRemainingWrap.className = `power-remaining${remaining < 0 ? " over" : ""}`;
  elements.endAllocation.disabled = !isAllocationValid(player);

  elements.presetRow.replaceChildren(
    ...PRESETS.map((preset) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "preset-btn";
      button.textContent = preset.label;
      button.addEventListener("click", () => handleCombatPreset(preset.weights));
      return button;
    })
  );

  elements.allocationGrid.replaceChildren(
    ...SYSTEMS.map((system) => {
      const repairDisabled = system === "repair" && hullFull;
      const cell = document.createElement("div");
      cell.className = `alloc-cell has-tip${repairDisabled ? " repair-disabled" : ""}`;
      cell.setAttribute("data-tip", systemTooltip(system, player));

      const label = document.createElement("div");
      label.className = "alloc-label";
      label.textContent = SYSTEM_LABELS[system];

      // Show innate base power if present
      const baseVal = player.basePower?.[system] ?? 0;
      if (baseVal > 0) {
        const baseTag = document.createElement("span");
        baseTag.className = "base-power-tag";
        baseTag.textContent = `+${baseVal} innate`;
        label.appendChild(baseTag);
      }

      const controls = document.createElement("div");
      controls.className = "alloc-controls";

      const minusButton = document.createElement("button");
      minusButton.type = "button";
      minusButton.className = "alloc-btn";
      minusButton.textContent = "-";
      minusButton.disabled = player.allocation[system] <= 0 || repairDisabled;
      minusButton.addEventListener("click", () => {
        state = updatePlayerAllocation(state, system, -1);
        render();
      });

      const value = document.createElement("span");
      value.className = "alloc-value";
      value.textContent = player.allocation[system];

      // Show effective total (base + allocated)
      const effective = effectivePoints(player, system);
      const effectiveSpan = document.createElement("span");
      effectiveSpan.className = "alloc-effective";
      effectiveSpan.textContent = effective > 0 ? `=${effective}` : "";

      const plusButton = document.createElement("button");
      plusButton.type = "button";
      plusButton.className = "alloc-btn";
      plusButton.textContent = "+";
      plusButton.disabled = remaining <= 0 || repairDisabled;
      plusButton.addEventListener("click", () => {
        state = updatePlayerAllocation(state, system, 1);
        render();
      });

      controls.append(minusButton, value, effectiveSpan, plusButton);
      cell.append(label, controls);
      return cell;
    })
  );
}

function renderActions(player) {
  const actionButtons = getWeaponRows(player).map((row) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "action-btn weapon";
    button.disabled = !row.available;
    button.innerHTML = `<span>Fire ${row.name}</span><span class="weapon-note">${row.available && row.ammo !== null ? `${row.ammo} remaining` : row.reason}</span>`;
    button.addEventListener("click", () => handleCombatAction({ type: "fire", weaponId: row.id }));
    return button;
  });

  actionButtons.push(makeActionButton("Brace", "brace", { type: "brace" }, "Apply shield regen a second time this turn."));
  actionButtons.push(makeActionButton("Hold", "hold", { type: "hold" }, "Take no action this turn."));

  const chance = Math.round(runAwayChance(player) * 100);
  const runButton = document.createElement("button");
  runButton.type = "button";
  runButton.className = "action-btn run";
  runButton.innerHTML = `<span>Run Away</span><span class="weapon-note">${chance}% success</span>`;
  runButton.title = "Escape chance: effective engines x 12% + effective sensors x 5%. Enemy may still fire.";
  runButton.addEventListener("click", () => handleCombatAction({ type: "run" }));
  actionButtons.push(runButton);

  elements.actionButtons.replaceChildren(...actionButtons);
}

function renderBattleEnd(winner) {
  const label = battleResultLabel(winner);
  elements.resultHeading.textContent = label;
  elements.resultHeading.className = `result-heading ${winner}`;
  elements.resultSubtext.textContent =
    winner === "player" ? "The route is clear. Salvage has been recovered." :
    winner === "enemy" ? "Your hull gives out before reaching port." :
    winner === "draw" ? "Mutual destruction ends the run." :
    winner === "escaped" ? "You jump clear and continue toward port." : "";
}

function renderGameOver() {
  elements.gameOverMessage.textContent = state.messages[0] ?? "Your run has ended.";
}

function drawMap() {
  const { width, height } = resizeMapCanvas();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#07080d";
  ctx.fillRect(0, 0, width, height);

  for (const star of stars) {
    star.x = (star.x + star.drift / width) % 1;
    ctx.beginPath();
    ctx.arc(star.x * width, star.y * height, star.radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(234, 241, 255, 0.72)";
    ctx.fill();
  }

  const mapPlanets = getProjectedMapView(getPlanetMapView(state), width, height);
  ctx.strokeStyle = "rgba(104, 211, 145, 0.22)";
  ctx.lineWidth = 1;
  for (let i = 0; i < mapPlanets.length; i += 1) {
    for (let j = i + 1; j < mapPlanets.length; j += 1) {
      ctx.beginPath();
      ctx.moveTo(mapPlanets[i].x, mapPlanets[i].y);
      ctx.lineTo(mapPlanets[j].x, mapPlanets[j].y);
      ctx.stroke();
    }
  }

  for (const planet of mapPlanets) {
    ctx.beginPath();
    ctx.arc(planet.x, planet.y, planet.active ? 14 : 10, 0, Math.PI * 2);
    const markerColor = planet.active ? MAP_MARKER_COLORS.current : getRiskColor(planet.riskLevel);
    ctx.fillStyle = markerColor;
    ctx.shadowColor = planet.active ? MAP_MARKER_COLORS.moderate : markerColor;
    ctx.shadowBlur = planet.active ? 18 : 8;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.font = planet.active ? "700 15px system-ui" : "600 13px system-ui";
    ctx.fillStyle = "#f4f0e8";
    ctx.fillText(planet.name, planet.x + 18, planet.y + 5);
  }
}

function applyResult(result) {
  state = result.state;
  render();
  if (result.requiresConfirmation) {
    pendingTravel = result;
    showTravelDialog(result.message);
  }
}

function getQuantity(input) {
  return Number.parseInt(input.value, 10);
}

function handleTravel(destinationPlanetId) {
  applyResult(beginTravel(state, destinationPlanetId, {}, rng));
}

function handleCombatPreset(weights) {
  const battle = state.combat.battle;
  let allocation = computePresetAllocation(weights, battle.player.powerCapacity);
  if (battle.player.hull >= battle.player.hullMax && allocation.repair > 0) {
    allocation = {
      ...allocation,
      weapons: allocation.weapons + allocation.repair,
      repair: 0
    };
  }
  state = setPlayerAllocation(state, allocation);
  render();
}

function handleCombatAction(action) {
  applyResult(resolveIntegratedBattleTurn(state, action, rng));
}

function makeActionButton(label, className, action, title) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `action-btn ${className}`;
  button.textContent = label;
  button.title = title;
  button.addEventListener("click", () => handleCombatAction(action));
  return button;
}

function renderSliderMarkup(id, label, slider) {
  return `
    <div class="quantity-slider">
      <input id="${id}" type="range" min="${slider.min}" max="${slider.max}" step="1" value="${slider.value}" aria-label="${label}" ${slider.disabled ? "disabled" : ""}>
      <output data-slider-label="${id}" for="${id}">${slider.label}</output>
    </div>
  `;
}

function renderMapLegend() {
  elements.mapLegend.replaceChildren(
    ...getMapLegendRows().map((row) => {
      const item = document.createElement("div");
      item.className = "map-legend-item";
      item.innerHTML = `<span class="map-swatch" aria-hidden="true"></span><span>${row.label}</span>`;
      item.querySelector(".map-swatch").style.backgroundColor = row.color;
      return item;
    })
  );
}

function bindSliderLabel(input, label) {
  if (!input || !label) {
    return;
  }

  input.addEventListener("input", () => {
    label.textContent = input.value;
  });
}

function showTravelDialog(message) {
  elements.travelConfirmationMessage.textContent = message;
  if (typeof elements.travelDialog.showModal === "function") {
    elements.travelDialog.showModal();
  } else if (window.confirm(message)) {
    elements.confirmTravelButton.click();
  } else {
    elements.cancelTravelButton.click();
  }
}

function closeTravelDialog() {
  if (elements.travelDialog.open) {
    elements.travelDialog.close();
  }
}

function getRiskColor(riskLevel) {
  if (riskLevel === "high") {
    return MAP_MARKER_COLORS.high;
  }
  if (riskLevel === "moderate") {
    return MAP_MARKER_COLORS.moderate;
  }
  return MAP_MARKER_COLORS.low;
}

function resizeMapCanvas() {
  const bounds = elements.canvas.getBoundingClientRect();
  const width = Math.max(320, Math.round(bounds.width));
  const height = Math.max(280, Math.round(bounds.height));
  const pixelRatio = window.devicePixelRatio || 1;
  const scaledWidth = Math.round(width * pixelRatio);
  const scaledHeight = Math.round(height * pixelRatio);

  if (elements.canvas.width !== scaledWidth || elements.canvas.height !== scaledHeight) {
    elements.canvas.width = scaledWidth;
    elements.canvas.height = scaledHeight;
  }

  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  return { width, height };
}

render();
window.addEventListener("resize", drawMap);
setInterval(() => {
  if (state.mode === "trade") {
    drawMap();
  }
}, 60);

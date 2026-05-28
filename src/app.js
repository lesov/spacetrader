import { resources } from "./data.js";
import {
  buyResource,
  cancelTravelConfirmation,
  createInitialState,
  getPlanet,
  sellResource,
  travelToPlanet
} from "./game.js";
import {
  MAP_MARKER_COLORS,
  getCargoRows,
  getDestinationRows,
  getMapLegendRows,
  getMarketRows,
  getPlanetMapView,
  getProjectedMapView,
  getStatusView
} from "./uiState.js";

let state = createInitialState();
let pendingTravel = null;

const elements = {
  campaignLabel: document.querySelector("#campaign-label"),
  marketClimate: document.querySelector("#market-climate"),
  credits: document.querySelector("#credits"),
  fuel: document.querySelector("#fuel"),
  cargoSpace: document.querySelector("#cargo-space"),
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
  canvas: document.querySelector("#star-map")
};

const ctx = elements.canvas.getContext("2d");
const stars = Array.from({ length: 90 }, (_, index) => ({
  x: ((index * 67) % 720) / 720,
  y: ((index * 37) % 420) / 420,
  radius: 0.7 + (index % 3) * 0.35,
  drift: 0.08 + (index % 5) * 0.015
}));

elements.resetButton.addEventListener("click", () => {
  pendingTravel = null;
  closeTravelDialog();
  state = createInitialState();
  render();
});

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
  applyResult(travelToPlanet(state, destinationPlanetId, { confirmed: true }));
});

function render() {
  renderStatus();
  renderPlanetPanel();
  renderMapLegend();
  renderMarket();
  renderCargo();
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
      button.innerHTML = `<span>${destination.name}<small>${destination.type} | ${destination.factionAlignment} | ${destination.riskLevel} risk</small></span><strong>${destination.fuelCost} fuel</strong>`;
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

function renderLog() {
  elements.messageLog.replaceChildren(
    ...state.messages.map((message) => {
      const item = document.createElement("li");
      item.textContent = message;
      return item;
    })
  );
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
  applyResult(travelToPlanet(state, destinationPlanetId));
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
setInterval(drawMap, 60);

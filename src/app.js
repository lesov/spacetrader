import { planets, resources } from "./data.js";
import {
  buyResource,
  cancelTravelConfirmation,
  createInitialState,
  getPlanet,
  sellResource,
  travelToPlanet
} from "./game.js";
import {
  getCargoRows,
  getDestinationRows,
  getMarketRows,
  getPlanetMapView,
  getStatusView
} from "./uiState.js";

let state = createInitialState();
let pendingTravel = null;

const elements = {
  credits: document.querySelector("#credits"),
  fuel: document.querySelector("#fuel"),
  cargoSpace: document.querySelector("#cargo-space"),
  currentPlanet: document.querySelector("#current-planet"),
  tradeStatus: document.querySelector("#trade-status"),
  routeLine: document.querySelector("#route-line"),
  planetHeading: document.querySelector("#planet-heading"),
  planetNote: document.querySelector("#planet-note"),
  productionList: document.querySelector("#production-list"),
  destinations: document.querySelector("#destinations"),
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
  x: (index * 67) % elements.canvas.width,
  y: (index * 37) % elements.canvas.height,
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
  renderMarket();
  renderCargo();
  renderLog();
  drawMap();
}

function renderStatus() {
  const status = getStatusView(state);
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
  elements.planetNote.textContent = `${planet.type} | ${planet.note}`;

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
      button.innerHTML = `<span>${destination.name}<small>${destination.type}</small></span><strong>${destination.fuelCost} fuel</strong>`;
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
  const { width, height } = elements.canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#07080d";
  ctx.fillRect(0, 0, width, height);

  for (const star of stars) {
    star.x = (star.x + star.drift) % width;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(234, 241, 255, 0.72)";
    ctx.fill();
  }

  const mapPlanets = getPlanetMapView(state);
  ctx.strokeStyle = "rgba(104, 211, 145, 0.22)";
  ctx.lineWidth = 1;
  for (let i = 0; i < planets.length; i += 1) {
    for (let j = i + 1; j < planets.length; j += 1) {
      ctx.beginPath();
      ctx.moveTo(planets[i].position.x, planets[i].position.y);
      ctx.lineTo(planets[j].position.x, planets[j].position.y);
      ctx.stroke();
    }
  }

  for (const planet of mapPlanets) {
    ctx.beginPath();
    ctx.arc(planet.x, planet.y, planet.active ? 14 : 10, 0, Math.PI * 2);
    ctx.fillStyle = planet.active ? "#f7b955" : "#6ad3d1";
    ctx.shadowColor = planet.active ? "#f7b955" : "#6ad3d1";
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

render();
setInterval(drawMap, 60);

export const MARKET_EVENTS = [
  {
    id: "enceladus-route-security",
    startsOn: "2175-12-01",
    endsOn: "2176-04-30",
    headline: "Saturn Route Security Premiums Rise",
    body: "Convoy insurers raised rates after another stalled Enceladus arbitration round, lifting demand for fuel, parts, and medical cargo across outer-system ports.",
    modifiers: [
      { resourceId: "fuel", planetIds: ["titan", "enceladus", "triton"], percent: 12 },
      { resourceId: "shipParts", planetIds: ["titan", "enceladus", "triton"], percent: 18 },
      { resourceId: "biomaterials", planetIds: ["enceladus", "europa"], percent: -10 }
    ]
  },
  {
    id: "luna-yard-credit",
    startsOn: "2175-12-01",
    endsOn: "2176-02-28",
    headline: "Lunar Yards Tighten Export Slots",
    body: "Luna's shipyards are prioritizing fleet contracts, making open-market ship parts dearer while refined metals move at a discount to keep lines supplied.",
    modifiers: [
      { resourceId: "shipParts", planetIds: ["luna", "earth", "mars"], percent: 14 },
      { resourceId: "metals", planetIds: ["luna", "mars", "ganymede"], percent: -8 }
    ]
  },
  {
    id: "venus-deuterium-auction",
    startsOn: "2176-03-01",
    endsOn: "2176-08-31",
    headline: "Venusian Deuterium Auction Clears Low",
    body: "Neutral cloud-city suppliers released reserve fuel contracts, pushing inner-system deuterium prices down while luxury demand at Venusian ports stays strong.",
    modifiers: [
      { resourceId: "fuel", planetIds: ["venus", "mercury", "luna"], percent: -15 },
      { resourceId: "luxuries", planetIds: ["venus", "earth"], percent: 10 }
    ]
  },
  {
    id: "belt-autonomy-summit",
    startsOn: "2176-09-01",
    endsOn: "2177-02-28",
    headline: "Belt Autonomy Summit Draws Buyers",
    body: "Independent stations are buying cultural archives and finished components for new civic systems, while water shipments from Ceres remain plentiful.",
    modifiers: [
      { resourceId: "culture", planetIds: ["ceres", "triton", "enceladus"], percent: 18 },
      { resourceId: "quantum", planetIds: ["ceres", "triton"], percent: 12 },
      { resourceId: "water", planetIds: ["ceres", "callisto"], percent: -10 }
    ]
  }
];

export function getActiveMarketEvents(dateText) {
  return MARKET_EVENTS.filter((event) => dateText >= event.startsOn && dateText <= event.endsOn);
}

export function getMarketModifier(dateText, planetId, resourceId) {
  return getActiveMarketEvents(dateText).reduce((total, event) => (
    total + event.modifiers
      .filter((modifier) => modifier.resourceId === resourceId && modifier.planetIds.includes(planetId))
      .reduce((sum, modifier) => sum + modifier.percent, 0)
  ), 0);
}

export function applyMarketModifier(basePrice, modifierPercent) {
  return Math.max(1, Math.round(basePrice * (1 + modifierPercent / 100)));
}

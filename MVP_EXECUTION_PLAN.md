# Space Trader Local MVP Execution Plan

This plan defines a very small local-only web app MVP for a space trading game. It is intended for local testing and iteration only, not public release.

## MVP Goal

Build a playable browser-based loop where the player:

1. Starts on one planet with a small ship, credits, fuel, and limited cargo space.
2. Reviews planet market prices for trade resources.
3. Buys resources where prices are low.
4. Spends fuel to travel to another planet.
5. Sells resources where prices are higher.
6. Buys fuel as needed.
7. Repeats the loop to grow credits through arbitrage.

## Scope Constraints

- Local web app only.
- No authentication.
- No backend service unless the chosen frontend scaffold requires a local dev server.
- No multiplayer.
- No procedural galaxy generation in this stage.
- No ship maintenance, upgrades, damage, crew, combat, missions, events, or economy simulation beyond deterministic market prices.
- No public deployment or release packaging in this stage.

## Suggested Technical Shape

- Use a small frontend stack suitable for local development, preferably TypeScript with a simple component framework if one is introduced.
- Keep game rules in framework-independent modules so they can be unit tested without rendering the UI.
- Keep initial data in static source files.
- Keep player state in memory first. Add local storage only if it is trivial and covered by tests.
- Use deterministic logic for prices and travel costs so tests are stable.

## Initial Game Data

Use a compact, readable data set. The exact names can change during implementation, but the MVP should start with about six resources and five planets.

### Resources

- Fuel
- Ore
- Water
- Food
- Medicine
- Electronics

### Planets

Each planet produces exactly three resources. Produced resources should have lower local price ranges. Non-produced resources should have higher local price ranges.

| Planet | Produces | Notes |
| --- | --- | --- |
| Aster | Fuel, Ore, Electronics | Industrial starter world |
| Brine | Water, Food, Medicine | Agricultural and medical supply world |
| Cinder | Fuel, Ore, Water | Harsh mining and refining world |
| Helio | Food, Electronics, Medicine | Wealthier trade hub |
| Vesta | Ore, Water, Food | Frontier supply world |

### Price Ranges

- Each planet must define a min and max price for every resource.
- Produced resources should be meaningfully cheaper than the same resources on planets that do not produce them.
- Prices may be static for the MVP, chosen from each range at initialization.
- The first implementation should avoid random price changes unless seeded deterministically and tested.

### Ship And Player Defaults

- Starting credits: 1,000.
- Starting planet: Aster.
- Cargo capacity: 20 units total.
- Starting cargo: empty.
- Starting fuel: 30 units.
- Fuel cargo handling: fuel is tracked separately from cargo for the MVP.
- Travel fuel cost: fixed per route or derived from a simple distance table.
- Buying fuel: fuel can be bought on any planet at that planet's fuel price.

## Core Rules

### Buying Goods

- Player can buy a positive integer quantity of a resource.
- Purchase is allowed only if the player has enough credits.
- Purchase is allowed only if the ship has enough remaining cargo capacity.
- Fuel purchases increase fuel, not cargo.
- Credits decrease by `quantity * localPrice`.

### Selling Goods

- Player can sell a positive integer quantity of a resource in cargo.
- Sale is allowed only if the player has enough of that resource.
- Credits increase by `quantity * localPrice`.
- Cargo quantity decreases by the sold amount.

### Travel

- Player can travel from the current planet to another planet.
- Travel consumes fuel based on the route cost.
- Travel is allowed only if the player has enough fuel.
- Travel changes the current planet.
- Travel does not change cargo.

### Market Display

- The player can see the current planet's buy/sell prices.
- The player can see which resources the current planet produces.
- The player can see cargo, credits, fuel, current planet, and remaining cargo space.
- The player can compare basic target planet information without overbuilding the UI.

## MVP Screen Layout

The first screen should be the game itself, not a landing page.

Required areas:

- Status bar: current planet, credits, fuel, cargo used/available.
- Planet panel: current planet name, produced resources, available destinations with fuel costs.
- Market table: resource, price, owned quantity, buy control, sell control.
- Cargo panel: current cargo quantities.
- Travel controls: destination selector or buttons with disabled state when fuel is insufficient.
- Message log: recent buy, sell, travel, and error messages.

UI work must remain pending until a human tester explicitly approves it, per `AGENT_WORKFLOW_INSTRUCTIONS.md`.

## Automated Test Plan

Game-rule tests are required before implementation is considered complete.

Minimum unit/regression coverage:

- Buying reduces credits and increases cargo.
- Buying fails when credits are insufficient.
- Buying fails when cargo capacity would be exceeded.
- Selling increases credits and decreases cargo.
- Selling fails when inventory is insufficient.
- Fuel purchases increase fuel and reduce credits.
- Fuel purchases fail when credits are insufficient.
- Travel consumes fuel and changes current planet.
- Travel fails when fuel is insufficient.
- Price data includes every resource on every planet.
- Each planet produces exactly three resources.
- Produced resources are cheaper than at least one non-producing planet for the same resource.

UI-adjacent tests should cover:

- Derived cargo capacity calculations.
- Disabled state logic for buy, sell, and travel controls.
- Formatting of credits, fuel, and cargo quantities.
- Message generation for successful and failed actions.

## Human Test Checklist

Human UI approval is required for any implemented UI.

- [ ] App launches locally.
- [ ] First screen is the playable game, not a marketing page.
- [ ] Player can buy cargo on the starting planet.
- [ ] Player cannot exceed cargo capacity.
- [ ] Player can travel when enough fuel is available.
- [ ] Player cannot travel when fuel is insufficient.
- [ ] Player can sell cargo on another planet.
- [ ] Player can buy more fuel.
- [ ] Credits, fuel, cargo, and current planet update clearly after each action.
- [ ] The arbitrage loop is understandable without explanatory marketing text.
- [ ] Human tester explicitly approves the UI.

## Execution Checklist

- [ ] Confirm current work is on a non-`main` branch and isolated worktree.
- [ ] Review `AGENT_WORKFLOW_INSTRUCTIONS.md`.
- [ ] Review `AGENT_CHANGELOG.md`.
- [ ] Create or verify local web app scaffold.
- [ ] Add static resource and planet data.
- [ ] Implement pure game state and rules module.
- [ ] Add unit tests for buying, selling, fuel, travel, cargo limits, and market data integrity.
- [ ] Build the minimal game UI as the first screen.
- [ ] Add UI-adjacent tests for derived state, disabled controls, and user-facing messages.
- [ ] Run all relevant automated tests.
- [ ] Start local dev server and provide the local URL for human testing.
- [ ] Record human UI approval status in `AGENT_CHANGELOG.md`.
- [ ] Keep work on the task branch until human approval is given to merge.

## Definition Of Done For MVP Stage

- The local web app runs.
- The player can complete the buy, travel, sell, refuel loop.
- Cargo capacity and fuel constraints are enforced.
- Every planet has prices for every resource.
- Every planet produces exactly three resources.
- Automated rule tests pass.
- UI-adjacent tests pass where applicable.
- Human UI testing has been completed and explicitly approved.
- `AGENT_CHANGELOG.md` records implementation status, test results, and UI approval status.
- No merge to `main` occurs without explicit human approval.


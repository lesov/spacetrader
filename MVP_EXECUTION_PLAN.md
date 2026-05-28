# Space Trader Local MVP Execution Plan

This plan defines a very small local-only web app MVP for a space trading game. It is intended for local testing and iteration only, not public release.

## MVP Goal

Build a playable browser-based loop where the player:

1. Starts at one Solar System trade location with a small ship, credits, fuel, and limited cargo space.
2. Reviews local market prices for trade resources.
3. Buys resources where prices are low.
4. Spends fuel to travel to another location.
5. Sells resources where prices are higher.
6. Buys fuel as needed.
7. Repeats the loop to grow credits through arbitrage.

## Current Change Request

The next implementation pass must update the MVP with these required changes:

1. Show a confirmation before travel if the player has not bought or sold anything at the current location since arrival.
2. Replace single-unit quantity inputs with sliders so the player can buy or sell multiple units in one action.
3. Change the setting from fictional planets to a distant-future version of the real Solar System, using planets and major satellites as trade locations.

This change must be implemented on an isolated branch/worktree and must not interfere with other active agent work. As of this plan update, another agent is working on a separate combat planning branch; future changelog merges must preserve that work.

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

Use a compact, readable data set. The exact names can change during implementation, but the MVP should keep about six resources and use recognizable Solar System locations instead of fictional planets.

### Resources

- Fuel
- Ore
- Water
- Food
- Medicine
- Electronics

### Trade Locations

Each trade location produces exactly three resources. Produced resources should have lower local price ranges. Non-produced resources should have higher local price ranges.

| Location | Type | Produces | Notes |
| --- | --- | --- |
| Mars | Planet | Ore, Food, Electronics | Terraforming-era industrial starter world |
| Europa | Jovian moon | Water, Medicine, Food | Ice-ocean biolabs and aquaculture |
| Titan | Saturnian moon | Fuel, Medicine, Electronics | Hydrocarbon refineries and cryogenic research |
| Mercury | Planet | Ore, Fuel, Electronics | Solar foundries and metals extraction |
| Ganymede | Jovian moon | Water, Ore, Food | Frontier port and subsurface agriculture |
| Luna | Earth moon | Electronics, Medicine, Fuel | High-orbit manufacturing and medical logistics |

### Price Ranges

- Each trade location must define a min and max price for every resource.
- Produced resources should be meaningfully cheaper than the same resources on locations that do not produce them.
- Prices may be static for the MVP, chosen from each range at initialization.
- The first implementation should avoid random price changes unless seeded deterministically and tested.
- Keep ranges representative, not scientifically exact. This is a distant-future game setting, so production should be plausible rather than fully realistic.

### Ship And Player Defaults

- Starting credits: 1,000.
- Starting location: Mars.
- Cargo capacity: 20 units total.
- Starting cargo: empty.
- Starting fuel: 30 units.
- Fuel cargo handling: fuel is tracked separately from cargo for the MVP.
- Travel fuel cost: fixed per route or derived from a simple distance table based on Solar System route abstractions.
- Buying fuel: fuel can be bought at any trade location at that location's fuel price.

## Core Rules

### Buying Goods

- Player can buy a positive integer quantity of a resource.
- Purchase is allowed only if the player has enough credits.
- Purchase is allowed only if the ship has enough remaining cargo capacity.
- Fuel purchases increase fuel, not cargo.
- Credits decrease by `quantity * localPrice`.
- A successful buy marks the current location as traded.

### Selling Goods

- Player can sell a positive integer quantity of a resource in cargo.
- Sale is allowed only if the player has enough of that resource.
- Credits increase by `quantity * localPrice`.
- Cargo quantity decreases by the sold amount.
- A successful sale marks the current location as traded.

### Travel

- Player can travel from the current location to another location.
- Travel consumes fuel based on the route cost.
- Travel is allowed only if the player has enough fuel.
- Travel changes the current location.
- Travel does not change cargo.
- If the player has not bought or sold anything since arriving at the current location, travel must require confirmation before fuel is spent.
- Confirmed travel should proceed normally and reset the traded-at-current-location flag to `false` on arrival.
- If the player cancels the confirmation, no fuel is spent and location does not change.

### Quantity Sliders

- Each market row must use a slider for quantity selection.
- The slider value must be visible next to or within the control.
- Buy slider maximum should be the largest quantity the player can afford and fit in cargo.
- Fuel buy slider maximum should be the largest fuel quantity the player can afford.
- Sell slider maximum should be the owned cargo quantity for that resource.
- Slider controls should disable when the maximum valid quantity is zero.
- Slider state must not allow invalid purchases or sales; rules modules still enforce validation.

### Market Display

- The player can see the current location's buy/sell prices.
- The player can see which resources the current location produces.
- The player can see cargo, credits, fuel, current location, and remaining cargo space.
- The player can compare basic target location information without overbuilding the UI.
- The player can see whether they have traded at the current location before attempting to leave.

## MVP Screen Layout

The first screen should be the game itself, not a landing page.

Required areas:

- Status bar: current location, credits, fuel, cargo used/available.
- Location panel: current Solar System location name, type, produced resources, available destinations with fuel costs.
- Market table: resource, price, owned quantity, quantity slider, buy control, sell control.
- Cargo panel: current cargo quantities.
- Travel controls: destination selector or buttons with disabled state when fuel is insufficient.
- Travel confirmation: modal or native confirmation shown only when no successful buy/sell occurred at the current location.
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
- Travel consumes fuel and changes current location.
- Travel fails when fuel is insufficient.
- Travel from an untraded location returns a confirmation-required result before consuming fuel.
- Confirmed travel from an untraded location consumes fuel and changes location.
- Canceled travel from an untraded location does not consume fuel and does not change location.
- Successful buy and sell actions mark the current location as traded.
- Arrival at a new location resets the traded-at-current-location flag.
- Price data includes every resource at every trade location.
- Each trade location produces exactly three resources.
- Produced resources are cheaper than at least one non-producing location for the same resource.
- Initial data uses real Solar System planets or satellites, not fictional planet names.

UI-adjacent tests should cover:

- Derived cargo capacity calculations.
- Slider min, max, disabled state, and selected quantity labels for buy and sell controls.
- Disabled state logic for buy, sell, slider, confirmation, and travel controls.
- Formatting of credits, fuel, and cargo quantities.
- Message generation for successful and failed actions.
- Travel confirmation message generation when no trade occurred at the current location.

## Human Test Checklist

Human UI approval is required for any implemented UI.

- [ ] App launches locally.
- [ ] First screen is the playable game, not a marketing page.
- [ ] Player can buy cargo on the starting location.
- [ ] Player can use a slider to buy more than one unit in one action.
- [ ] Player can use a slider to sell more than one unit in one action.
- [ ] Player cannot exceed cargo capacity.
- [ ] Player can travel when enough fuel is available.
- [ ] Player cannot travel when fuel is insufficient.
- [ ] Player sees and can cancel a travel confirmation when leaving a location without trading.
- [ ] Player does not see the travel confirmation after buying or selling at the current location.
- [ ] Player can sell cargo at another location.
- [ ] Player can buy more fuel.
- [ ] Locations are recognizable Solar System planets or satellites in a distant-future setting.
- [ ] Credits, fuel, cargo, and current location update clearly after each action.
- [ ] The arbitrage loop is understandable without explanatory marketing text.
- [ ] Human tester explicitly approves the UI.

## Execution Checklist

- [x] Confirm current work is on a non-`main` branch and isolated worktree for the planning update.
- [x] Review `AGENT_WORKFLOW_INSTRUCTIONS.md`.
- [x] Review `AGENT_CHANGELOG.md`.
- [x] Identify active parallel worktrees and avoid touching another agent's branch.
- [ ] Create a new implementation branch/worktree from `feature/codex/solar-system-trading-prep` or continue from this branch only after confirming no conflicts.
- [ ] Replace fictional planet data with Solar System trade location data.
- [ ] Rename user-facing "planet" copy to "location" where appropriate while preserving simple code names if refactor cost is not justified.
- [ ] Add state tracking for whether the player has traded since arriving at the current location.
- [ ] Add pure travel confirmation flow support in the game rules.
- [ ] Add slider quantity view-state helpers for buy and sell limits.
- [ ] Replace market quantity inputs with sliders and visible selected values.
- [ ] Add travel confirmation UI.
- [ ] Add or update unit tests for buying, selling, fuel, travel, cargo limits, market data integrity, and trade-location data.
- [ ] Add UI-adjacent tests for slider limits, disabled controls, confirmation state, and user-facing messages.
- [ ] Run all relevant automated tests.
- [ ] Start local dev server and provide the local URL for human testing.
- [ ] Record human UI approval status in `AGENT_CHANGELOG.md`.
- [ ] Keep work on the task branch until human approval is given to merge.

## Definition Of Done For MVP Stage

- The local web app runs.
- The player can complete the buy, travel, sell, refuel loop.
- Cargo capacity and fuel constraints are enforced.
- Travel asks for confirmation if the player has not bought or sold anything at the current location.
- Buy and sell quantities are controlled with sliders.
- Trade locations are recognizable Solar System planets or satellites in a distant-future setting.
- Every trade location has prices for every resource.
- Every trade location produces exactly three resources.
- Automated rule tests pass.
- UI-adjacent tests pass where applicable.
- Human UI testing has been completed and explicitly approved.
- `AGENT_CHANGELOG.md` records implementation status, test results, and UI approval status.
- No merge to `main` occurs without explicit human approval.

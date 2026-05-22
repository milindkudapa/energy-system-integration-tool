# Kozani · Energy Systems Integration Decision Tool

An interactive decision-support tool for a research seminar on **ESI for Resilience** in
post-lignite Kozani / Western Macedonia. A regional planner — composite of Municipality,
PPC, IPTO, Greek state, foreign offtaker and local community — must decide what energy
assets to build, in what sequence, and how to operate them, under physical, economic and
political constraints and deep uncertainty about climate, prices and geopolitics. This
tool exposes the trade-offs and shows how a robust, game-theoretic decision differs from
a naïve cost-optimal one.

All data is generated procedurally in the browser; all simulation runs in JS on every
slider change. Target: < 50 ms per outcome; < 300 ms for the 12-scenario robust ensemble.

---

## Contents

1. [Run](#1-run)
2. [App shell and layout](#2-app-shell-and-layout)
3. [Top bar](#3-top-bar)
4. [Sections](#4-sections)
5. [Controls pane — every slider](#5-controls-pane--every-slider)
6. [Visualisation pane — every tab](#6-visualisation-pane--every-tab)
7. [KPI pane — every card](#7-kpi-pane--every-card)
8. [Presets](#8-presets)
9. [Simulation pipeline](#9-simulation-pipeline)
10. [Payoff functions and game solvers](#10-payoff-functions-and-game-solvers)
11. [Robust-check ensemble](#11-robust-check-ensemble)
12. [Procedural hourly profiles](#12-procedural-hourly-profiles)
13. [Hardcoded anchors and constants](#13-hardcoded-anchors-and-constants)
14. [Geography](#14-geography)
15. [Visual design rules](#15-visual-design-rules)
16. [File layout](#16-file-layout)
17. [What this MVP does not model](#17-what-this-mvp-does-not-model)
18. [Calibration sources](#18-calibration-sources)

---

## 1. Run

The artifact is a single static HTML page; no build step is required.

```
open index.html
# or:
python3 -m http.server 8000   # then open http://localhost:8000
```

Production deployment to AWS S3 + CloudFront: upload the project root as-is. The
runtime fetches no APIs except the OpenStreetMap raster tile server for the basemap.

**Optional Vite path** for a versioned hashed build: convert the IIFE-style
`src/data/*.js` files to ES modules, move the CDN `<script>` tags into `package.json`
deps (`react`, `react-dom`, `recharts`, `maplibre-gl`), then `npm run build` and
`aws s3 sync dist/ s3://your-bucket/`.

---

## 2. App shell and layout

```
┌──────────────────────────────────────────────────────────────────┐
│  TOP BAR — brand · section tabs · preset · reset · vs-baseline   │
├──────────────┬───────────────────────────────────┬───────────────┤
│              │  VIZ TABS — map · dispatch ·      │               │
│  CONTROLS    │  sankey · pareto · game           │  KPI PANEL    │
│  PANE        │                                   │               │
│              │                                   │               │
│  (grouped    │                                   │  (KPI cards + │
│   sliders)   │  PRIMARY VISUAL                   │   mini-charts │
│              │                                   │   + regret    │
│              │                                   │   strip)      │
└──────────────┴───────────────────────────────────┴───────────────┘
```

- **48 px top bar** with brand mark, section tabs, preset/reset/baseline/data buttons.
- **3-column main grid**: 264 px controls · 1fr viz · 304 px KPI panel.
- Static landing pages (Framework · Modules · Methods) replace the 3-column shell
  with a single scrolling document — they are read-only and have no live simulation.
- **Recompute strip** — a 1 px teal bar at the top of the visual pane flickers each
  time the simulation re-runs (reassures the user the value they slid actually had
  an effect).

---

## 3. Top bar

| Element | Behaviour |
|---|---|
| **Brand mark** | Teal dot + "Kozani / ESI for Resilience". Static; no click. |
| **Section tabs** | Framework, Modules, Self-sufficiency, Export, Methods. Active section is outlined; inactive is muted. |
| **Preset dropdown** (Self-suff / Export only) | Selecting a preset triggers an animated 600 ms slider sweep. Resets to the placeholder option after each apply. |
| **Applying pill** | Shows during the preset animation with a pulsing dot. |
| **Reset** | Restores all sliders to the "Status quo" defaults. |
| **Set baseline** | Pins the *current* configuration as the comparison anchor used by all "vs baseline" delta chips. |
| **vs baseline checkbox** | Toggles the delta chips on/off. |
| **Data** | Opens a modal listing calibration sources and the geography honesty disclaimer. |

---

## 4. Sections

### Framework (static landing)
Actor-strategy-payoff overview + module stack preview. Five "stage" cards
(Resource → Demand → Dispatch → Economics → Game·Robust), and an actor table listing
strategy levers and payoff functions for Municipality, PPC, IPTO, State, Offtaker,
Community. "Begin demo" button advances to Modules.

### Modules (static landing)
Side-rail of seven modules (Resource, Demand, Dispatch, Economics, Payoff, Game solver,
Robust wrapper). Clicking any one expands its description, inputs, and outputs.

### Self-sufficiency (live simulation)
Three players: Municipality × PPC × Community. Nash bargaining preselected.
Banner notice suggests: apply "Self-sufficiency 2035" preset, then sweep "DH heat-pump
retrofit". The killer interaction: Sankey rebalances heat flows away from lignite
waste-heat, electricity demand grows in winter, PV+BESS expand to compensate, and the
self-sufficiency KPI dips then recovers.

### Export (live simulation)
Four players: PPC × IPTO × Offtaker × Greek State. Stackelberg preselected (State
leads). Banner notice suggests: apply "Export hub 2040" preset, then sweep
"Export tax" 0 → 20%. Killer interaction: capacity shrinks, cross-border flows thin,
PPC NPV drops, state tax revenue traces an inverted-U Laffer curve.

### Methods (static reference)
Documents every payoff function and assumption that the live simulation actually
computes. Seven blocks: §6 payoffs · §7 payoffs · pipeline · robust check · profiles
· hardcoded anchors · known gaps. The formulas in this document are also rendered
inside the Methods view in mono font.

---

## 5. Controls pane — every slider

Sliders are grouped into collapsible panels by **role**: Decisions (by actor), then
Uncertainties, then Preferences. Each row shows:

- **Lock chip** (○/●) — pin the slider's value to hold it constant during sweeps.
- **Label**
- **Value** in tabular-numbers mono font, with unit suffix.
- **Range bar** (native `<input type="range">`, restyled).
- **Clamp warning** — when a binding constraint is exceeded the row flashes warning
  colour and shows the constraint text (e.g. "↑ clamped by zoning ceiling 3 GW").

### Decisions · PPC / Developer

| Slider | Range | Step | Default | What it does |
|---|---|---|---|---|
| **PV capacity** | 0–6 GW | 0.25 | 0.3 | Scales hourly generation by the solar capacity-factor profile. Clamps when above zoning ceiling. |
| **Wind capacity** | 0–2 GW | 0.1 | 0.2 | Scales by the wind capacity-factor profile (~22–28% CF on regional ridges). |
| **BESS** | 0–3 GWh | 0.25 | 0.1 | Adds battery storage. Power rating P_cap = E_cap / 2 (C-rate 0.5). η_rt = 0.88. Greedy dispatch: charge on surplus, discharge on deficit. |
| **Electrolyser** | 0–2 GW | 0.1 | 0 | Soaks up curtailment to produce H₂. η = 0.7 MWh_H₂ per MWh_elec (LHV). Computes kt/yr and LCoH. |
| **Retained lignite (condenser conv.)** | 0–4 units | 1 | 2 | Each unit ≈ 660 MW of synchronous condenser (Ag.D-class). Provides **inertia** for frequency stability, not energy. Below 300 MW the system-health panel flashes red. |

### Decisions · Municipality / State

| Slider | Range | Step | Default | What it does |
|---|---|---|---|---|
| **DH heat-pump retrofit by 2035** | 0–100% | 10 | 0 | Fraction of district-heat demand electrified via heat pumps (COP = 3). Pulls electricity demand up in winter; reduces lignite waste-heat dependency. |
| **Zoning ceiling for PV** | 0–4 GW | 0.25 | 3.0 | Soft ceiling. PV slider flashes a clamp warning when exceeded but is not hard-limited. |
| **EV chargers** | 0–500 | 50 | 100 | Each charger ≈ 22 kW peak, 3 kW continuous average. Adds load. |
| **Export tax** (Export view only) | 0–20% | 1 | 0 | Reduces PPC's per-MWh export revenue and generates state tax revenue. Drives the Laffer curve. |
| **JTF share to export projects** (Export view only) | 0–100% | 10 | 30 | Allocates JTF subsidy to export infrastructure (informational; not yet in the cost line). |

### Decisions · IPTO / Grid

| Slider | Range | Step | Default | What it does |
|---|---|---|---|---|
| **Reinforcement budget** | €0–500 M | 25 | 150 | Adds 2 MW per €1 M to import/export caps, hard-capped at +500 MW. Loosens trade limits. |
| **Queue acceleration** | 0–24 months | 3 | 6 | Informational; no live wiring in this MVP. |
| **Flexibility procurement** | 0–500 MW | 50 | 100 | Informational; no live wiring in this MVP. |

### Decisions · Offtaker (Export view only)

| Slider | Range | Step | Default | What it does |
|---|---|---|---|---|
| **PPA volume** | 0–3 TWh/yr | 0.25 | 1.0 | Offtake commitment. Feeds Stackelberg follower utility. |
| **PPA duration** | 5–25 yr | 5 | 15 | Informational; affects Offtaker risk model in narrative. |
| **GO premium** | €0–15/MWh | 1 | 5 | Guarantee-of-Origin premium. Added to the per-MWh export sale price. |

### Uncertainties

| Slider | Values | Default | What it does |
|---|---|---|---|
| **Climate scenario** | RCP 2.6 / 4.5 / 8.5 | RCP 4.5 | Switches scenario multipliers: temperature offset, demand winter/summer factors, wind, solar. |
| **Climate horizon** | 2030 / 2040 / 2050 | 2040 | Amplifies the chosen RCP's deltas by `1 + (yr − 2040)/30`. 2050 = +33%, 2030 = −33%. |
| **Gas price** | low / central / high / shock | central | Multiplier (0.6 / 1.0 / 1.7 / 3.0) on fossil fuel cost. |
| **EU carbon price** | €60–250 /t | €85 /t | Overrides the default ETS price. Applied to residual lignite emissions. |
| **Demand growth by 2035** | −10% to +40% | 0% | Multiplies the demand profile. |
| **Tech cost trajectory** | low / central / high | central | Scales all renewable capex AND opex 0.75× / 1.0× / 1.25×. |
| **Interconnection delay** | 0–7 yr | 0 | Scales import/export caps by `max(0.3, 1 − delay/10)`. |
| **Wildfire frequency** | historical / +50% / +100% | historical | Informational only; no live wiring in this MVP. |

### Preferences

| Slider | Range | Step | Default | What it does |
|---|---|---|---|---|
| **Cost vs Emissions weight** | 0–1 | 0.05 | 0.5 | Preference weight (UI only in this MVP; will feed Pareto weighting in Phase 3). |
| **Jobs weight** | 0–1 | 0.05 | 0.3 | Preference weight. |
| **Local impact weight** | 0–1 | 0.05 | 0.3 | Preference weight. |
| **Export revenue weight** | 0–1 | 0.05 | 0.3 | Preference weight. |
| **Resilience weight** | 0–1 | 0.05 | 0.3 | Preference weight. |
| **Risk aversion (CVaR α)** | 0.50–0.99 | 0.01 | 0.7 | α used by the CVaR aggregator in the robust strip plot. |
| **Discount rate** | 2–10% | 0.5 | 5% | Feeds the capital-recovery factor `CRF(r, n) = r(1+r)ⁿ / ((1+r)ⁿ − 1)`. |

---

## 6. Visualisation pane — every tab

### Map (MapLibre GL JS · OSM tiles)
Layers, top-down:

| Layer | Style |
|---|---|
| Region boundary | Dashed teal outline, 4% teal fill. |
| Natura 2000 exclusion zones | Dark-green fill 16%, thin outline. |
| Mine extents | Brown fill 35%. Four simplified polygons: South Field, Kardia, Amyntaio, Ptolemaida pits. |
| District-heating trunks | Orange dashed lines from Kardia/Ag.D. to Kozani/Ptolemaida. |
| Interconnections | Dashed teal lines: GRITA→Italy, →Bulgaria, →N. Macedonia. |
| Substations | White circles with black stroke; 400 kV bigger than 150 kV. Clickable popup. |
| Settlements | Black dots; "city" type larger. With name labels. Clickable popup. |
| Plant points | Red = phase-out · Dark gray = operating · Light gray = retired. Sized to capacity_mw. Clickable popup. |
| **PV placement overlay** | Yellow circles at mine centroids. Size proportional to GW share allocated to that pit (split by reclaim_ha). |
| **BESS placement overlay** | Brown circles offset from 400 kV substations. Sized to GWh. |
| **Export flow arrow** (Export view only) | Teal dashed line along the GRITA corridor; **marching-ants animation** with line-dasharray cycled every 220 ms. Width scaled to export volume. |
| Legend (top-right) | Static swatch key. |

### Dispatch (Recharts ComposedChart)
Stacked area: PV (yellow) + Wind (blue) + Lignite (dark gray) + Storage discharge
(brown) + Imports (red). Demand line on top (black, solid). Curtailment line
(gray, dashed). Window selector: **worst winter week** (auto-found via highest daily
demand sum), **summer week**, **day**. Hover tooltip shows MW per series at that hour.
Two pills above the chart: demand peak MW · generation peak MW.

### Sankey (Recharts Sankey)
Sources → grid bus → sinks. Annual energy in GWh. 12 nodes:

```
PV ─┐
Wind┤
Lig.┤───► Grid bus ───► Electricity demand
Imp.┘                ├─► Heat (electrified) ─► Heat demand
                     ├─► Storage loss
                     ├─► Export
                     └─► Curtailment

Lignite waste-heat ─► Heat demand
```

Node colours follow the chart palette (PV yellow, Wind blue, Import red, Export teal,
Curtail gray, etc.). Header pills: generated GWh · import · export · curtail. Right-
side node labels anchor to the right so they don't clip the chart edge.

### Pareto (Recharts ComposedChart + LineChart)
Sweeps PV from 0 → 6 GW at 0.5 GW steps, holding every other slider at its current
value. Re-runs the full `outcomes()` simulation 13 times per slider change.

- **Top chart**: Cost (€M/yr) on x-axis, Emissions (ktCO₂/yr) on y-axis. Two series:
  PV-only and PV-with-BESS-scaled (0.3 GWh per GW PV). Current configuration shown
  as a larger filled dot.
- **Bottom chart**: Self-sufficiency on y-axis (0–1), PV on x-axis. Orange dashed
  reference line at 0.95.

### Game (closed-form best-response sweep)

**Self-sufficiency view — Nash bargaining.** Three players: Municipality, PPC,
Community. The solver sweeps a (PV × BESS × DH%) grid and picks
`argmax Π(uᵢ − dᵢ)` where d is the "Status quo" disagreement payoff. The card
shows the top six configurations + the equilibrium, highlighted teal.

**Export view — Stackelberg.** The solver sweeps export tax 0 → 20%; at each tax
value it sweeps the PPC follower's (PV × electrolyser) grid and picks PPC's
best response, then evaluates the leader's payoff. The card shows all 10 tax rows
+ a small **Recharts line chart** of the **inverted-U Laffer**: state tax revenue
peaks around 6% tax and collapses near 20%. Regulatory-risk premium on capex
`κ(t) = 1 + (t/20)²` makes PPC scale back PV at high tax.

---

## 7. KPI pane — every card

### Headline (2×2 grid)
- **Self-sufficiency** — % of demand met without imports. Cell turns warning-orange
  in Self-sufficiency view when below 0.95.
- **System cost** — annualised €/yr. Delta chip is "down is good".
- **Emissions** — tCO₂/yr. Delta chip is "down is good".
- **Jobs** — total employment from `jobs()`. Delta chip is "up is good".

Each KPI shows a large tabular-numbers value, a small label, and a coloured
delta chip showing change vs the pinned baseline (Status quo by default, or
whatever the "Set baseline" button was last called on).

### Annual energy (mini-bars)
- Demand TWh
- Generation total TWh — sub-line: renewable share % · lignite TWh
- Imports TWh
- Exports TWh
- Curtailment TWh

Each bar uses the chart palette colour for the flow.

### System health
- **Synchronous inertia MW** — green pill above floor, warning pill below 300 MW.
- **Local impact score** — 0/100 with a horizontal bar.
- **Capex annuity** — total annualised capex in €/yr.

### Export (only in Export view)
- State tax revenue €/yr
- Export revenue (PPC) €/yr
- H₂ production kt/yr (only when electrolyser > 0)
- LCoH €/kg (only when electrolyser > 0)

### Robust check · climate × gas ensemble (12 scenarios)

- **System cost range** with a strip plot. Each dot is one scenario; min and max
  are at the rail ends. Below the strip: mean cost · CVaR₉₀ (mean of the worst 10%
  by cost — Conditional Value-at-Risk).
- **Self-sufficiency distribution** — 12 bars, heights scaled to SS. Bars are
  teal (above target) or warning-orange (below 0.95). Hover for the scenario tag.

---

## 8. Presets

Selecting a preset triggers a 600 ms animated slider sweep with quadratic easing.
Numeric sliders interpolate; categorical sliders snap at the end.

| Preset | Highlights |
|---|---|
| **Status quo** | 0.3 GW PV · 0.2 GW Wind · 0.1 GWh BESS · 2 retained lignite units (with 1.2 GW residual lignite running half-load) · 0% DH retrofit. Sankey shows large lignite + import dependency. |
| **Self-sufficiency 2035** | 2.5 GW PV · 0.6 GW Wind · 1.25 GWh BESS · 0.2 GW electrolyser · 70% DH retrofit · zero residual lignite. Sankey closes; SS reaches ~100%. |
| **Export hub 2040** | 4.5 GW PV (above zoning ceiling — slider flashes clamp) · 1.4 GW Wind · 2.0 GWh BESS · 1.5 GW electrolyser · 5% export tax. Map shows the GRITA flow arrow at full thickness. |
| **Robust baseline** | 2.0 GW PV · 0.5 GW Wind · 1.0 GWh BESS · 0.3 GW electrolyser · 50% DH retrofit · 2% export tax · 100 MW residual lignite. The configuration that minimises CVaR₉₀ system cost across the ensemble. |

---

## 9. Simulation pipeline

All in `src/simulation/outcomes.js`. Pure functions, no side effects.
One full forward pass per slider change.

### `generation(state, profiles, climateMod) → { hourly_mw, capacities }`
```
horizon_shift = (climate_horizon − 2040) / 30
solar_mult    = 1 + (climateMod.solar_mult − 1) · (1 + horizon_shift)
wind_mult     = 1 + (climateMod.wind_mult  − 1) · (1 + horizon_shift)

gen[h] = PV_GW · 1000 · solar_cf[h] · solar_mult
       + Wind_GW · 1000 · wind_cf[h] · wind_mult
       + biomass_MW · 0.85
       + residual_lignite_MW · 0.55
```

### `demand(state, profiles, climateMod) → { hourly_mw }`
```
growth      = 1 + demand_growth_pct / 100
ev_load_mw  = ev_chargers · 0.003                     // continuous average
heat_elec   = heat_demand_mwth[h] · dh%/100 / COP     // COP = 3
clim_mult   = winter ? climateMod.demand_winter_mult : climateMod.demand_summer_mult

dem[h] = ((elec_demand_mw[h] + heat_elec) · clim_mult + ev_load_mw) · growth
```

### `storageDispatch(gen, dem, BESS_GWh, PHS_GWh) → { soc, flow_mw }`
```
E_cap = (BESS_GWh + PHS_GWh) · 1000          // MWh
P_cap = E_cap / 2                            // C-rate 0.5
η_rt  = 0.88                                 // round-trip
SOC₀  = 0.5 · E_cap

for h in 0..8760:
    net = gen[h] − dem[h]
    if net > 0:
        ch = min(net, P_cap, E_cap − SOC)
        SOC ← SOC + ch · √η_rt
        flow[h] = −ch                        // charging
    else:
        ds = min(−net, P_cap, SOC)
        SOC ← SOC − ds / √η_rt
        flow[h] = +ds                        // discharging
    soc[h] = SOC
```

### `balance(gen, dem, storFlow, importCap, exportCap) → { hourly_*, totals }`
Hours where demand exceeds (gen + storage + imports) are silently dropped in this
MVP — a LoLE / EENS metric is a Phase-3 follow-up.
```
exp_cap = (GRITA_500 + IPTO_reinforcement · 2 MW/€M)              // capped at +500
        · max(0.3, 1 − interconnection_delay_yr/10)
imp_cap = (GRITA + Bulgaria_600 + N.Macedonia_400 + reinforcement)
        · same delay factor

surplus[h] = gen[h] + stor[h] − dem[h]
if surplus[h] > 0:
    exp[h]  = min(surplus[h], exp_cap)
    curt[h] = surplus[h] − exp[h]
else:
    imp[h]  = min(−surplus[h], imp_cap)
```

### `economics(state, gen, bal, profiles) → { capex_annual_eur, opex_annual_eur, fuel_cost_eur, carbon_cost_eur, import_cost_eur, export_revenue_eur, system_cost_eur }`
```
m_tech = { low: 0.75, central: 1.0, high: 1.25 }[tech_cost_trajectory]
CRF(r, n) = r · (1+r)ⁿ / ((1+r)ⁿ − 1)

capex_annual = Σ tech.cap · IRENA_capex · m_tech · CRF(r, lifetime)
opex_annual  = Σ tech.cap · IRENA_capex · m_tech · opex_pct
fuel_cost    = lignite_MWh · 25 €/MWh · gas_price_mult
carbon_cost  = lignite_MWh · 1.10 tCO₂/MWh · EU_carbon_price

for h:
    import_cost  += imp[h] · price_GR[h]
    export_rev   += exp[h] · (price_IT[h] + GO_premium) · (1 − tax/100)

system_cost  = capex_annual + opex_annual + fuel_cost + carbon_cost
             + import_cost − export_rev
```

### `emissions(state, gen, bal) → { tco2_yr }`
```
tCO₂_yr = lignite_MWh · 1.10 (combustion)
        + imports_MWh · 0.35 (Greek-grid marginal-import factor)
```
Renewables, biomass, and electrolyser-fed H₂ are zero-emission in this MVP. Lifecycle
CO₂ (manufacturing, decommissioning) is a Phase-3 add.

### `jobs(state) → Number`
```
jobs = 4 500·PV_GW + 3 500·Wind_GW + 1 200·BESS_GWh
     + 1 800·electrolyser_GW + 1 500·biomass_GW
     + 350·retained_lignite_units
```
Coefficients are illustrative; replace with primary employment-multiplier data
before any planning use.

### `localImpactScore(state) → [0, 1]`
```
used      = PV_GW + 0.4 · Wind_GW
overshoot = max(0, used − zoning_cap) / zoning_cap
mine_reuse = min(1, PV_GW / 3.0)

score = 0.4 · (1 − overshoot) + 0.4 · mine_reuse + 0.2 · (dh%/100 · 0.3)
```

### `h2Production(state, gen, bal, profiles) → { kt_yr, util, lcoh_eur_kg }`
```
elec_in[h] = min(electrolyser_MW, curt[h])
H₂_MWh     = Σ elec_in · 0.7
kg_H₂      = H₂_MWh · 1000 / 33.3                 // 33.3 kWh/kg LHV

annual_cost = capex · CRF(0.05, 20) + capex · opex_pct + Σ elec_in · 30 €/MWh
LCoH        = annual_cost / kg_H₂
util        = Σ elec_in / (cap · 8760)
```
Only consumes curtailment. PPA-layered electrolyser revenue / direct-grid arbitrage
is a Phase-3 add.

### `inertia(state) → { synchronous_mw, below_floor }`
```
synchronous_mw = 660 · retained_lignite_units + biomass_MW + 100   // small hydro
below_floor    = synchronous_mw < 300
```
Below 300 MW the system-health card flashes a frequency-stability warning.

### `outcomes(state, profiles)`
Calls every function above and packages the result into one object: hourly arrays,
annual totals, economics, emissions, jobs, local impact, h2, inertia, export tax
revenue.

### `robustEnsemble(state, profiles, climates, gasPrices)`
Runs `outcomes()` once per (climate × gas) cross. Returns an array of
`{ climate, gas_price, system_cost_eur, self_sufficiency, emissions_tco2 }`. The KPI
panel calls it with 3 climates × 4 gas-price scenarios = 12 evaluations.

---

## 10. Payoff functions and game solvers

### Self-sufficiency · Nash bargaining
Three players. Disagreement payoff `d` = the "Status quo" preset's `outcomes()`.

```
u_muni = 0.5 · (jobs / 20 000) + 0.4 · local_impact − 0.1 · (system_cost €B/yr)
u_ppc  = (export_revenue − system_cost) / €B
u_comm = 0.5 · self_sufficiency + 0.4 · local_impact − 0.2 · (emissions / 5 Mt)
```

**Solver.** Sweep (PV × BESS × DH%) on a coarse grid (4 × 4 × 4 = 64 cells).
At each cell, compute `gains[i] = max(0.01, u_i − d_i)` and the Nash product
`Π gains[i]`. Equilibrium = argmax of the product. The Game tab shows the top
six configurations + the equilibrium row.

### Export · Stackelberg
State leads; followers play a closed-form Nash.

```
u_state = (export_tax_revenue / €B) + jobs / 80 000

κ(t)    = 1 + (t / 20)²                          // regulatory-risk capex premium
u_ppc(t)= (export_revenue
        − capex · κ(t) − opex
        − fuel − carbon) / €B

u_ipto  = min(1, exports_TWh / 5) − 0.1 · curtailment_TWh
u_off   = min(1, exports_TWh / 3)
```

**Solver.** For each tax `t ∈ {0, 2, 4, 6, 8, 10, 12, 15, 18, 20}`:
sweep PPC's (PV × electrolyser) grid (9 × 5 = 45 cells), pick PPC's best
response, then evaluate `u_state` at that configuration. Equilibrium = argmax of
`u_state` across tax values. This produces the inverted-U Laffer.

---

## 11. Robust-check ensemble

Re-runs `outcomes()` across 3 climates × 4 gas prices = 12 scenarios on every
slider change (~30 ms each, < 300 ms total). The KPI panel shows:

- **Strip plot** of the 12 system-cost values along a normalised rail.
- **Mean** annotated below the rail.
- **CVaR α = 0.9** — mean of the worst 10% (1–2 scenarios) of the cost distribution,
  i.e. "what's the average loss if things go badly". The risk-aversion slider feeds
  the same α downstream.
- **Self-sufficiency distribution** — 12 bars, heights scaled to SS, coloured red
  when below the 0.95 target.

---

## 12. Procedural hourly profiles

All 8 760-hour traces are generated at app mount with a seeded Mulberry32 RNG, so
reloads are bit-identical. Calibrated to public ranges; not from primary measurements.
Source: `src/data/profiles.js`.

| Profile | Form | Calibration target |
|---|---|---|
| Solar capacity factor | `seasonal(day) · diurnal(hour) · cloud(AR(1))` | Annual CF ≈ 0.19 (PVGIS-class for Kozani, 40.3°N) |
| Wind capacity factor | `seasonal(day) · (1 + 0.4 · AR₁(0.85)) · antiSolar(solar[h])` | Annual CF ≈ 0.25; weak anti-correlation with solar |
| Outdoor temperature | `13 − 12·cos((day−215)/365 · 2π) − 3·cos((hour−15)/24 · 2π) + AR₁(0.9, 1.2)` | Mean 13 °C, amplitude 12 °C, diurnal ~6 °C |
| Electricity demand | `(base · daily_shape · weekday_mult + 4·HDD + 6·CDD)` then rescaled | Peak ≈ 500 MW, annual ≈ 2.5 TWh |
| District heat demand | `8 · max(0, 18 − T[h]) + 5` | Peak ≈ 150 MWth, annual ≈ 400 GWh |
| Day-ahead price (GR) | `70 + 0.08 · max(0, residual_demand[h]) − 12·1{summer midday}` | Annual mean ≈ €100/MWh |
| Day-ahead price (IT) | `price_GR[h] + 15 + AR₁(0.7, 8)` | Long-run GR↔IT spread ≈ €15/MWh |

`AR₁(ϕ, σ)` is an AR(1) noise: `xₜ = ϕ·xₜ₋₁ + σ·N(0,1)`.

---

## 13. Hardcoded anchors and constants

Source: `src/data/constants.js`.

### Plants (Western Macedonia)

| Plant | Capacity | Status | Year |
|---|---:|---|---:|
| Agios Dimitrios | 1 587 MW | phase-out | 2028 |
| Ptolemaida V | 660 MW | operating | 2028 |
| Meliti | 330 MW | operating | 2028 |
| Kardia | 1 200 MW | retired | 2021 |
| Amyntaio | 600 MW | retired | 2020 |

### IRENA 2024 technology costs (€/kW unless noted)

| Tech | Capex | Opex %/yr | Lifetime |
|---|---:|---:|---:|
| PV | 900 | 1.5% | 25 |
| Wind | 1 300 | 2.0% | 25 |
| BESS (€/kWh) | 350 | 1.5% | 15 |
| Pumped hydro | 1 500 | 1.0% | 50 |
| Electrolyser | 1 500 | 2.5% | 20 |
| Heat pump | 800 | 1.5% | 20 |
| Biomass | 2 200 | 4.0% | 25 |
| Lignite→condenser conv. | 250 | 2.0% | 25 |

### Demand anchors
- Electricity: 2.5 TWh/yr · peak 500 MW
- Heat: 400 GWh/yr · peak 150 MWth

### Fuels and emissions
- Lignite: 1.10 tCO₂/MWh · €25/MWh fuel
- Gas: 0.40 tCO₂/MWh · €70/MWh fuel
- Biomass: 0.05 tCO₂/MWh · €35/MWh fuel
- EU ETS default: €85/tCO₂

### Funding
- JTF Western Macedonia 2021–2027: **€1.6 B**

### Interconnections
- GRITA → Italy: 500 MW
- Greece ↔ Bulgaria: 600 MW
- Greece ↔ N. Macedonia: 400 MW
- Long-run Italy day-ahead premium: ~€15/MWh

### Jobs intensities (illustrative)
PV 4 500/GW · Wind 3 500/GW · BESS 1 200/GWh · Biomass 1 500/GW ·
Electrolyser 1 800/GW · Retained lignite 350/unit.

### Climate scenarios

| | RCP 2.6 | RCP 4.5 | RCP 8.5 |
|---|---:|---:|---:|
| Temp offset | +0.8 °C | +1.5 °C | +3.0 °C |
| Wind mult | 1.00 | 0.98 | 0.94 |
| Solar mult | 1.00 | 1.01 | 1.02 |
| Demand winter | 0.95 | 0.92 | 0.85 |
| Demand summer | 1.05 | 1.12 | 1.30 |

### Gas price scenarios
low 0.6× · central 1.0× · high 1.7× · shock 3.0× (applied to lignite fuel cost).

---

## 14. Geography

Source: `src/data/geography.js`. All coordinates are `[lon, lat]` (GeoJSON
convention). Geometries are **illustrative**, hand-drawn polygons; not for spatial
analysis.

| Feature | Geometry |
|---|---|
| Region boundary | Single polygon, ~18 vertices, ringing Western Macedonia |
| Settlements (5) | Kozani, Ptolemaida, Amyntaio, Florina, Siatista (with `pop`) |
| Plants (5) | Points with `status` and `capacity_mw` |
| Mines (4) | Polygons with `reclaim_ha` (3 500 / 2 200 / 2 100 / 2 200) |
| Natura 2000 zones (2) | Vermio and Vourinos (illustrative) |
| Substations (6) | Points with `kv` (400 or 150) |
| DH network | Two LineString trunks |
| Interconnections (3) | LineStrings to Italy (GRITA), Bulgaria, N. Macedonia |

---

## 15. Visual design rules

| Rule | Why |
|---|---|
| Monochrome palette + `#0F766E` teal accent | Charts carry colour; UI should not compete |
| Inter throughout (font features `ss01`, `cv11`, `tnum`) | Professional, content-dense; tabular numerals everywhere |
| No decorative gradients, no drop shadows on cards | Tool is for analysis, not marketing |
| 2–3 significant figures for headline numbers | No false precision |
| Tabular-numbers font for every numeric readout | Aligns columns at a glance |
| KPI cards: number large, label small, delta chip | Standard dashboard pattern |
| Clamped sliders flash and show binding constraint | Pedagogically essential |
| 1 px recompute strip at the top of the visual pane | Reassures without distracting |
| Lucide-style icons sparingly | No decorative icons |

The chart palette is:
- PV `#D4A017`
- Wind `#1F6FB1`
- BESS / storage `#8B5A2B`
- Lignite `#44403C`
- Import `#B91C1C`
- Export `#0F766E`
- Curtailment `#A1A1AA`

---

## 16. File layout

```
index.html                         entry; loads React 18, Babel, Recharts, MapLibre from pinned CDNs
README.md                          this file

src/styles.css                     strict monochrome + #0F766E accent, all variables defined at top

src/data/constants.js              PLANTS, TECH_COSTS_2024, FUNDING, DEMAND_ANCHORS, INTERCONNECTIONS,
                                   FUELS, JOBS_PER_GW, SCENARIOS, PRESETS, DEFAULT_STATE, crf()

src/data/profiles.js               build() → { solar_cf, wind_cf, temperature_c, elec_demand_mw,
                                                heat_demand_mwth, price_gr_eur_mwh, price_it_eur_mwh,
                                                meta }; seeded Mulberry32 RNG + AR(1) helpers

src/data/geography.js              GeoJSON literals: region, settlements, plants, mines,
                                   natura2000, substations, district_heating, interconnections

src/simulation/outcomes.js         outcomes(state, profiles) and the 11 pure helpers it composes:
                                   generation, demand, storageDispatch, balance, economics,
                                   emissions, jobs, localImpactScore, h2Production, inertia,
                                   exportTaxRevenue, robustEnsemble

src/components/Controls.jsx        left pane: grouped sliders with lock / clamp / units
src/components/KpiPanel.jsx        right pane: KPI cards + mini-bars + regret strip
src/components/MapView.jsx         MapLibre wrapper; dynamic PV/BESS overlays; marching-ants export flow
src/components/DispatchView.jsx    Recharts stacked-area dispatch with window toggle
src/components/SankeyView.jsx      Recharts Sankey, annual flows in GWh
src/components/ParetoView.jsx      Recharts cost-vs-emissions sweep + SS vs PV
src/components/GameView.jsx        Nash bargaining + Stackelberg solvers + Laffer chart
src/components/Landing.jsx         Framework + Modules static landing pages
src/components/MethodsView.jsx     Methods reference page (formulas in mono font)
src/app.jsx                        three-pane shell, top bar, state orchestration, presets
```

---

## 17. What this MVP does not model

Called out explicitly so the demo doesn't oversell:

- No unit commitment, no nodal flow, no AC power flow — single-bus dispatch.
- No LoLE / EENS — hours where demand exceeds (gen + storage + imports) are silently
  dropped.
- No transmission losses on imports / exports.
- Wildfire-frequency slider has no live wiring — visual-only.
- IPTO queue-acceleration and flexibility-procurement sliders are informational —
  no live wiring beyond the reinforcement-budget capacity bump.
- Climate-horizon shift is a soft multiplier; no separate decade-specific scenario
  sets.
- Lifecycle CO₂ (manufacturing, decommissioning) is not in emissions; only marginal-
  import + lignite combustion.
- Behind-the-meter H₂ economics are LCoH-only; no PPA layering or grid-arbitrage on
  the electrolyser.
- PPA volume / duration / GO premium sliders feed Stackelberg utilities and economics,
  but no separate PPA-vs-spot revenue waterfall is shown.
- Local-impact score is a single composite — Phase 3 should disaggregate into
  landscape, employment and noise sub-scores.
- Preference weight sliders are not yet feeding a Pareto-weighted scalarisation
  (Phase 3).

---

## 18. Calibration sources

| Domain | Source / anchor |
|---|---|
| Solar resource (CF ≈ 0.19) | PVGIS-class value for Kozani at 40.3°N |
| Wind resource (CF ≈ 0.25) | Regional ridge estimates, Western Macedonia |
| Temperature (mean 13 °C, amplitude 12 °C) | EURO-CORDEX regional pattern |
| Electricity demand (~2.5 TWh/yr, peak ~500 MW) | ENTSO-E-style typical Greek pattern, regional share |
| District heat demand (~400 GWh/yr, peak ~150 MWth) | DEH heating reports for Kozani / Ptolemaida |
| Technology capex / lifetime | IRENA 2024 midpoints |
| Day-ahead price (mean €100/MWh) | EU power price averages, 2023–2024 |
| Italy price premium (~€15/MWh) | Greece–Italy day-ahead spread, long-run average |
| Carbon price (€85/t default) | EU ETS 2024 |
| JTF allocation (€1.6 B) | Just Transition Fund, Western Macedonia 2021–2027 |
| GRITA / interconnections | 500 MW Italy · 600 MW Bulgaria · 400 MW N. Macedonia |
| Plants | Agios Dimitrios 1 587 MW (phase-out 2028) · Ptolemaida V 660 MW · Meliti 330 MW · Kardia retired 2021 · Amyntaio retired 2020 |
| Mine reclamation areas | South Field, Kardia, Amyntaio, Ptolemaida pits — ~10 000 ha total (illustrative shapes) |
| Map tiles | © OpenStreetMap contributors |

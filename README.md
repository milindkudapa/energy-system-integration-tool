# Kozani · Energy System Integration Decision Tool

An interactive, browser-based decision-support tool for a research seminar on **ESI for Resilience** in post-lignite Kozani / Western Macedonia. A regional planner — composite of Municipality, PPC, IPTO, Greek state, foreign offtaker, and local community — must decide what energy assets to build, in what sequence, and how to operate them, under physical, economic, and political constraints and deep uncertainty about climate, prices, and geopolitics.

The tool exposes the trade-offs and shows how a robust, game-theoretic decision differs from a naïve cost-optimal one. All simulation runs live in the browser on every slider change.

---

## Run

No build step required. Open `index.html` directly or serve it:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

---

## What it does

### Sections

| Section | Type | Description |
|---|---|---|
| **Framework** | Static | Actor–strategy–payoff overview. Five-stage pipeline cards and an actor table listing strategy levers and payoff functions for all six stakeholders. |
| **Modules** | Static | Side-rail of seven computation modules. Click any to expand its description, inputs, and outputs. |
| **Self-sufficiency** | Live | Three players: Municipality × PPC × Community. Nash bargaining preselected. Killer interaction: sweep DH heat-pump retrofit — Sankey rebalances heat flows, electricity demand grows, PV+BESS expand to compensate. |
| **Export** | Live | Four players: PPC × IPTO × Offtaker × Greek State. Stackelberg preselected (State leads). Sweep export tax 0 → 20% to trace the inverted-U Laffer curve. |
| **Methods** | Static | Full reference: every payoff function and formula the live simulation computes. |

### Layout

```
┌──────────────────────────────────────────────────────────────┐
│  TOP BAR — brand · section tabs · preset · reset · baseline  │
├──────────────┬─────────────────────────────┬─────────────────┤
│              │  TABS — map · dispatch ·    │                 │
│  CONTROLS    │  sankey · pareto · game     │   KPI PANEL     │
│  (sliders)   │                             │  (cards +       │
│              │  PRIMARY VISUAL             │   mini-charts + │
│              │                             │   robust strip) │
└──────────────┴─────────────────────────────┴─────────────────┘
```

---

## Controls

Sliders are grouped into collapsible panels by role. Each slider has a **lock chip** to pin its value during sweeps and a **clamp warning** when a binding constraint is exceeded.

### Decisions · PPC / Developer
| Slider | Range | Default |
|---|---|---|
| PV capacity | 0–6 GW | 0.3 GW |
| Wind capacity | 0–2 GW | 0.2 GW |
| BESS | 0–3 GWh | 0.1 GWh |
| Electrolyser | 0–2 GW | 0 GW |
| Retained lignite (condenser conv.) | 0–4 units | 2 units |

### Decisions · Municipality / State
| Slider | Range | Default |
|---|---|---|
| DH heat-pump retrofit by 2035 | 0–100% | 0% |
| Zoning ceiling for PV | 0–4 GW | 3 GW |
| EV chargers | 0–500 | 100 |
| Export tax *(Export view only)* | 0–20% | 0% |
| JTF share to export projects *(Export view only)* | 0–100% | 30% |

### Decisions · IPTO / Grid
| Slider | Range | Default |
|---|---|---|
| Reinforcement budget | €0–500M | €150M |
| Queue acceleration | 0–24 months | 6 months |
| Flexibility procurement | 0–500 MW | 100 MW |

### Decisions · Offtaker *(Export view only)*
| Slider | Range | Default |
|---|---|---|
| PPA volume | 0–3 TWh/yr | 1 TWh/yr |
| PPA duration | 5–25 yr | 15 yr |
| GO premium | €0–15/MWh | €5/MWh |

### Uncertainties
Climate scenario (RCP 2.6 / 4.5 / 8.5), climate horizon (2030/2040/2050), gas price (low/central/high/shock), EU carbon price, demand growth, tech cost trajectory, interconnection delay, wildfire frequency.

### Preferences
Cost vs emissions weight, jobs weight, local impact weight, export revenue weight, resilience weight, risk aversion (CVaR α), discount rate.

---

## Visualisations

| Tab | Description |
|---|---|
| **Map** | MapLibre GL + OSM tiles. Layers: region boundary, Natura 2000 exclusions, mine extents, DH trunks, interconnections, substations, settlements, plants. PV/BESS placement overlays sized to slider values. Export view shows marching-ants flow arrow on the GRITA corridor. |
| **Dispatch** | Recharts stacked-area: PV + Wind + Lignite + Storage + Imports vs demand line. Toggle: worst winter week / summer week / day. |
| **Sankey** | Annual energy flow in GWh. Sources → grid bus → sinks, including electrified heat and lignite waste-heat path. |
| **Pareto** | Sweeps PV 0→6 GW. Top chart: cost vs emissions trade-off (two frontiers: PV-only and PV+BESS scaled). Bottom chart: self-sufficiency vs PV. |
| **Game** | Nash bargaining (self-suff) or Stackelberg (export). Shows top configurations + equilibrium row. Export view includes Laffer curve chart. |

---

## KPI Panel

- **Headline 2×2**: Self-sufficiency · System cost · Emissions · Jobs — each with a delta chip vs the pinned baseline.
- **Annual energy**: Demand · Generation (with renewable share) · Imports · Exports · Curtailment — mini bar charts.
- **System health**: Synchronous inertia (flashes warning below 300 MW floor) · Local impact score · Capex annuity.
- **Export** *(Export view)*: State tax revenue · Export revenue (PPC) · H₂ production · LCoH.
- **Robust check**: Strip plot of 12 system-cost outcomes (3 climates × 4 gas prices) with mean and CVaR₉₀. Self-sufficiency distribution with red bars below the 0.95 target.

---

## Presets

| Preset | Highlights |
|---|---|
| **Status quo** | 0.3 GW PV · 0.2 GW Wind · 0.1 GWh BESS · 2 retained lignite units · 0% DH retrofit |
| **Self-sufficiency 2035** | 2.5 GW PV · 0.6 GW Wind · 1.25 GWh BESS · 70% DH retrofit · zero residual lignite |
| **Export hub 2040** | 4.5 GW PV · 1.4 GW Wind · 2 GWh BESS · 1.5 GW electrolyser · 5% export tax |
| **Robust baseline** | 2.0 GW PV · 0.5 GW Wind · 1 GWh BESS · 50% DH retrofit · minimises CVaR₉₀ system cost |

Selecting a preset triggers an animated 600 ms quadratic-eased slider sweep.

---

## Simulation pipeline

All computation is in `src/simulation/outcomes.js`. Pure functions, one forward pass per slider change. Target: < 50 ms per outcome; < 300 ms for the 12-scenario robust ensemble.

| Step | Function | What it computes |
|---|---|---|
| 1 | `generation` | Hourly PV + wind + biomass + lignite output with climate multipliers |
| 2 | `demand` | Electricity + electrified heat (COP=3) + EV load with climate and growth factors |
| 3 | `storageDispatch` | Greedy SOC pass: charge on surplus, discharge on deficit. η_rt = 0.88, C-rate 0.5 |
| 4 | `balance` | Imports / exports / curtailment against IPTO-adjusted interconnection caps |
| 5 | `economics` | Annuitised IRENA 2024 capex + opex + fuel + carbon + trade revenues |
| 6 | `emissions` | Lignite combustion + marginal-import factor (0.35 tCO₂/MWh) |
| 7 | `jobs` | Linear employment multipliers per installed GW/GWh |
| 8 | `localImpactScore` | Zoning overshoot + mine reuse + DH bonus |
| 9 | `h2Production` | LCoH from curtailment-fed electrolyser |
| 10 | `inertia` | Synchronous MW from condenser conversions + biomass + small hydro |
| 11 | `robustEnsemble` | 3 climates × 4 gas prices = 12 full outcome runs |

---

## Game theory

### Self-sufficiency · Nash bargaining
Three players: Municipality, PPC, Community. Solver sweeps a (PV × BESS × DH%) grid (64 cells), picks the configuration that maximises the Nash product Π(uᵢ − dᵢ), where disagreement payoffs d = "Status quo" outcomes.

### Export · Stackelberg
State leads on export tax; PPC re-optimises (PV × electrolyser) at each tax value. The regulatory-risk capex premium κ(t) = 1 + (t/20)² causes PPC to scale back at high tax, producing the inverted-U Laffer curve.

---

## File structure

```
index.html                    Entry point — loads CDN libs + src files
src/
  styles.css                  Monochrome palette + #0F766E teal accent
  data/
    constants.js              Plants, tech costs, presets, DEFAULT_STATE, crf()
    profiles.js               Seeded procedural 8,760-hour hourly profiles
    geography.js              GeoJSON: region, mines, plants, substations, DH, interconnections
  simulation/
    outcomes.js               Full simulation pipeline + robustEnsemble
  components/
    Controls.jsx              Grouped sliders with lock / clamp / units
    KpiPanel.jsx              KPI cards, mini-bars, robust strip plot
    MapView.jsx               MapLibre wrapper with dynamic overlays
    DispatchView.jsx          Recharts stacked-area dispatch chart
    SankeyView.jsx            Recharts Sankey annual energy flow
    ParetoView.jsx            Cost–emissions frontier + SS vs PV
    GameView.jsx              Nash bargaining + Stackelberg + Laffer chart
    Landing.jsx               Framework + Modules static pages
    MethodsView.jsx           Methods reference (formulas in mono font)
  app.jsx                     Three-pane shell, top bar, state, preset animation
```

---

## Data sources and calibration

| Domain | Source |
|---|---|
| Solar resource (CF ≈ 0.19) | PVGIS-class value for Kozani at 40.3°N |
| Wind resource (CF ≈ 0.25) | Regional ridge estimates, Western Macedonia |
| Temperature (mean 13°C, amplitude 12°C) | EURO-CORDEX regional pattern |
| Electricity demand (~2.5 TWh/yr, peak ~500 MW) | ENTSO-E-style typical Greek pattern |
| District heat demand (~400 GWh/yr, peak ~150 MWth) | DEH heating reports for Kozani / Ptolemaida |
| Technology capex / lifetime | IRENA 2024 midpoints |
| Day-ahead price (mean €100/MWh) | EU power price averages 2023–2024 |
| Italy price premium (~€15/MWh) | Greece–Italy day-ahead spread, long-run average |
| Carbon price (€85/t default) | EU ETS 2024 |
| JTF allocation (€1.6B) | Just Transition Fund, Western Macedonia 2021–2027 |
| Interconnections | GRITA 500 MW · Bulgaria 600 MW · N. Macedonia 400 MW |
| Plants | Ag. Dimitrios 1,587 MW · Ptolemaida V 660 MW · Meliti 330 MW · Kardia retired 2021 · Amyntaio retired 2020 |
| Map tiles | © OpenStreetMap contributors |

Hourly profiles are generated procedurally with a seeded RNG — they reflect realistic shapes but are not from primary measurements. Geographic geometries are simplified illustrative polygons, not for spatial analysis.

---

## Known limitations (MVP)

- Single-bus dispatch — no unit commitment, no nodal or AC power flow.
- No LoLE / EENS — hours where demand exceeds supply are silently dropped.
- No transmission losses on imports / exports.
- Wildfire-frequency slider is informational — no live wiring.
- Lifecycle CO₂ (manufacturing, decommissioning) not included.
- Preference weight sliders are not yet feeding a Pareto-weighted scalarisation.

// Section 8 — Methods, payoff functions, assumptions
// Single-page reference doc for what the live simulation actually computes.
// No new state, no controls; pure read.

function MethodsView() {
  return (
    <div className="landing" style={{ maxWidth: 1080, paddingBottom: 80 }}>
      <div className="kicker">Methods</div>
      <h1>Payoff functions, simulation algebra, assumptions</h1>
      <p>
        Every formula here is what the live JS simulation actually computes — these
        are not stylised descriptions. Click any control in the Self-sufficiency or Export view
        to see them re-evaluate in real time.
      </p>

      <MethodBlock title="Payoff functions — Self-sufficiency · Nash bargaining"
                   subtitle="Three players. Solver: argmax of the Nash product Π(uᵢ − dᵢ) over a (PV × BESS × DH%) sweep, with the disagreement payoff d = ‘Status quo’ preset.">
        <FormulaTable rows={[
          ["Municipality",
            "u_muni = 0.5 · (jobs / 20 000) + 0.4 · local_impact − 0.1 · (system_cost €B/yr)",
            "Rewards employment and local-impact score; penalises bills."],
          ["PPC / developer",
            "u_ppc  = (export_revenue − system_cost) / €B",
            "Negative system cost is the developer's NPV proxy; export sales add to it."],
          ["Community",
            "u_comm = 0.5 · self_sufficiency + 0.4 · local_impact − 0.2 · (emissions / 5 Mt)",
            "Self-sufficiency and clean-air weighted equally; mine-reuse rolled into local_impact."],
        ]} />
      </MethodBlock>

      <MethodBlock title="Payoff functions — Export · Stackelberg"
                   subtitle="State leads on export tax; followers play a closed-form Nash. For each tax value t the solver sweeps PPC's (PV × electrolyser) grid and picks the leader's argmax of u_state.">
        <FormulaTable rows={[
          ["State (leader)",
            "u_state = (export_tax_revenue / €B) + jobs / 80 000",
            "Tax-revenue dominant; jobs are a smaller weight."],
          ["PPC (follower)",
            "u_ppc(t)  = (export_revenue − capex·κ(t) − opex − fuel − carbon) / €B,  κ(t) = 1 + (t/20)²",
            "Regulatory-risk premium κ(t) scales capex 1× → 2× as tax goes 0% → 20%. This is what produces the Laffer peak."],
          ["IPTO (follower)",
            "u_ipto  = min(1, exports_TWh / 5) − 0.1 · curtailment_TWh",
            "Rewards delivered exports up to a saturation; penalises wasted MWh."],
          ["Offtaker (follower)",
            "u_off   = min(1, exports_TWh / 3)",
            "Proxy for available PPA depth at any volume up to ~3 TWh/yr."],
        ]} />
      </MethodBlock>

      <MethodBlock title="Simulation pipeline — closed-form, one forward pass">
        <ModuleRow
          name="generation(state, profiles, climate)"
          formula="gen[h] = PV_GW · 1000 · solar_cf[h] · m_solar(climate) + Wind_GW · 1000 · wind_cf[h] · m_wind(climate) + biomass_MW · 0.85 + residual_lignite_MW · 0.55"
          notes={[
            "Condenser conversions add inertia, not energy.",
            "Climate horizon (2030/2040/2050) amplifies climate multipliers by (1 + (yr−2040)/30).",
          ]}
        />
        <ModuleRow
          name="demand(state, profiles, climate)"
          formula="dem[h] = ((elec_demand[h] + heat_demand[h] · dh%/COP) · climate_mult + ev_chargers · 0.003 MW) · (1 + growth%)"
          notes={[
            "COP = 3 (seasonal heat-pump average).",
            "Climate winter / summer multipliers differ; warmer scenarios add cooling, reduce heating.",
            "Each EV charger ≈ 22 kW peak / ~3 kW avg.",
          ]}
        />
        <ModuleRow
          name="storageDispatch(gen, dem, BESS_GWh + PHS_GWh)"
          formula="net[h] = gen[h] − dem[h];  if net>0 then charge min(net, P_cap, E_cap − SOC) · √η;  else discharge min(−net, P_cap, SOC) / √η"
          notes={[
            "P_cap = E_cap / 2 (C-rate 0.5).",
            "η_rt = 0.88 (round-trip).",
            "Initial SOC = 50%. Greedy, no foresight.",
          ]}
        />
        <ModuleRow
          name="balance(gen, dem, stor, caps)"
          formula="surplus[h] = gen[h] + stor[h] − dem[h];  exp[h] = min(surplus, exp_cap);  curt[h] = surplus − exp[h];  imp[h] = max(0, −surplus) capped at imp_cap"
          notes={[
            "exp_cap = GRITA 500 MW + IPTO reinforcement (2 MW per €1M, +500 MW cap), scaled by (1 − delay_yr/10).",
            "imp_cap adds Bulgaria 600 MW + N. Macedonia 400 MW on top.",
            "Hours where demand exceeds (gen + stor + imp_cap) are silently dropped in the MVP — a LoLE metric is a Phase-3 follow-up.",
          ]}
        />
        <ModuleRow
          name="economics(state, gen, bal, profiles)"
          formula="annual_cost = Σᵢ capex_i · CRF(r, n_i) · m_tech + Σᵢ capex_i · opex%_i + fuel_lignite + carbon · price_CO₂ + Σₕ imp[h] · price_GR[h] − Σₕ exp[h] · (price_IT[h] + GO_premium) · (1 − tax/100)"
          notes={[
            "CRF(r, n) = r(1+r)ⁿ / ((1+r)ⁿ − 1).",
            "Tech cost trajectory: low 0.75× / central 1.0× / high 1.25× applied to capex AND opex.",
            "Discount rate slider drives r.",
          ]}
        />
        <ModuleRow
          name="emissions(state, gen, bal)"
          formula="tCO₂_yr = lignite_MWh · 1.10 + imports_MWh · 0.35"
          notes={[
            "1.10 tCO₂/MWh = lignite plant typical emission factor.",
            "0.35 tCO₂/MWh = Greek-grid marginal-import factor.",
            "Renewables, biomass, and electrolyser-fed H₂ contribute zero in this MVP (lifecycle CO₂ is a Phase-3 add).",
          ]}
        />
        <ModuleRow
          name="jobs(state)"
          formula="jobs = 4 500·PV_GW + 3 500·Wind_GW + 1 200·BESS_GWh + 1 800·H₂_GW + 1 500·biomass_GW + 350·retained_lignite_units"
          notes={[
            "Coefficients are illustrative jobs-per-GW intensities; replace with primary employment-multiplier data before any planning use.",
          ]}
        />
        <ModuleRow
          name="localImpactScore(state)"
          formula="score = 0.4 · (1 − overshoot) + 0.4 · mine_reuse + 0.2 · (dh%/100 · 0.3); clamped to [0, 1]"
          notes={[
            "overshoot = max(0, used − zoning_cap) / zoning_cap; used = PV + 0.4·Wind.",
            "mine_reuse = min(1, PV_GW / 3) — PV is presumed to deploy onto mine land first.",
            "DH bonus rewards heat-pump retrofit (community heat-quality signal).",
          ]}
        />
        <ModuleRow
          name="h2Production(electrolyser_GW, surplus, η=0.7)"
          formula="elec_in[h] = min(electrolyser_MW, curtailment[h]);  H₂_MWh = Σ elec_in · η;  LCoH = (capex·CRF + capex·opex% + Σ elec_in · 30 €/MWh) / kg_H₂"
          notes={[
            "33.3 kWh/kg LHV for the kg conversion.",
            "Electricity cost taken at €30/MWh — surplus-price proxy.",
            "Only soaks up curtailment; behind-the-meter / direct-grid arbitrage is a Phase-3 add.",
          ]}
        />
        <ModuleRow
          name="inertia(state)"
          formula="synchronous_MW = 660 · retained_lignite_units + biomass_MW + 100 MW (small hydro)"
          notes={[
            "Floor = 300 MW. Below it the panel flashes a frequency-stability warning.",
            "Condenser conversions are the cheap, plausible way to keep that floor after fossil retirement.",
          ]}
        />
      </MethodBlock>

      <MethodBlock title="Robust-check ensemble"
                   subtitle="Same configuration evaluated across 3 climates × 4 gas-price scenarios = 12 runs, each <30 ms. Shown in the right rail as a strip plot.">
        <FormulaTable rows={[
          ["Mean", "mean_cost = (1/N) Σ cost_s", "Plain arithmetic mean across scenarios."],
          ["CVaR α=0.9", "CVaR = mean of worst 10% of scenarios by system cost",
            "Conditional Value-at-Risk — the average outcome conditional on being in the worst tail. The risk-aversion slider feeds the same α downstream."],
          ["Self-sufficiency target", "1{SS ≥ 0.95}", "Bars below 0.95 turn warning-orange."],
        ]} />
      </MethodBlock>

      <MethodBlock title="Procedural hourly profiles · what they actually are"
                   subtitle="All 8 760-hour traces are generated at app mount with a seeded Mulberry32 RNG, so reloads are bit-identical. Calibrated to public ranges, not from primary measurements.">
        <ProfileRow name="Solar capacity factor"
                    form="solar[h] = seasonal(day) · diurnal(hour) · cloud(AR(1))"
                    target="annual CF ≈ 0.19 (PVGIS-class for Kozani, 40.3°N)" />
        <ProfileRow name="Wind capacity factor"
                    form="wind[h] = seasonal(day) · (1 + 0.4·AR₁(0.85)) · antiSolar(solar[h])"
                    target="annual CF ≈ 0.25, weak anti-correlation with solar" />
        <ProfileRow name="Outdoor temperature"
                    form="T[h] = 13 − 12·cos((day−215)/365 · 2π) − 3·cos((hour−15)/24 · 2π) + AR₁(0.9, 1.2)"
                    target="mean 13 °C, amplitude 12 °C, diurnal ~6 °C, EURO-CORDEX pattern" />
        <ProfileRow name="Electricity demand"
                    form="dem[h] = (base·daily_shape · weekday_mult + 4·HDD + 6·CDD) → rescaled"
                    target="peak ≈ 500 MW, annual ≈ 2.5 TWh" />
        <ProfileRow name="District heat demand"
                    form="heat[h] = 8 · max(0, 18 − T[h]) + 5 (base)"
                    target="peak ≈ 150 MWth, annual ≈ 400 GWh" />
        <ProfileRow name="Day-ahead price (GR)"
                    form="p_GR[h] = 70 + 0.08 · max(0, residual_demand[h]) − 12·1{summer midday}"
                    target="annual mean ≈ €100/MWh, scarcity-premium structure" />
        <ProfileRow name="Day-ahead price (IT)"
                    form="p_IT[h] = p_GR[h] + 15 + AR₁(0.7, 8)"
                    target="long-run GR ↔ IT spread ≈ €15/MWh" />
      </MethodBlock>

      <MethodBlock title="Hardcoded anchors — Western Macedonia"
                   subtitle="Public-domain values used as constants throughout. See the Data modal in the topbar for sources.">
        <FormulaTable rows={[
          ["Plants",
            "Ag. Dimitrios 1 587 MW · Ptolemaida V 660 MW · Meliti 330 MW · Kardia 1 200 MW (retired 2021) · Amyntaio 600 MW (retired 2020)",
            "Phase-out target 2028 for the operating set."],
          ["Reclaimable mine area",
            "≈ 10 000 ha across South Field, Kardia, Amyntaio, Ptolemaida pits",
            "PV siting overlay distributes capacity by pit area share."],
          ["District heating",
            "~150 MWth, ~400 GWh/yr, lignite waste-heat today",
            "Serves Kozani + Ptolemaida; heat-pump retrofit slider rewires it."],
          ["Grid",
            "400 kV and 150 kV substations co-located with retired lignite units",
            "BESS overlay sites on the 400 kV nodes."],
          ["JTF allocation",
            "€1.6 B for Western Macedonia, 2021–2027",
            "Shown as a budget constraint; allocation slider routes share to export projects (§7)."],
          ["Interconnections",
            "GRITA → Italy 500 MW · Bulgaria 600 MW · N. Macedonia 400 MW",
            "Italy is the only modelled export route in this build."],
          ["Italy premium",
            "≈ €15/MWh over Greek day-ahead, long run",
            "Added to GR price hour-by-hour with stochastic noise."],
          ["IRENA 2024 capex",
            "PV €900/kW · Wind €1 300/kW · BESS €350/kWh · Electrolyser €1 500/kW · Biomass €2 200/kW · Condenser conv. €250/kW · Heat pump €800/kW",
            "Tech-cost-trajectory slider scales these 0.75× / 1.0× / 1.25×."],
          ["EU ETS default",
            "€85/tCO₂",
            "Carbon-price slider overrides; affects fuel + carbon line in system cost."],
        ]} />
      </MethodBlock>

      <MethodBlock title="Things this MVP does NOT model — known gaps"
                   subtitle="Calling these out explicitly so the demo doesn't oversell.">
        <ul style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.65, paddingLeft: 18, margin: 0 }}>
          <li>No unit-commitment, no nodal flow, no AC power flow — single-bus dispatch.</li>
          <li>No LoLE / EENS — hours where demand exceeds (gen + storage + imports) are silently dropped.</li>
          <li>No transmission losses on imports / exports.</li>
          <li>Wildfire-frequency slider has no live wiring yet — visual-only.</li>
          <li>Climate-horizon shift is a soft multiplier; no separate decade-specific scenario sets.</li>
          <li>Lifecycle CO₂ (manufacturing, decommissioning) is not in emissions; only marginal-import + lignite combustion.</li>
          <li>Behind-the-meter H₂ economics are LCoH-only; no PPA layering or grid-arbitrage on the electrolyser.</li>
          <li>PPA volume / duration / GO premium sliders feed Stackelberg utilities and economics, but no separate PPA-vs-spot revenue waterfall is shown.</li>
          <li>Local-impact score is a single composite — Phase 3 should disaggregate into landscape, employment, and noise sub-scores.</li>
        </ul>
      </MethodBlock>
    </div>
  );
}

// ----- presentational primitives --------------------------------------------

function MethodBlock({ title, subtitle, children }) {
  return (
    <section style={{
      marginTop: 28, background: "var(--surface)", border: "1px solid var(--line)",
      borderRadius: 4, overflow: "hidden",
    }}>
      <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: -0.01 }}>{title}</div>
        {subtitle ? (
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, maxWidth: 820, lineHeight: 1.5 }}>
            {subtitle}
          </div>
        ) : null}
      </div>
      <div style={{ padding: "6px 0" }}>{children}</div>
    </section>
  );
}

function FormulaTable({ rows }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} style={{ borderBottom: i < rows.length - 1 ? "1px solid var(--line)" : "0" }}>
            <td style={{
              width: 170, padding: "10px 18px", verticalAlign: "top",
              fontSize: 12, fontWeight: 500, color: "var(--ink)",
            }}>{r[0]}</td>
            <td style={{
              padding: "10px 14px", verticalAlign: "top",
              fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--accent-2)",
              lineHeight: 1.55, wordBreak: "break-word",
            }}>{r[1]}</td>
            <td style={{
              width: "32%", padding: "10px 18px 10px 14px", verticalAlign: "top",
              fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5,
            }}>{r[2]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ModuleRow({ name, formula, notes }) {
  return (
    <div style={{
      padding: "12px 18px", borderBottom: "1px solid var(--line)",
    }}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--ink)", fontWeight: 600 }}>{name}</div>
      <div style={{
        marginTop: 6, padding: "6px 8px", background: "var(--bg)",
        fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--accent-2)",
        lineHeight: 1.55, borderRadius: 3, wordBreak: "break-word",
      }}>{formula}</div>
      {notes && notes.length ? (
        <ul style={{ margin: "8px 0 0 0", paddingLeft: 18,
                     fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5 }}>
          {notes.map((n, i) => <li key={i}>{n}</li>)}
        </ul>
      ) : null}
    </div>
  );
}
ModuleRow.defaultProps = { notes: [] };

function ProfileRow({ name, form, target }) {
  return (
    <div style={{
      padding: "10px 18px", borderBottom: "1px solid var(--line)",
      display: "grid", gridTemplateColumns: "160px 1fr 200px", gap: 16, alignItems: "start",
    }}>
      <div style={{ fontSize: 12, fontWeight: 500 }}>{name}</div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 11.5,
                    color: "var(--accent-2)", lineHeight: 1.55, wordBreak: "break-word" }}>{form}</div>
      <div style={{ fontSize: 11.5, color: "var(--muted)", lineHeight: 1.5 }}>{target}</div>
    </div>
  );
}

// Last block doesn't need its trailing border-bottom — strip via CSS on parent
// (handled by the surrounding card border).

window.MethodsView = MethodsView;

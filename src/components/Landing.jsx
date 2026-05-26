// Section 4 (Framework) + Section 5 (Modules) landing pages.

function FrameworkLanding({ onBegin }) {
  return (
    <div className="landing">
      <div className="kicker">Decision-support framework</div>
      <h1>Energy System Integration for Resilience</h1>
      <p>
        A regional planner — composite of Municipality, PPC, IPTO, Greek state, foreign offtaker,
        and local community — must decide what to build in post-lignite Kozani,
        in what sequence, and how to operate it. The framework below makes
        a multi-vector, multi-stakeholder, deeply-uncertain planning problem manipulable
        in real time. Every slider feeds a closed-form simulation that re-runs in the browser
        within ~50 ms.
      </p>

      <div className="stage-grid">
        <div className="stage"><div className="step">01</div><div className="name">Resource</div><div className="desc">Hourly solar / wind / temperature from procedural generators calibrated to PVGIS &amp; EURO-CORDEX ranges.</div></div>
        <div className="stage"><div className="step">02</div><div className="name">Demand</div><div className="desc">ENTSO-E-style electricity + degree-day district heat. Electrification adds load via COP=3 heat pumps.</div></div>
        <div className="stage"><div className="step">03</div><div className="name">Dispatch</div><div className="desc">Greedy storage SOC, then balance against import / export / curtailment.</div></div>
        <div className="stage"><div className="step">04</div><div className="name">Economics</div><div className="desc">Annuitised IRENA 2024 capex + opex + fuel + carbon ± trade.</div></div>
        <div className="stage"><div className="step">05</div><div className="name">Game · Robust</div><div className="desc">Nash bargaining or Stackelberg; sweep across climate × gas-price ensembles.</div></div>
      </div>

      <div className="actor-table">
        <table>
          <thead>
            <tr><th>Actor</th><th>Strategy levers</th><th>Payoff function</th></tr>
          </thead>
          <tbody>
            <tr><td className="actor">Municipality</td><td>Zoning, DH retrofit, EVs, social licence</td><td>Jobs, local impact, energy bills</td></tr>
            <tr><td className="actor">PPC / developer</td><td>PV, wind, BESS, electrolyser, biomass, condensers</td><td>NPV at market or PPA prices</td></tr>
            <tr><td className="actor">IPTO / grid</td><td>Reinforcement, queue, flex procurement</td><td>RAB return; congestion costs</td></tr>
            <tr><td className="actor">Greek state</td><td>Export tax, JTF allocation, GO stringency</td><td>Tax revenue + jobs + transition pace</td></tr>
            <tr><td className="actor">Offtaker</td><td>PPA volume, duration, GO premium</td><td>Delivered-cost vs alternatives</td></tr>
            <tr><td className="actor">Community</td><td>Coalition with municipality; veto via inertia / Natura 2000</td><td>Bills, impact, jobs</td></tr>
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 24 }}>
        <button className="btn primary" onClick={onBegin}>Begin demo →</button>
      </div>
    </div>
  );
}

function ModulesLanding({ onBegin }) {
  const [active, setActive] = React.useState(0);
  const modules = [
    { name: "Resource", desc: "8,760-hour procedural profiles. Solar CF ≈ 0.19 at 40.3°N; wind CF ≈ 0.25; AR(1) cloud/persistence noise; temperature with diurnal + seasonal + AR(1).",
      io: { in: "Latitude, climate scenario, seed", out: "solar_cf[h], wind_cf[h], temperature[h]" } },
    { name: "Demand", desc: "Electricity: double daily peak + weekly + degree-day. District heat: max(0, 18−T)×slope + base, calibrated to 400 GWh/yr. Heat-pump retrofit converts heat MWh to electricity MWh / COP.",
      io: { in: "Base profile, dh_pct, climate adjustments", out: "elec_demand_mw[h], heat_demand_mwth[h]" } },
    { name: "Dispatch", desc: "Greedy charge-when-surplus, discharge-when-deficit (η_rt = 0.88). Net flow is matched against import / export caps; remainder is curtailment.",
      io: { in: "gen[h], dem[h], bess_gwh, phs_gwh", out: "soc[h], flow[h], imp[h], exp[h], curt[h]" } },
    { name: "Economics", desc: "Per-tech CRF × IRENA capex + fixed opex + fuel × gas-price-mult + carbon × EU ETS + Σ price[h] × import[h] − Σ price_IT[h] × export[h] × (1 − tax).",
      io: { in: "All decisions + prices[h]", out: "system_cost_eur, capex_annual, fuel_cost, export_revenue" } },
    { name: "Payoff", desc: "Maps outcomes to each actor's utility. Cost / emissions / jobs / local-impact / export-revenue / resilience weights normalise to one preference index per actor.",
      io: { in: "outcomes, preference weights", out: "u_actor (one scalar per actor)" } },
    { name: "Game solver", desc: "Nash bargaining (Section 6, three players): sweep configurations, pick argmax of Π(u_i − d_i). Stackelberg (Section 7): grid leader policy, closed-form follower Nash.",
      io: { in: "Player utilities, disagreement payoffs", out: "Equilibrium configuration" } },
    { name: "Robust wrapper", desc: "Evaluate equilibrium across 4–10 scenarios (climate × gas × cost trajectory). Return distribution of cost / emissions / SS; worst-case regret; CVaR_α.",
      io: { in: "Equilibrium config, scenario set", out: "regret[s], CVaR cost, distribution" } },
  ];

  return (
    <div className="landing">
      <div className="kicker">Modules</div>
      <h1>Computation stack</h1>
      <p>Each module is ~20–40 lines of JS. The whole stack runs at every slider change.</p>

      <div style={{
        display: "grid", gridTemplateColumns: "240px 1fr", gap: 16,
        marginTop: 24, alignItems: "stretch",
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 1, background: "var(--line)", border: "1px solid var(--line)" }}>
          {modules.map((m, i) => (
            <button key={m.name}
              onClick={() => setActive(i)}
              style={{
                textAlign: "left", padding: "10px 12px", border: 0, fontFamily: "inherit",
                background: i === active ? "var(--accent-bg)" : "var(--surface)",
                color: i === active ? "var(--accent-2)" : "var(--ink)",
                fontSize: 12.5, fontWeight: i === active ? 600 : 500, cursor: "pointer",
                borderLeft: i === active ? "3px solid var(--accent)" : "3px solid transparent",
              }}>
              <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 600, letterSpacing: 0.4 }}>{String(i + 1).padStart(2, "0")}</div>
              {m.name}
            </button>
          ))}
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: 18 }}>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>{modules[active].name}</div>
          <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.6 }}>{modules[active].desc}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 16 }}>
            <div>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.05, color: "var(--muted)", fontWeight: 600 }}>Inputs</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, marginTop: 4, color: "var(--ink-2)" }}>{modules[active].io.in}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: 0.05, color: "var(--muted)", fontWeight: 600 }}>Outputs</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, marginTop: 4, color: "var(--ink-2)" }}>{modules[active].io.out}</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <button className="btn primary" onClick={onBegin}>To self-sufficiency →</button>
      </div>
    </div>
  );
}

window.FrameworkLanding = FrameworkLanding;
window.ModulesLanding = ModulesLanding;

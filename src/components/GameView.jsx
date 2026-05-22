// GameView — Nash bargaining (Section 6) or Stackelberg (Section 7).
// Closed-form sweep, computed on demand.

const { useMemo: _useMemoG } = React;

function GameView({ section, state, profiles, baseline }) {
  const sim = window.KOZANI.simulation;
  const result = _useMemoG(() => {
    if (!profiles) return null;
    if (section === "self-suff") return nashBargaining(state, profiles, sim);
    if (section === "export")    return stackelberg(state, profiles, sim);
    return null;
  }, [section, state.pv_gw, state.wind_gw, state.bess_gwh, state.dh_heat_pump_pct,
      state.electrolyser_gw, state.export_tax_pct, state.climate, state.gas_price,
      state.retained_lignite_units]);

  if (!result) return <div style={{ padding: 16 }}>Select Section 6 or 7 to view game.</div>;

  return (
    <div className="game-grid">
      <div className="game-card">
        <h3>{result.title}</h3>
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginBottom: 8 }}>{result.subtitle}</div>
        <table className="payoff-table">
          <thead>
            <tr>
              <th>Configuration</th>
              {result.players.map((p) => <th key={p}>{p}</th>)}
              <th>{result.objectiveName}</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((r, i) => (
              <tr key={i} className={r.isEquilibrium ? "equilibrium" : ""}>
                <td>{r.label}</td>
                {r.utilities.map((u, j) => <td key={j} className="num">{u.toFixed(2)}</td>)}
                <td className="num">{r.objective.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="game-card">
        <h3>Equilibrium</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {Object.entries(result.equilibrium.config).map(([k, v]) => (
            <div key={k} style={{ fontSize: 12 }}>
              <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 0.05 }}>{k}</div>
              <div className="num" style={{ fontWeight: 500 }}>{typeof v === "number" ? v.toFixed(2) : v}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, fontSize: 11.5, color: "var(--ink-2)" }}>
          {result.equilibrium.explanation}
        </div>
        {result.leaderSweep ? (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase",
                          letterSpacing: 0.05, marginBottom: 4 }}>
              Tax revenue vs export tax · inverted-U Laffer
            </div>
            <div style={{ height: 140 }}>
              <Recharts.ResponsiveContainer width="100%" height="100%">
                <Recharts.LineChart data={result.leaderSweep}
                                    margin={{ top: 6, right: 10, left: 0, bottom: 14 }}>
                  <Recharts.CartesianGrid strokeDasharray="2 4" stroke="#E5E5E2" vertical={false} />
                  <Recharts.XAxis dataKey="tax" tick={{ fontSize: 10, fill: "#71717A" }}
                                  stroke="#D4D4D1" label={{ value: "tax %", position: "insideBottom",
                                                            offset: -4, fontSize: 10, fill: "#71717A" }} />
                  <Recharts.YAxis tick={{ fontSize: 10, fill: "#71717A" }} stroke="#D4D4D1" width={42}
                                  label={{ value: "€M/yr", angle: -90, position: "insideLeft",
                                           fontSize: 10, fill: "#71717A" }} />
                  <Recharts.Tooltip formatter={(v) => v.toFixed(1) + " €M/yr"}
                                    labelFormatter={(l) => "tax " + l + "%"}
                                    contentStyle={{ fontSize: 11, padding: "4px 8px" }} />
                  <Recharts.Line type="monotone" dataKey="revenue_meur" stroke="#0F766E"
                                 strokeWidth={1.6} dot={{ r: 2.5, fill: "#0F766E" }} isAnimationActive={false} />
                </Recharts.LineChart>
              </Recharts.ResponsiveContainer>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ---------- Nash bargaining (Section 6) -------------------------------------
function nashBargaining(state, profiles, sim) {
  // Three players: Municipality, PPC, Community.
  // Sweep a coarse grid over PV (1..4 GW), BESS (0.25..2 GWh), DH retrofit (0..100).
  // Disagreement payoffs = current "Status quo" outcome.
  const pvVals = [1.0, 2.0, 3.0, 4.0];
  const bessVals = [0.25, 0.75, 1.25, 2.0];
  const dhVals = [0, 40, 70, 100];

  // Disagreement (no-deal) = Status quo preset
  const dCfg = window.KOZANI.constants.PRESETS["Status quo"];
  const d = sim.outcomes({ ...state, ...dCfg }, profiles);
  const dU = utilSection6(d);

  let rows = [];
  let best = null;
  for (const pv of pvVals) for (const bess of bessVals) for (const dh of dhVals) {
    const s2 = { ...state, pv_gw: pv, bess_gwh: bess, dh_heat_pump_pct: dh };
    const o = sim.outcomes(s2, profiles);
    const u = utilSection6(o);
    const gains = u.map((ui, i) => Math.max(0.01, ui - dU[i]));
    const nash = gains[0] * gains[1] * gains[2]; // Nash product
    rows.push({
      label: `PV ${pv} · BESS ${bess} · DH ${dh}%`,
      utilities: u,
      objective: nash,
      config: { pv_gw: pv, bess_gwh: bess, dh_heat_pump_pct: dh, self_sufficiency: o.self_sufficiency },
      isEquilibrium: false,
    });
    if (!best || nash > best.objective) best = rows[rows.length - 1];
  }
  // Keep top 6 + equilibrium
  rows.sort((a, b) => b.objective - a.objective);
  rows = rows.slice(0, 6);
  if (best) {
    const idx = rows.findIndex((r) => r.label === best.label);
    if (idx >= 0) rows[idx].isEquilibrium = true;
    else { best.isEquilibrium = true; rows.push(best); }
  }

  return {
    title: "Nash bargaining · Municipality × PPC × Community",
    subtitle: "Disagreement payoff = ‘Status quo’ preset. Equilibrium = argmax Π(uᵢ − dᵢ).",
    players: ["Municipality", "PPC", "Community"],
    objectiveName: "Nash product",
    rows,
    equilibrium: {
      config: best.config,
      explanation: `Bargaining solution favours PV ${best.config.pv_gw} GW, BESS ${best.config.bess_gwh} GWh, and DH retrofit ${best.config.dh_heat_pump_pct}%. Self-sufficiency ${(best.config.self_sufficiency * 100).toFixed(1)}%.`,
    },
  };
}

function utilSection6(o) {
  // u_muni: jobs + local impact − bills
  const uMuni = 0.5 * (o.jobs / 20000) + 0.4 * o.local_impact - 0.1 * (o.economics.system_cost_eur / 1e9);
  // u_ppc: -system cost (PPC's NPV proxy)
  const uPpc = -o.economics.system_cost_eur / 1e9 + (o.economics.export_revenue_eur / 1e9);
  // u_comm: self-sufficiency + local impact − emissions
  const uComm = 0.5 * o.self_sufficiency + 0.4 * o.local_impact - 0.2 * (o.emissions.tco2_yr / 5e6);
  return [uMuni, uPpc, uComm];
}

// ---------- Stackelberg (Section 7) -----------------------------------------
// State (leader) sets export_tax_pct. Followers play a closed-form Nash:
//   • PPC chooses (pv_gw, electrolyser_gw) to maximise its NPV proxy
//   • IPTO reinforces only when expected utilisation crosses a threshold
//   • Offtaker takes PPA volume proportional to Kozani LCOE vs benchmarks
// For each tax we sweep PPC's (PV × electrolyser) grid (~30 cells),
// pick PPC's best response, then evaluate the leader's payoff.
// This produces a true inverted-U Laffer revenue curve.
function stackelberg(state, profiles, sim) {
  const taxes = [0, 2, 4, 6, 8, 10, 12, 15, 18, 20];
  const pvGrid   = [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.5];
  const elecGrid = [0,   0.3, 0.6, 1.0, 1.5];

  const rows = [];
  let best = null;
  for (const t of taxes) {
    let bestFollower = null;
    for (const pv of pvGrid) for (const eg of elecGrid) {
      const o = sim.outcomes({ ...state, pv_gw: pv, electrolyser_gw: eg, export_tax_pct: t }, profiles);
      const uPpc = ppcUtility(o, t);
      if (!bestFollower || uPpc > bestFollower.uPpc) {
        bestFollower = { uPpc, pv, eg, o };
      }
    }
    const o = bestFollower.o;
    // Leader's payoff: tax revenue is dominant; jobs are a smaller weight.
    const uState =   (o.export_tax_revenue_eur / 1e9)
                   + (o.jobs / 80000);
    const uIpto  = followerUIpto(o);
    const uOff   = followerUOffer(o);
    rows.push({
      label: `Tax ${t}%`,
      utilities: [uState, bestFollower.uPpc, uIpto, uOff],
      objective: uState,
      config: {
        export_tax_pct: t,
        pv_best_gw: bestFollower.pv,
        electrolyser_best_gw: bestFollower.eg,
        tax_rev_meur_yr: o.export_tax_revenue_eur / 1e6,
        exports_twh: o.annual.exp_twh,
      },
      isEquilibrium: false,
    });
    if (!best || uState > best.objective) best = rows[rows.length - 1];
  }
  best.isEquilibrium = true;

  return {
    title: "Stackelberg · State leader, PPC/IPTO/Offtaker followers",
    subtitle: "PPC re-optimises (PV × electrolyser) at every tax. As tax rises, PPC scales back → exports thin → state revenue traces an inverted-U Laffer.",
    players: ["State", "PPC", "IPTO", "Offtaker"],
    objectiveName: "u(State)",
    rows,
    equilibrium: {
      config: best.config,
      explanation:
        `Revenue-maximising export tax ≈ ${best.config.export_tax_pct}%. ` +
        `PPC's best response: ${best.config.pv_best_gw} GW PV + ${best.config.electrolyser_best_gw} GW electrolyser, ` +
        `delivering ${best.config.exports_twh.toFixed(2)} TWh exports and €${best.config.tax_rev_meur_yr.toFixed(1)}M/yr in state revenue.`,
    },
    // For optional plot in the GameView card
    leaderSweep: rows.map((r) => ({
      tax: r.config.export_tax_pct,
      revenue_meur: r.config.tax_rev_meur_yr,
      pv: r.config.pv_best_gw,
      exports_twh: r.config.exports_twh,
    })),
  };
}

function ppcUtility(o, taxPct) {
  // PPC's risk-adjusted NPV proxy. Regulatory risk scales capex up at higher tax
  // — a standard hurdle-rate adjustment when sovereign policy is unstable.
  // 0% tax → 1× capex (no premium). 20% tax → 2× (heavy premium). Quadratic.
  const riskMult = 1 + Math.pow((taxPct || 0) / 20, 2);
  return (o.economics.export_revenue_eur
        - o.economics.capex_annual_eur * riskMult
        - o.economics.opex_annual_eur
        - o.economics.fuel_cost_eur - o.economics.carbon_cost_eur) / 1e9;
}
function followerUIpto(o)  { return Math.min(1, o.annual.exp_twh / 5) - 0.1 * o.annual.curt_twh; }
function followerUOffer(o) {
  // Offtaker prefers some export volume — proxy for available PPA depth.
  return Math.min(1, o.annual.exp_twh / 3);
}

window.GameView = GameView;

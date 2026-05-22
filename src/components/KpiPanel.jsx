// KpiPanel — right pane. KPI cards + small mini-charts.

const { useMemo: _useMemo_kpi } = React;

function fmtNum(x, sig = 2) {
  if (x === null || x === undefined || !Number.isFinite(x)) return "—";
  const abs = Math.abs(x);
  if (abs >= 1e9) return (x / 1e9).toFixed(sig) + "B";
  if (abs >= 1e6) return (x / 1e6).toFixed(sig) + "M";
  if (abs >= 1e3) return (x / 1e3).toFixed(sig) + "k";
  if (abs >= 1)   return x.toFixed(sig);
  return x.toFixed(sig + 1);
}
function fmtPct(x, dp = 0) {
  if (!Number.isFinite(x)) return "—";
  return (x * 100).toFixed(dp) + "%";
}
function fmtEUR(x, sig = 2) {
  if (!Number.isFinite(x)) return "—";
  const abs = Math.abs(x);
  if (abs >= 1e9) return "€" + (x / 1e9).toFixed(sig) + "B";
  if (abs >= 1e6) return "€" + (x / 1e6).toFixed(sig) + "M";
  if (abs >= 1e3) return "€" + (x / 1e3).toFixed(sig) + "k";
  return "€" + x.toFixed(0);
}

function Delta({ value, baseline, fmt, lowerIsBetter = false, suffix = "" }) {
  if (baseline === null || baseline === undefined) return null;
  const d = value - baseline;
  if (Math.abs(d) < (Math.abs(baseline) * 0.005)) {
    return <div className="delta neutral num">±0{suffix}</div>;
  }
  const better = lowerIsBetter ? d < 0 : d > 0;
  const arrow = d > 0 ? "▲" : "▼";
  return (
    <div className={"delta " + (better ? "up" : "down") + " num"}>
      <span>{arrow}</span><span>{fmt ? fmt(Math.abs(d)) : Math.abs(d).toFixed(2)}{suffix}</span>
    </div>
  );
}

function KpiCard({ label, value, unit, delta, alert }) {
  return (
    <div className={"kpi-card" + (alert ? " alert" : "")}>
      <div className="label">{label}</div>
      <div className="value num">{value}{unit ? <span className="unit">{unit}</span> : null}</div>
      {delta}
    </div>
  );
}

function Bar({ value, max, color }) {
  const w = Math.max(0, Math.min(1, value / Math.max(1e-9, max)));
  return (
    <div style={{ height: 4, background: "var(--line)", borderRadius: 2, overflow: "hidden" }}>
      <div style={{ height: "100%", background: color || "var(--accent)", width: (w * 100) + "%" }} />
    </div>
  );
}

function KpiPanel({ outcomes, baseline, section, ensemble }) {
  if (!outcomes) return null;
  const o = outcomes;
  const b = baseline;

  const selfSuff = o.self_sufficiency;
  const ssTarget = 0.95;
  const inertiaBelow = o.inertia && o.inertia.below_floor;

  return (
    <div>
      <div className="kpi-section-head">Headline</div>
      <div className="kpi-grid">
        <KpiCard label="Self-sufficiency" value={fmtPct(selfSuff, 0)}
                 alert={section === "self-suff" && selfSuff < ssTarget}
                 delta={b ? <Delta value={selfSuff} baseline={b.self_sufficiency} fmt={(v) => (v * 100).toFixed(1) + "pp"} /> : null} />
        <KpiCard label="System cost"
                 value={fmtEUR(o.economics.system_cost_eur, 2)} unit="/yr"
                 delta={b ? <Delta value={o.economics.system_cost_eur} baseline={b.economics.system_cost_eur}
                                   fmt={(v) => fmtEUR(v, 2)} lowerIsBetter /> : null} />
        <KpiCard label="Emissions" value={fmtNum(o.emissions.tco2_yr, 2)} unit=" tCO₂/yr"
                 delta={b ? <Delta value={o.emissions.tco2_yr} baseline={b.emissions.tco2_yr}
                                   fmt={(v) => fmtNum(v, 2)} lowerIsBetter /> : null} />
        <KpiCard label="Jobs" value={fmtNum(o.jobs, 1)}
                 delta={b ? <Delta value={o.jobs} baseline={b.jobs} fmt={(v) => fmtNum(v, 1)} /> : null} />
      </div>

      <div className="kpi-section-head">Annual energy</div>
      <div className="kpi-mini">
        <div className="lbl">Demand <span className="v">{o.annual.dem_twh.toFixed(2)} TWh</span></div>
        <Bar value={o.annual.dem_twh} max={Math.max(3, o.annual.gen_twh)} color="var(--ink-2)" />
      </div>
      <div className="kpi-mini">
        <div className="lbl">Generation total <span className="v">{o.annual.gen_twh.toFixed(2)} TWh</span></div>
        <Bar value={o.annual.gen_twh} max={Math.max(3, o.annual.gen_twh, o.annual.dem_twh)} color="var(--c-export)" />
        {(() => {
          const ligTWh = (o.capacities.ligniteMw * 0.55 * 8760) / 1e6;
          const renTWh = Math.max(0, o.annual.gen_twh - ligTWh);
          const share = renTWh / Math.max(1e-9, o.annual.gen_twh);
          return (
            <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between",
                          fontSize: 10.5, color: "var(--muted)", fontVariantNumeric: "tabular-nums" }}>
              <span>Renewable {(share * 100).toFixed(0)}%</span>
              <span>Lignite {ligTWh.toFixed(2)} TWh</span>
            </div>
          );
        })()}
      </div>
      <div className="kpi-mini">
        <div className="lbl">Imports <span className="v">{o.annual.imp_twh.toFixed(2)} TWh</span></div>
        <Bar value={o.annual.imp_twh} max={Math.max(0.5, o.annual.imp_twh, o.annual.dem_twh * 0.5)} color="var(--c-import)" />
      </div>
      <div className="kpi-mini">
        <div className="lbl">Exports <span className="v">{o.annual.exp_twh.toFixed(2)} TWh</span></div>
        <Bar value={o.annual.exp_twh} max={Math.max(0.5, o.annual.exp_twh, o.annual.gen_twh * 0.5)} color="var(--c-export)" />
      </div>
      <div className="kpi-mini">
        <div className="lbl">Curtailment <span className="v">{o.annual.curt_twh.toFixed(2)} TWh</span></div>
        <Bar value={o.annual.curt_twh} max={Math.max(0.2, o.annual.curt_twh, o.annual.gen_twh * 0.3)} color="var(--c-curt)" />
      </div>

      <div className="kpi-section-head">System health</div>
      <div className="kpi-mini">
        <div className="lbl">Inertia (synchronous) <span className="v">{o.inertia.synchronous_mw.toFixed(0)} MW</span></div>
        {inertiaBelow ? (
          <div className="pill alert" style={{ marginTop: 4 }}>Below 300 MW floor — frequency stability risk</div>
        ) : (
          <div className="pill good" style={{ marginTop: 4 }}>Above floor</div>
        )}
      </div>
      <div className="kpi-mini">
        <div className="lbl">Local impact score <span className="v">{(o.local_impact * 100).toFixed(0)}/100</span></div>
        <Bar value={o.local_impact} max={1} color="var(--accent)" />
      </div>
      <div className="kpi-mini">
        <div className="lbl">Capex annuity <span className="v">{fmtEUR(o.economics.capex_annual_eur, 1)}/yr</span></div>
      </div>

      {section === "export" ? (
        <React.Fragment>
          <div className="kpi-section-head">Export</div>
          <div className="kpi-mini">
            <div className="lbl">State tax revenue <span className="v">{fmtEUR(o.export_tax_revenue_eur, 1)}/yr</span></div>
          </div>
          <div className="kpi-mini">
            <div className="lbl">Export revenue (PPC) <span className="v">{fmtEUR(o.economics.export_revenue_eur, 1)}/yr</span></div>
          </div>
          {o.h2.kt_yr > 0 ? (
            <div className="kpi-mini">
              <div className="lbl">H₂ production <span className="v">{o.h2.kt_yr.toFixed(1)} kt/yr</span></div>
              <div className="lbl">LCoH <span className="v">{o.h2.lcoh_eur_kg ? "€" + o.h2.lcoh_eur_kg.toFixed(1) + "/kg" : "—"}</span></div>
            </div>
          ) : null}
        </React.Fragment>
      ) : null}

      <RegretSection ensemble={ensemble} />
    </div>
  );
}

function RegretSection({ ensemble }) {
  if (!ensemble || !ensemble.length) return null;
  const costs = ensemble.map((e) => e.system_cost_eur);
  const minCost = Math.min(...costs);
  const maxCost = Math.max(...costs);
  const meanCost = costs.reduce((s, c) => s + c, 0) / costs.length;
  // CVaR at 0.9: mean of worst 10%
  const sorted = [...costs].sort((a, b) => b - a);
  const cvarN = Math.max(1, Math.floor(sorted.length * 0.1));
  const cvar = sorted.slice(0, cvarN).reduce((s, c) => s + c, 0) / cvarN;

  const span = Math.max(1e6, maxCost - minCost);
  return (
    <React.Fragment>
      <div className="kpi-section-head">Robust check · climate × gas ensemble</div>
      <div className="kpi-mini">
        <div className="lbl">System cost range <span className="v">
          {window.kpiUtils.fmtEUR(minCost, 1)} → {window.kpiUtils.fmtEUR(maxCost, 1)}
        </span></div>
        <div style={{ position: "relative", height: 22, marginTop: 4, marginBottom: 2 }}>
          <div style={{ position: "absolute", top: 8, left: 0, right: 0, height: 4,
                        background: "var(--line)", borderRadius: 2 }} />
          {ensemble.map((e, i) => {
            const x = ((e.system_cost_eur - minCost) / span) * 100;
            return (
              <div key={i} title={`${e.climate} · ${e.gas_price} · ${window.kpiUtils.fmtEUR(e.system_cost_eur, 1)}/yr`}
                   style={{
                     position: "absolute", left: `calc(${x}% - 3px)`, top: 4,
                     width: 6, height: 12, borderRadius: 1,
                     background: "var(--accent)", opacity: 0.55,
                   }} />
            );
          })}
        </div>
        <div className="lbl" style={{ display: "flex", justifyContent: "space-between",
                                       marginTop: 4, fontSize: 10, color: "var(--muted)" }}>
          <span>mean {window.kpiUtils.fmtEUR(meanCost, 1)}</span>
          <span>CVaR₉₀ {window.kpiUtils.fmtEUR(cvar, 1)}</span>
        </div>
      </div>
      <div className="kpi-mini" style={{ paddingTop: 0 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>
          Self-sufficiency distribution
        </div>
        <div style={{ display: "flex", gap: 2 }}>
          {ensemble.map((e, i) => {
            const h = Math.max(3, e.self_sufficiency * 24);
            const ok = e.self_sufficiency >= 0.95;
            return (
              <div key={i} title={`${e.climate} · ${e.gas_price} · ${(e.self_sufficiency * 100).toFixed(1)}%`}
                   style={{ flex: 1, height: h, background: ok ? "var(--accent)" : "var(--warn)",
                            opacity: 0.7, borderRadius: 1 }} />
            );
          })}
        </div>
      </div>
    </React.Fragment>
  );
}

window.KpiPanel = KpiPanel;
window.kpiUtils = { fmtNum, fmtPct, fmtEUR };

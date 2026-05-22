// ParetoView — sweep PV capacity at the user's current state, plot
// (system cost, emissions) trade-off. Highlight the current configuration.
const { useMemo: _useMemoP } = React;

function ParetoView({ state, profiles, outcomes }) {
  const sim = window.KOZANI.simulation;

  const data = _useMemoP(() => {
    if (!profiles) return null;
    const pvVals = [];
    for (let pv = 0; pv <= 6; pv += 0.5) pvVals.push(pv);
    // Two frontier sweeps: (a) PV-only varied, (b) PV + BESS scaled together
    const a = pvVals.map((pv) => {
      const o = sim.outcomes({ ...state, pv_gw: pv }, profiles);
      return {
        pv,
        cost_meur: o.economics.system_cost_eur / 1e6,
        emissions_kt: o.emissions.tco2_yr / 1e3,
        self_sufficiency: o.self_sufficiency,
        is_current: Math.abs(pv - state.pv_gw) < 1e-3,
      };
    });
    const b = pvVals.map((pv) => {
      // BESS scaled with PV (0.3 GWh per GW PV)
      const bess = Math.min(3, pv * 0.3);
      const o = sim.outcomes({ ...state, pv_gw: pv, bess_gwh: bess }, profiles);
      return {
        pv,
        cost_meur: o.economics.system_cost_eur / 1e6,
        emissions_kt: o.emissions.tco2_yr / 1e3,
        self_sufficiency: o.self_sufficiency,
      };
    });
    return { a, b };
  }, [state, profiles]);

  if (!data) return null;

  return (
    <div style={{ flex: 1, padding: 12, overflow: "auto", display: "flex",
                  flexDirection: "column", gap: 12, minWidth: 0 }}>
      <div style={{ fontSize: 11, color: "var(--muted)" }}>
        Sweeping PV capacity 0 → 6 GW with all other sliders held at their current values.
        Each point is a fully simulated configuration. The current configuration is highlighted.
      </div>

      <div style={{ flex: 1, minHeight: 240, background: "var(--surface)",
                    border: "1px solid var(--line)", borderRadius: 4, padding: 12 }}>
        <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase",
                      letterSpacing: 0.05, marginBottom: 6 }}>
          Cost vs Emissions trade-off
        </div>
        <Recharts.ResponsiveContainer width="100%" height={220}>
          <Recharts.ComposedChart margin={{ top: 6, right: 16, left: 4, bottom: 22 }}>
            <Recharts.CartesianGrid strokeDasharray="2 4" stroke="#E5E5E2" />
            <Recharts.XAxis dataKey="cost_meur" type="number" name="System cost"
                            domain={["dataMin", "dataMax"]}
                            tick={{ fontSize: 10, fill: "#71717A" }} stroke="#D4D4D1"
                            label={{ value: "system cost · €M/yr", position: "insideBottom",
                                     offset: -8, fontSize: 11, fill: "#71717A" }} />
            <Recharts.YAxis dataKey="emissions_kt" type="number" name="Emissions"
                            tick={{ fontSize: 10, fill: "#71717A" }} stroke="#D4D4D1"
                            label={{ value: "ktCO₂/yr", angle: -90, position: "insideLeft",
                                     fontSize: 11, fill: "#71717A" }} />
            <Recharts.Tooltip content={<ParetoTooltip />} cursor={{ stroke: "#D4D4D1" }} />
            <Recharts.Line data={data.a} dataKey="emissions_kt" stroke="#0F766E"
                           strokeWidth={1.6} dot={{ r: 2.5, fill: "#0F766E" }}
                           name="PV only" isAnimationActive={false} type="monotone" />
            <Recharts.Line data={data.b} dataKey="emissions_kt" stroke="#B45309"
                           strokeWidth={1.6} dot={{ r: 2.5, fill: "#B45309" }}
                           name="PV + BESS scaled" isAnimationActive={false} type="monotone"
                           strokeDasharray="4 3" />
            {(() => {
              const cur = data.a.find((d) => d.is_current);
              if (!cur) return null;
              return (
                <Recharts.ReferenceDot x={cur.cost_meur} y={cur.emissions_kt}
                                       r={6} fill="#0F766E" stroke="#fff" strokeWidth={2}
                                       isFront />
              );
            })()}
            <Recharts.Legend wrapperStyle={{ fontSize: 11 }} iconType="line" verticalAlign="top" />
          </Recharts.ComposedChart>
        </Recharts.ResponsiveContainer>
      </div>

      <div style={{ minHeight: 200, background: "var(--surface)",
                    border: "1px solid var(--line)", borderRadius: 4, padding: 12 }}>
        <div style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase",
                      letterSpacing: 0.05, marginBottom: 6 }}>
          Self-sufficiency vs PV capacity
        </div>
        <Recharts.ResponsiveContainer width="100%" height={180}>
          <Recharts.LineChart data={data.a} margin={{ top: 6, right: 16, left: 4, bottom: 22 }}>
            <Recharts.CartesianGrid strokeDasharray="2 4" stroke="#E5E5E2" vertical={false} />
            <Recharts.XAxis dataKey="pv" tick={{ fontSize: 10, fill: "#71717A" }} stroke="#D4D4D1"
                            label={{ value: "PV · GW", position: "insideBottom",
                                     offset: -8, fontSize: 11, fill: "#71717A" }} />
            <Recharts.YAxis tick={{ fontSize: 10, fill: "#71717A" }} stroke="#D4D4D1"
                            domain={[0, 1]} tickFormatter={(v) => (v * 100).toFixed(0) + "%"}
                            label={{ value: "self-sufficiency", angle: -90,
                                     position: "insideLeft", fontSize: 11, fill: "#71717A" }} />
            <Recharts.Tooltip formatter={(v, n) => [(v * 100).toFixed(1) + "%", "Self-sufficiency"]}
                              labelFormatter={(l) => "PV " + l + " GW"}
                              contentStyle={{ fontSize: 11, padding: "4px 8px" }} />
            <Recharts.ReferenceLine y={0.95} stroke="#B45309" strokeDasharray="3 3"
                                    label={{ value: "0.95 target", fontSize: 10, fill: "#B45309" }} />
            <Recharts.Line dataKey="self_sufficiency" stroke="#0F766E"
                           strokeWidth={1.6} dot={{ r: 2.5, fill: "#0F766E" }}
                           isAnimationActive={false} type="monotone" />
          </Recharts.LineChart>
        </Recharts.ResponsiveContainer>
      </div>
    </div>
  );
}

function ParetoTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)",
                  padding: "6px 10px", fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
      <strong>PV {p.pv.toFixed(2)} GW</strong>
      <div>System cost €{p.cost_meur.toFixed(0)}M/yr</div>
      <div>Emissions {p.emissions_kt.toFixed(1)} ktCO₂/yr</div>
      <div>Self-sufficiency {(p.self_sufficiency * 100).toFixed(1)}%</div>
    </div>
  );
}

window.ParetoView = ParetoView;

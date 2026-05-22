// DispatchView — hourly stacked-area dispatch. Toggle 24h / week / worst-week.
const { useState: _useStateD, useMemo: _useMemoD } = React;

function DispatchView({ outcomes, profiles }) {
  const [windowMode, setWindowMode] = _useStateD("worstWinter");

  const series = _useMemoD(() => {
    if (!outcomes || !profiles) return null;
    // Find start hour for window.
    let startHour = 0, hoursLen = 24 * 7;
    if (windowMode === "day") {
      hoursLen = 24;
      startHour = 24 * 180; // late June default
    } else if (windowMode === "summerWeek") {
      hoursLen = 24 * 7;
      startHour = 24 * 195; // mid-July
    } else if (windowMode === "worstWinter") {
      // Find the day with highest demand
      const dem = outcomes.hourly.dem;
      let bestDay = 0, bestSum = 0;
      for (let d = 0; d < 365; d++) {
        let s = 0;
        for (let h = 0; h < 24; h++) s += dem[d * 24 + h];
        if (s > bestSum) { bestSum = s; bestDay = d; }
      }
      hoursLen = 24 * 7;
      startHour = Math.max(0, (bestDay - 3) * 24);
    } else if (windowMode === "annualHeatmap") {
      hoursLen = 8760;
      startHour = 0;
    }
    return buildSeries(outcomes, profiles, startHour, hoursLen);
  }, [outcomes, profiles, windowMode]);

  if (!series) return null;
  return (
    <div className="dispatch-container">
      <div className="dispatch-controls">
        <span className="label">Window</span>
        <div className="seg" style={{
          display: "inline-flex", border: "1px solid var(--line)",
          borderRadius: 4, overflow: "hidden", background: "var(--surface)"
        }}>
          {[
            ["worstWinter", "Worst winter week"],
            ["summerWeek", "Summer week"],
            ["day", "Day"],
          ].map(([k, lbl]) => (
            <button key={k}
              onClick={() => setWindowMode(k)}
              style={{
                border: 0, background: windowMode === k ? "var(--accent)" : "transparent",
                color: windowMode === k ? "#fff" : "var(--muted)",
                padding: "5px 10px", fontSize: 11.5, cursor: "pointer",
                borderRight: "1px solid var(--line)",
              }}>{lbl}</button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div className="pill">Demand peak {Math.round(maxOf(outcomes.hourly.dem))} MW</div>
        <div className="pill">Gen peak {Math.round(maxOf(outcomes.hourly.gen))} MW</div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Recharts.ResponsiveContainer width="100%" height="100%">
          <Recharts.ComposedChart data={series} margin={{ top: 10, right: 20, bottom: 24, left: 12 }}>
            <Recharts.CartesianGrid strokeDasharray="2 4" stroke="#E5E5E2" vertical={false} />
            <Recharts.XAxis dataKey="t" tick={{ fontSize: 10, fill: "#71717A" }} stroke="#D4D4D1"
                            tickFormatter={(t, i) => series.length > 48 ? (i % 24 === 0 ? "d" + Math.floor(i / 24 + 1) : "") : (t % 4 === 0 ? t + "h" : "")} />
            <Recharts.YAxis tick={{ fontSize: 10, fill: "#71717A" }} stroke="#D4D4D1"
                            label={{ value: "MW", angle: -90, position: "insideLeft", fill: "#71717A", fontSize: 11 }} />
            <Recharts.Tooltip content={<DispatchTooltip />} />
            <Recharts.Legend wrapperStyle={{ fontSize: 11 }} iconType="square" />

            <Recharts.Area dataKey="pv"      name="PV"        stackId="gen" stroke="none" fill="#D4A017" fillOpacity={0.85} isAnimationActive={false} />
            <Recharts.Area dataKey="wind"    name="Wind"      stackId="gen" stroke="none" fill="#1F6FB1" fillOpacity={0.85} isAnimationActive={false} />
            <Recharts.Area dataKey="lignite" name="Lignite"   stackId="gen" stroke="none" fill="#44403C" fillOpacity={0.85} isAnimationActive={false} />
            <Recharts.Area dataKey="disch"   name="Storage discharge"  stackId="gen" stroke="none" fill="#8B5A2B" fillOpacity={0.7} isAnimationActive={false} />
            <Recharts.Area dataKey="imp"     name="Import"    stackId="gen" stroke="none" fill="#B91C1C" fillOpacity={0.55} isAnimationActive={false} />

            <Recharts.Line dataKey="demand"  name="Demand"    stroke="#18181B" strokeWidth={1.6} dot={false} isAnimationActive={false} />
            <Recharts.Line dataKey="curtail" name="Curtailed" stroke="#A1A1AA" strokeWidth={1} strokeDasharray="3 3" dot={false} isAnimationActive={false} />
          </Recharts.ComposedChart>
        </Recharts.ResponsiveContainer>
      </div>
    </div>
  );
}

function DispatchTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload;
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--line)",
      padding: "6px 10px", fontSize: 11, fontVariantNumeric: "tabular-nums",
      borderRadius: 3,
    }}>
      <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>Hour {label}</div>
      {[
        ["Demand", row.demand, "#18181B"],
        ["PV", row.pv, "#D4A017"],
        ["Wind", row.wind, "#1F6FB1"],
        ["Lignite", row.lignite, "#44403C"],
        ["Storage", row.disch, "#8B5A2B"],
        ["Import", row.imp, "#B91C1C"],
        ["Curtailment", row.curtail, "#A1A1AA"],
      ].map(([k, v, c]) => (
        <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <span><span style={{ display: "inline-block", width: 8, height: 8, background: c, marginRight: 5 }} />{k}</span>
          <span>{Math.round(v || 0)} MW</span>
        </div>
      ))}
    </div>
  );
}

function buildSeries(outcomes, profiles, start, len) {
  const out = [];
  // Split generation into components — need to recompute since stored array is total.
  // Use saved capacities.
  const pvMw = outcomes.capacities.pvMw;
  const wndMw = outcomes.capacities.wndMw;
  const ligMw = outcomes.capacities.ligniteMw;
  for (let i = 0; i < len; i++) {
    const h = (start + i) % profiles.hours;
    const pv = pvMw * profiles.solar_cf[h];
    const wind = wndMw * profiles.wind_cf[h];
    const lignite = ligMw * 0.55;
    const stor = outcomes.hourly.stor[h];
    const disch = Math.max(0, stor);
    const charge = Math.max(0, -stor); // not stacked but shown as a thin marker
    const imp = outcomes.hourly.imp[h];
    const curt = outcomes.hourly.curt[h];
    const dem = outcomes.hourly.dem[h];
    out.push({ t: i, pv, wind, lignite, disch, charge, imp, curtail: curt, demand: dem });
  }
  return out;
}

function maxOf(arr) {
  let m = -Infinity;
  for (let i = 0; i < arr.length; i++) if (arr[i] > m) m = arr[i];
  return m;
}

window.DispatchView = DispatchView;

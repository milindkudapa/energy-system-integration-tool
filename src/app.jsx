// Kozani ESI Decision Tool — main app
// Three-pane shell. Live simulation on slider change (debounced for heavy game/robust ops).

const { useState, useEffect, useMemo, useRef, useCallback } = React;

function App() {
  // Section: "framework" | "modules" | "self-suff" | "export" | "methods"
  const [section, setSection] = useState("framework");
  const [tab, setTab] = useState("map"); // map | dispatch | sankey | pareto | game
  const [state, setState] = useState({ ...window.KOZANI.constants.DEFAULT_STATE });
  const [locks, setLocks] = useState({});
  const [compareBaseline, setCompareBaseline] = useState(true);
  const [showDataModal, setShowDataModal] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [animatingPreset, setAnimatingPreset] = useState(null);
  const [, setBaselineTick] = useState(0); // bump to re-render KPI deltas after re-baselining

  // Profiles — generated once on mount
  const profiles = useMemo(() => window.KOZANI.profiles.build(), []);

  // Live outcomes (cheap — ~5 ms)
  const outcomes = useMemo(() => {
    if (!profiles) return null;
    const o = window.KOZANI.simulation.outcomes(state, profiles);
    o.__state_dh_pct = state.dh_heat_pump_pct;
    return o;
  }, [state, profiles]);

  // Robust ensemble — climate × gas swap. ~12 evaluations, runs in <300 ms.
  const ensemble = useMemo(() => {
    if (!profiles) return null;
    return window.KOZANI.simulation.robustEnsemble(
      state, profiles,
      ["RCP 2.6", "RCP 4.5", "RCP 8.5"],
      ["low", "central", "high", "shock"]
    );
  }, [state, profiles]);

  // Baseline — frozen at current section's "Status quo" by default
  const baselineRef = useRef(null);
  useEffect(() => {
    if (!profiles) return;
    if (!baselineRef.current) {
      const baseState = { ...window.KOZANI.constants.PRESETS["Status quo"] };
      baselineRef.current = window.KOZANI.simulation.outcomes(baseState, profiles);
    }
  }, [profiles]);

  // Apply preset — animated slider sweep over ~600 ms.
  // Uses rAF; falls back to setTimeout if rAF is throttled.
  function applyPreset(name) {
    const preset = window.KOZANI.constants.PRESETS[name];
    if (!preset) return;
    const startState = { ...state };
    const endState = { ...state, ...preset };
    const dur = 600;
    const t0 = performance.now();
    setAnimatingPreset(name);
    let finished = false;
    function tick(now) {
      if (finished) return;
      const t = (typeof now === "number") ? now : performance.now();
      const p = Math.min(1, (t - t0) / dur);
      const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const interp = {};
      for (const k of Object.keys(endState)) {
        const a = startState[k], b = endState[k];
        if (typeof a === "number" && typeof b === "number") interp[k] = a + (b - a) * e;
        else interp[k] = b;
      }
      setState((s) => ({ ...s, ...interp }));
      if (p < 1) requestAnimationFrame(tick);
      else { finished = true; setAnimatingPreset(null); }
    }
    requestAnimationFrame(tick);
    // Safety: ensure we snap to final after dur+200 ms even if rAF is throttled
    setTimeout(() => {
      if (!finished) {
        finished = true;
        setState((s) => ({ ...s, ...endState }));
        setAnimatingPreset(null);
      }
    }, dur + 200);
  }

  // Recompute flicker — 1px strip at top of viz pane
  useEffect(() => {
    setRecomputing(true);
    const t = setTimeout(() => setRecomputing(false), 120);
    return () => clearTimeout(t);
  }, [state]);

  // Auto-switch tab + initial config when entering Section 6 / 7
  useEffect(() => {
    const valid = ["map", "dispatch", "sankey", "pareto", "game"];
    if (section === "self-suff") setTab((t) => valid.includes(t) ? t : "sankey");
    if (section === "export")    setTab((t) => valid.includes(t) ? t : "map");
  }, [section]);

  const inSimSection = section === "self-suff" || section === "export";
  const mapMode = section === "export" ? "export" : "default";

  return (
    <div className="app">
      <TopBar
        section={section} setSection={setSection}
        onPreset={applyPreset}
        animatingPreset={animatingPreset}
        compareBaseline={compareBaseline} setCompareBaseline={setCompareBaseline}
        onReset={() => setState({ ...window.KOZANI.constants.DEFAULT_STATE })}
        onShowData={() => setShowDataModal(true)}
        onSetBaseline={() => {
          if (!profiles) return;
          baselineRef.current = window.KOZANI.simulation.outcomes(state, profiles);
          setBaselineTick((n) => n + 1);
        }}
        section7Visible={inSimSection}
      />

      {!inSimSection ? (
        <div style={{ overflow: "auto" }}>
          {section === "framework" ? <FrameworkLanding onBegin={() => setSection("modules")} />
           : section === "modules" ? <ModulesLanding onBegin={() => setSection("self-suff")} />
           : section === "methods"  ? <MethodsView />
           : null}
        </div>
      ) : (
        <div className="main">
          <div className="pane controls">
            <SectionBanner section={section} />
            <Controls
              state={state} setState={setState}
              locks={locks} setLocks={setLocks}
              section={section}
            />
          </div>
          <div className="pane viz">
            <div className="viz-tabs">
              {["map", "dispatch", "sankey", "pareto", "game"].map((k) => (
                <button key={k} className={tab === k ? "active" : ""} onClick={() => setTab(k)}>
                  {k === "map" ? "Map"
                   : k === "dispatch" ? "Dispatch"
                   : k === "sankey" ? "Sankey"
                   : k === "pareto" ? "Pareto"
                   : "Game"}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 10.5, color: "var(--muted)", marginRight: 8 }}>
                {recomputing ? <span><span className="dot-anim" /> recomputing</span> :
                  <span>last run · {outcomes ? "<50 ms" : "—"}</span>}
              </span>
            </div>
            <div className={"recompute-strip" + (recomputing ? " active" : "")} />
            <div className="viz-body">
              {tab === "map" && <MapView state={state} outcomes={outcomes} mode={mapMode} />}
              {tab === "dispatch" && <DispatchView outcomes={outcomes} profiles={profiles} />}
              {tab === "sankey" && <SankeyView outcomes={outcomes} profiles={profiles} />}
              {tab === "pareto" && <ParetoView state={state} profiles={profiles} outcomes={outcomes} />}
              {tab === "game" && <GameView section={section} state={state} profiles={profiles} baseline={compareBaseline ? baselineRef.current : null} />}
            </div>
          </div>
          <div className="pane kpi">
            <KpiPanel outcomes={outcomes} baseline={compareBaseline ? baselineRef.current : null}
                      section={section} ensemble={ensemble} />
          </div>
        </div>
      )}

      {showDataModal && <DataModal onClose={() => setShowDataModal(false)} />}
    </div>
  );
}

function TopBar({ section, setSection, onPreset, animatingPreset, compareBaseline, setCompareBaseline,
                  onReset, onShowData, onSetBaseline, section7Visible }) {
  return (
    <div className="topbar">
      <div className="brand">
        <span className="dot" />
        <span>Kozani <span className="sub">/ ESI for Resilience</span></span>
      </div>
      <div className="sections">
        {[
          ["framework", "Framework"],
          ["modules",   "Modules"],
          ["self-suff", "Self-sufficiency"],
          ["export",    "Export"],
          ["methods",   "Methods"],
        ].map(([k, lbl]) => (
          <button key={k} className={section === k ? "active" : ""} onClick={() => setSection(k)}>{lbl}</button>
        ))}
      </div>
      <div className="grow" />
      <div className="controls">
        {section7Visible ? (
          <React.Fragment>
            <select className="select" defaultValue="" onChange={(e) => { if (e.target.value) { onPreset(e.target.value); e.target.value = ""; } }}>
              <option value="" disabled>Preset…</option>
              <option>Status quo</option>
              <option>Self-sufficiency 2035</option>
              <option>Export hub 2040</option>
              <option>Robust baseline</option>
            </select>
            {animatingPreset ? <span className="pill"><span className="dot-anim" /> applying {animatingPreset}</span> : null}
            <button className="btn" onClick={onReset}>Reset</button>
            <button className="btn" onClick={onSetBaseline} title="Pin the current configuration as baseline for vs-baseline deltas">Set baseline</button>
            <label className="btn" style={{ cursor: "pointer" }}>
              <input type="checkbox" checked={compareBaseline} onChange={(e) => setCompareBaseline(e.target.checked)}
                     style={{ marginRight: 4 }} />
              vs baseline
            </label>
          </React.Fragment>
        ) : null}
        <button className="btn ghost" onClick={onShowData}>Data</button>
      </div>
    </div>
  );
}

function SectionBanner({ section }) {
  if (section === "self-suff") {
    return <div className="notice">
      <strong>Self-sufficiency.</strong> Three players (Municipality, PPC, Community).
      Nash bargaining preselected. Try: <em>Self-sufficiency 2035</em> preset, then sweep <em>DH heat-pump retrofit</em>.
    </div>;
  }
  if (section === "export") {
    return <div className="notice">
      <strong>Export.</strong> Four players; State leads with export tax, JTF share, GO premium.
      Try: <em>Export hub 2040</em> preset, then sweep <em>Export tax</em> 0 → 20%.
    </div>;
  }
  return null;
}

function DataModal({ onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="btn ghost close" onClick={onClose}>✕</button>
        <h2>Data &amp; calibration</h2>
        <p>
          Parameters are calibrated to public ranges:
        </p>
        <ul style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.6 }}>
          <li><strong>IRENA 2024</strong> technology cost midpoints (PV, wind, BESS, electrolyser, biomass).</li>
          <li><strong>PVGIS</strong> solar resource for Kozani at 40.3°N (annual CF ≈ 0.19).</li>
          <li><strong>ENTSO-E</strong>-style typical Greek demand patterns; degree-day district heat.</li>
          <li><strong>EURO-CORDEX</strong> climate adjustments by RCP scenario.</li>
          <li><strong>JTF 2021–2027</strong> Western Macedonia allocation €1.6B.</li>
          <li><strong>GRITA</strong> Greece–Italy interconnection at 500 MW.</li>
        </ul>
        <p>
          Hourly profiles are <em>generated procedurally</em> with seeded RNGs to reflect realistic shapes
          — they are not from primary measurements. Geographic geometries (regional boundary, mine extents,
          Natura 2000) are simplified hand-drawn polygons. This is a research demonstrator, not a planning tool.
        </p>
        <p style={{ fontSize: 11, color: "var(--muted)" }}>
          Map tiles: © OpenStreetMap, © CartoDB.
        </p>
      </div>
    </div>
  );
}

// Mount
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);

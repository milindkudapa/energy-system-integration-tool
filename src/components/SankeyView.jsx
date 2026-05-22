// SankeyView — annual energy Sankey.
// Sources → buses → sinks. Recharts Sankey, light styling.

function SankeyView({ outcomes, profiles }) {
  if (!outcomes || !profiles) return null;

  // Annual energies in GWh (more legible than MWh).
  const ann = outcomes.annual;
  const cap = outcomes.capacities;

  // Source side
  const pvGWh   = (cap.pvMw  * profiles.meta.solar_cf_annual * 8760) / 1e3;
  const wndGWh  = (cap.wndMw * profiles.meta.wind_cf_annual  * 8760) / 1e3;
  const ligGWh  = (cap.ligniteMw * 0.55 * 8760) / 1e3;
  const impGWh  = ann.imp_twh * 1000;
  const expGWh  = ann.exp_twh * 1000;
  const curtGWh = ann.curt_twh * 1000;
  const demGWh  = ann.dem_twh * 1000;

  // Heat side: total heat demand, fraction electrified (subtracted from grid heat path),
  // and remainder served by lignite-waste-heat / boilers.
  const heatDemandGWh = profiles.meta.heat_gwh_yr;

  // Build node list
  const nodes = [
    { name: "PV" }, { name: "Wind" }, { name: "Lignite" }, { name: "Import" },          // 0..3
    { name: "Grid bus" },                                                                 // 4
    { name: "Electricity demand" }, { name: "Heat (electrified)" }, { name: "Storage loss" }, // 5,6,7
    { name: "Export" }, { name: "Curtailment" },                                          // 8,9
    { name: "Lignite waste-heat" }, { name: "Heat demand" },                              // 10,11
  ];

  // Compute electrified-heat fraction of demand
  const dhFrac = ((outcomes.economics && 0) || 0); // placeholder; we'll get from outcomes? not stored — recompute approx:
  // Approximate: gridHeat = dhFrac × heatDemand / COP. We can back-solve from electricity demand vs base:
  // But simpler: ask outcomes? we'll pass state via outcomes if needed.
  // For now derive from supplied props if present.
  const dhPct = outcomes.__state_dh_pct ?? 0;
  const heatElecGWh = heatDemandGWh * (dhPct / 100) / 3.0; // COP=3
  const heatLigniteGWh = heatDemandGWh * (1 - dhPct / 100);

  // Storage round-trip loss (rough): difference between charge & discharge.
  // From hourly.stor: discharge positive, charge negative. RT loss already baked into greedy pass.
  let chargeMWh = 0, dischMWh = 0;
  for (let i = 0; i < outcomes.hourly.stor.length; i++) {
    const v = outcomes.hourly.stor[i];
    if (v > 0) dischMWh += v; else chargeMWh += -v;
  }
  const storLossGWh = Math.max(0, (chargeMWh - dischMWh) / 1000);

  // Links — keep flows non-zero (add tiny epsilon so Sankey renders)
  const e = 0.001;
  const links = [
    // sources → grid bus
    { source: 0, target: 4, value: Math.max(e, pvGWh) },
    { source: 1, target: 4, value: Math.max(e, wndGWh) },
    { source: 2, target: 4, value: Math.max(e, ligGWh) },
    { source: 3, target: 4, value: Math.max(e, impGWh) },
    // grid bus → uses
    { source: 4, target: 5, value: Math.max(e, demGWh - heatElecGWh) },
    { source: 4, target: 6, value: Math.max(e, heatElecGWh) },
    { source: 4, target: 7, value: Math.max(e, storLossGWh) },
    { source: 4, target: 8, value: Math.max(e, expGWh) },
    { source: 4, target: 9, value: Math.max(e, curtGWh) },
    // lignite waste-heat
    { source: 10, target: 11, value: Math.max(e, heatLigniteGWh) },
    { source: 6, target: 11, value: Math.max(e, heatElecGWh) }, // (heat to demand)
    // pseudo source for lignite waste-heat node
    { source: 2, target: 10, value: Math.max(e, heatLigniteGWh * 0.1) }, // small visual representation
  ];

  const data = { nodes, links };

  return (
    <div className="sankey-wrap" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4, fontSize: 11, color: "var(--muted)" }}>
        <span>Annual energy flow, GWh</span>
        <div style={{ flex: 1 }} />
        <span className="pill">Generated {Math.round(pvGWh + wndGWh + ligGWh)} GWh</span>
        <span className="pill">Import {Math.round(impGWh)}</span>
        <span className="pill">Export {Math.round(expGWh)}</span>
        <span className="pill">Curtail {Math.round(curtGWh)}</span>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Recharts.ResponsiveContainer width="100%" height="100%">
          <Recharts.Sankey
            data={data}
            nodeWidth={10}
            nodePadding={22}
            margin={{ top: 18, right: 110, bottom: 12, left: 12 }}
            link={<SankeyLink />}
            node={<SankeyNode />}
            iterations={48}
          >
            <Recharts.Tooltip content={<SankeyTooltip />} />
          </Recharts.Sankey>
        </Recharts.ResponsiveContainer>
      </div>
    </div>
  );
}

const NODE_COLOR = {
  "PV": "#D4A017",
  "Wind": "#1F6FB1",
  "Lignite": "#44403C",
  "Import": "#B91C1C",
  "Grid bus": "#0F766E",
  "Electricity demand": "#18181B",
  "Heat (electrified)": "#B45309",
  "Storage loss": "#A1A1AA",
  "Export": "#0F766E",
  "Curtailment": "#A1A1AA",
  "Lignite waste-heat": "#78350F",
  "Heat demand": "#92400E",
};

function SankeyNode({ x, y, width, height, index, payload, containerWidth }) {
  const name = payload && payload.name;
  const c = NODE_COLOR[name] || "#71717A";
  // Decide whether to label on the right or above the node, based on x position.
  const isFar = containerWidth && (x + width > containerWidth - 90);
  const labelX = isFar ? x - 6 : x + width + 6;
  const anchor = isFar ? "end" : "start";
  return (
    <g>
      <rect x={x} y={y} width={width} height={Math.max(2, height)} fill={c} fillOpacity={0.95} />
      <text x={labelX} y={y + height / 2 + 3} fontSize={11} fill="#18181B" textAnchor={anchor}>{name}</text>
      <text x={labelX} y={y + height / 2 + 16} fontSize={10} fill="#71717A" textAnchor={anchor}>
        {Math.round(payload.value)} GWh
      </text>
    </g>
  );
}

function SankeyLink(props) {
  const { sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, payload } = props;
  const srcName = payload.source && payload.source.name;
  const tgtName = payload.target && payload.target.name;
  let c = "#0F766E";
  if (tgtName === "Curtailment") c = "#A1A1AA";
  else if (tgtName === "Export") c = "#0F766E";
  else if (tgtName === "Storage loss") c = "#A1A1AA";
  else if (srcName === "Lignite" || srcName === "Lignite waste-heat") c = "#44403C";
  else if (srcName === "PV") c = "#D4A017";
  else if (srcName === "Wind") c = "#1F6FB1";
  else if (srcName === "Import") c = "#B91C1C";
  return (
    <path
      d={`
        M${sourceX},${sourceY}
        C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}
      `}
      stroke={c}
      strokeWidth={Math.max(1, linkWidth)}
      strokeOpacity={0.45}
      fill="none"
    />
  );
}

function SankeyTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  if (p.source !== undefined && p.target !== undefined) {
    return (
      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", padding: "6px 10px", fontSize: 11 }}>
        <strong>{p.source.name} → {p.target.name}</strong>
        <div className="num">{Math.round(p.value)} GWh</div>
      </div>
    );
  }
  return null;
}

window.SankeyView = SankeyView;

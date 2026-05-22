// Controls — left pane. Sliders grouped by role.
// Phase-1 MVP slider set: PV, BESS, DH%, Electrolyser, Export tax,
// Climate, Gas price, Cost-vs-emissions weight, Risk aversion.
// Full catalogue is wired but most are exposed gradually.

const { useState } = React;

function Slider({ name, value, min, max, step, unit, fmt, onChange, locked, onLock, clamped, binding }) {
  const display = fmt ? fmt(value) : value.toString();
  return (
    <div className={"slider-row" + (clamped ? " clamped" : "")}>
      <div className="label-line">
        <button className={"lock" + (locked ? " locked" : "")} onClick={onLock} title={locked ? "Unlock" : "Pin during sweeps"}>
          {locked ? "●" : "○"}
        </button>
        <span className="label">{name}</span>
        <span className="value num">{display}{unit ? <span className="unit"> {unit}</span> : null}</span>
      </div>
      <div className="range-wrap">
        <input
          type="range" min={min} max={max} step={step} value={value}
          disabled={locked}
          onChange={(e) => onChange(parseFloat(e.target.value))}
        />
      </div>
      {clamped && binding ? <div className="binding">↑ clamped by {binding}</div> : null}
    </div>
  );
}

function Seg({ label, options, value, onChange }) {
  return (
    <div className="select-row">
      <div className="label">{label}</div>
      <div className="seg">
        {options.map((o) => (
          <button key={o} className={value === o ? "active" : ""} onClick={() => onChange(o)}>{o}</button>
        ))}
      </div>
    </div>
  );
}

function Group({ title, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="group">
      <div className={"group-header" + (open ? "" : " collapsed")} onClick={() => setOpen(!open)}>
        {title}
        <span className="chev">▾</span>
      </div>
      <div className={"group-body" + (open ? "" : " collapsed")}>
        {children}
      </div>
    </div>
  );
}

function Controls({ state, setState, locks, setLocks, section }) {
  const set = (k, v) => setState((s) => ({ ...s, [k]: v }));
  const lock = (k) => setLocks((l) => ({ ...l, [k]: !l[k] }));

  // Derive clamping: PV beyond zoning ceiling
  const zone = state.zoning_ceiling_gw || 3.0;
  const pvClamped = state.pv_gw > zone;

  return (
    <div>
      <Group title="Decisions · PPC / Developer">
        <Slider name="PV capacity" value={state.pv_gw} min={0} max={6} step={0.25} unit="GW"
                fmt={(v) => v.toFixed(2)}
                onChange={(v) => set("pv_gw", v)}
                locked={locks.pv_gw} onLock={() => lock("pv_gw")}
                clamped={pvClamped} binding={pvClamped ? `zoning ceiling ${zone} GW` : null} />
        <Slider name="Wind capacity" value={state.wind_gw} min={0} max={2} step={0.1} unit="GW"
                fmt={(v) => v.toFixed(1)}
                onChange={(v) => set("wind_gw", v)}
                locked={locks.wind_gw} onLock={() => lock("wind_gw")} />
        <Slider name="BESS" value={state.bess_gwh} min={0} max={3} step={0.25} unit="GWh"
                fmt={(v) => v.toFixed(2)}
                onChange={(v) => set("bess_gwh", v)}
                locked={locks.bess_gwh} onLock={() => lock("bess_gwh")} />
        <Slider name="Electrolyser" value={state.electrolyser_gw} min={0} max={2} step={0.1} unit="GW"
                fmt={(v) => v.toFixed(1)}
                onChange={(v) => set("electrolyser_gw", v)}
                locked={locks.electrolyser_gw} onLock={() => lock("electrolyser_gw")} />
        <Slider name="Retained lignite (condenser conv.)" value={state.retained_lignite_units} min={0} max={4} step={1} unit="units"
                fmt={(v) => v.toFixed(0)}
                onChange={(v) => set("retained_lignite_units", v)}
                locked={locks.retained_lignite_units} onLock={() => lock("retained_lignite_units")} />
      </Group>

      <Group title="Decisions · Municipality / State">
        <Slider name="DH heat-pump retrofit by 2035" value={state.dh_heat_pump_pct} min={0} max={100} step={10} unit="%"
                fmt={(v) => v.toFixed(0)}
                onChange={(v) => set("dh_heat_pump_pct", v)}
                locked={locks.dh_heat_pump_pct} onLock={() => lock("dh_heat_pump_pct")} />
        <Slider name="Zoning ceiling for PV" value={state.zoning_ceiling_gw ?? 3.0} min={0} max={4} step={0.25} unit="GW"
                fmt={(v) => v.toFixed(2)}
                onChange={(v) => set("zoning_ceiling_gw", v)}
                locked={locks.zoning_ceiling_gw} onLock={() => lock("zoning_ceiling_gw")} />
        <Slider name="EV chargers" value={state.ev_chargers ?? 100} min={0} max={500} step={50} unit=""
                fmt={(v) => v.toFixed(0)}
                onChange={(v) => set("ev_chargers", v)}
                locked={locks.ev_chargers} onLock={() => lock("ev_chargers")} />
        {section === "export" ? (
          <React.Fragment>
            <Slider name="Export tax" value={state.export_tax_pct} min={0} max={20} step={1} unit="%"
                    fmt={(v) => v.toFixed(0)}
                    onChange={(v) => set("export_tax_pct", v)}
                    locked={locks.export_tax_pct} onLock={() => lock("export_tax_pct")} />
            <Slider name="JTF share to export projects" value={state.jtf_share_export_pct ?? 30} min={0} max={100} step={10} unit="%"
                    fmt={(v) => v.toFixed(0)}
                    onChange={(v) => set("jtf_share_export_pct", v)}
                    locked={locks.jtf_share_export_pct} onLock={() => lock("jtf_share_export_pct")} />
          </React.Fragment>
        ) : null}
      </Group>

      <Group title="Decisions · IPTO / grid" defaultOpen={false}>
        <Slider name="Reinforcement budget" value={state.ipto_reinforcement_meur ?? 150} min={0} max={500} step={25} unit="€M"
                fmt={(v) => v.toFixed(0)}
                onChange={(v) => set("ipto_reinforcement_meur", v)}
                locked={locks.ipto_reinforcement_meur} onLock={() => lock("ipto_reinforcement_meur")} />
        <Slider name="Queue acceleration" value={state.ipto_queue_acceleration_months ?? 6} min={0} max={24} step={3} unit="months"
                fmt={(v) => v.toFixed(0)}
                onChange={(v) => set("ipto_queue_acceleration_months", v)}
                locked={locks.ipto_queue_acceleration_months} onLock={() => lock("ipto_queue_acceleration_months")} />
        <Slider name="Flexibility procurement" value={state.ipto_flex_procurement_mw ?? 100} min={0} max={500} step={50} unit="MW"
                fmt={(v) => v.toFixed(0)}
                onChange={(v) => set("ipto_flex_procurement_mw", v)}
                locked={locks.ipto_flex_procurement_mw} onLock={() => lock("ipto_flex_procurement_mw")} />
      </Group>

      {section === "export" ? (
        <Group title="Decisions · Offtaker" defaultOpen={false}>
          <Slider name="PPA volume" value={state.ppa_volume_twh_yr ?? 1.0} min={0} max={3} step={0.25} unit="TWh/yr"
                  fmt={(v) => v.toFixed(2)}
                  onChange={(v) => set("ppa_volume_twh_yr", v)}
                  locked={locks.ppa_volume_twh_yr} onLock={() => lock("ppa_volume_twh_yr")} />
          <Slider name="PPA duration" value={state.ppa_duration_yr ?? 15} min={5} max={25} step={5} unit="yr"
                  fmt={(v) => v.toFixed(0)}
                  onChange={(v) => set("ppa_duration_yr", v)}
                  locked={locks.ppa_duration_yr} onLock={() => lock("ppa_duration_yr")} />
          <Slider name="GO premium" value={state.go_premium_eur_mwh ?? 5} min={0} max={15} step={1} unit="€/MWh"
                  fmt={(v) => v.toFixed(0)}
                  onChange={(v) => set("go_premium_eur_mwh", v)}
                  locked={locks.go_premium_eur_mwh} onLock={() => lock("go_premium_eur_mwh")} />
        </Group>
      ) : null}

      <Group title="Uncertainties" defaultOpen={true}>
        <Seg label="Climate scenario" options={["RCP 2.6", "RCP 4.5", "RCP 8.5"]}
             value={state.climate} onChange={(v) => set("climate", v)} />
        <Seg label="Climate horizon year" options={[2030, 2040, 2050]}
             value={state.climate_horizon ?? 2040} onChange={(v) => set("climate_horizon", v)} />
        <Seg label="Gas price" options={["low", "central", "high", "shock"]}
             value={state.gas_price} onChange={(v) => set("gas_price", v)} />
        <Slider name="EU carbon price" value={state.eu_carbon_price_eur_t ?? 85} min={60} max={250} step={5} unit="€/t"
                fmt={(v) => v.toFixed(0)}
                onChange={(v) => set("eu_carbon_price_eur_t", v)}
                locked={locks.eu_carbon_price_eur_t} onLock={() => lock("eu_carbon_price_eur_t")} />
        <Slider name="Demand growth by 2035" value={state.demand_growth_2035_pct ?? 0} min={-10} max={40} step={5} unit="%"
                fmt={(v) => v >= 0 ? "+" + v.toFixed(0) : v.toFixed(0)}
                onChange={(v) => set("demand_growth_2035_pct", v)}
                locked={locks.demand_growth_2035_pct} onLock={() => lock("demand_growth_2035_pct")} />
        <Seg label="Tech cost trajectory" options={["low", "central", "high"]}
             value={state.tech_cost_trajectory ?? "central"} onChange={(v) => set("tech_cost_trajectory", v)} />
        <Slider name="Interconnection delay" value={state.interconnection_delay_yr ?? 0} min={0} max={7} step={1} unit="yr"
                fmt={(v) => v.toFixed(0)}
                onChange={(v) => set("interconnection_delay_yr", v)}
                locked={locks.interconnection_delay_yr} onLock={() => lock("interconnection_delay_yr")} />
        <Seg label="Wildfire frequency" options={["historical", "+50%", "+100%"]}
             value={state.wildfire_frequency ?? "historical"} onChange={(v) => set("wildfire_frequency", v)} />
      </Group>

      <Group title="Preferences" defaultOpen={false}>
        <Slider name="Cost vs Emissions weight" value={state.cost_emissions_weight} min={0} max={1} step={0.05} unit=""
                fmt={(v) => v.toFixed(2)}
                onChange={(v) => set("cost_emissions_weight", v)}
                locked={locks.cost_emissions_weight} onLock={() => lock("cost_emissions_weight")} />
        <Slider name="Jobs weight" value={state.jobs_weight ?? 0.3} min={0} max={1} step={0.05} unit=""
                fmt={(v) => v.toFixed(2)}
                onChange={(v) => set("jobs_weight", v)}
                locked={locks.jobs_weight} onLock={() => lock("jobs_weight")} />
        <Slider name="Local impact weight" value={state.local_impact_weight ?? 0.3} min={0} max={1} step={0.05} unit=""
                fmt={(v) => v.toFixed(2)}
                onChange={(v) => set("local_impact_weight", v)}
                locked={locks.local_impact_weight} onLock={() => lock("local_impact_weight")} />
        <Slider name="Export revenue weight" value={state.export_revenue_weight ?? 0.3} min={0} max={1} step={0.05} unit=""
                fmt={(v) => v.toFixed(2)}
                onChange={(v) => set("export_revenue_weight", v)}
                locked={locks.export_revenue_weight} onLock={() => lock("export_revenue_weight")} />
        <Slider name="Resilience weight" value={state.resilience_weight ?? 0.3} min={0} max={1} step={0.05} unit=""
                fmt={(v) => v.toFixed(2)}
                onChange={(v) => set("resilience_weight", v)}
                locked={locks.resilience_weight} onLock={() => lock("resilience_weight")} />
        <Slider name="Risk aversion (CVaR α)" value={state.risk_aversion} min={0.5} max={0.99} step={0.01} unit=""
                fmt={(v) => v.toFixed(2)}
                onChange={(v) => set("risk_aversion", v)}
                locked={locks.risk_aversion} onLock={() => lock("risk_aversion")} />
        <Slider name="Discount rate" value={state.discount_rate ?? 0.05} min={0.02} max={0.10} step={0.005} unit=""
                fmt={(v) => (v * 100).toFixed(1) + "%"}
                onChange={(v) => set("discount_rate", v)}
                locked={locks.discount_rate} onLock={() => lock("discount_rate")} />
      </Group>
    </div>
  );
}

window.Controls = Controls;

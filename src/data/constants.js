// Kozani Energy Systems Integration — hardcoded constants
// Values calibrated to public ranges: IRENA 2024 tech costs, public statements
// on Western Macedonia lignite phase-out, JTF allocation 2021–2027.
// Numbers flagged // illustrative are not from primary measurements.

(function () {
  const C = {};

  C.REGION = {
    name: "Western Macedonia / Kozani",
    centroid: { lat: 40.30, lon: 21.79 },
    full_phaseout_target_year: 2028,
  };

  C.PLANTS = [
    { name: "Agios Dimitrios", capacity_mw: 1587, status: "phase-out", fuel: "lignite", year_closure: 2028, lat: 40.40, lon: 21.95 },
    { name: "Ptolemaida V",    capacity_mw: 660,  status: "operating", fuel: "lignite", year_closure: 2028, lat: 40.50, lon: 21.71 },
    { name: "Meliti",          capacity_mw: 330,  status: "operating", fuel: "lignite", year_closure: 2028, lat: 40.79, lon: 21.71 },
    { name: "Kardia",          capacity_mw: 1200, status: "retired",   fuel: "lignite", year_closure: 2021, lat: 40.44, lon: 21.87 },
    { name: "Amyntaio",        capacity_mw: 600,  status: "retired",   fuel: "lignite", year_closure: 2020, lat: 40.65, lon: 21.66 },
  ];

  // IRENA 2024 midpoints — €/kW unless noted otherwise.
  C.TECH_COSTS_2024 = {
    pv:           { capex: 900,  opex_pct: 0.015, lifetime: 25, unit: "€/kW" },
    wind:         { capex: 1300, opex_pct: 0.020, lifetime: 25, unit: "€/kW" },
    bess:         { capex: 350,  opex_pct: 0.015, lifetime: 15, unit: "€/kWh" },
    pumped_hydro: { capex: 1500, opex_pct: 0.010, lifetime: 50, unit: "€/kW" },
    electrolyser: { capex: 1500, opex_pct: 0.025, lifetime: 20, unit: "€/kW" },
    heat_pump:    { capex: 800,  opex_pct: 0.015, lifetime: 20, unit: "€/kW" },
    biomass:      { capex: 2200, opex_pct: 0.040, lifetime: 25, unit: "€/kW" },
    condenser:    { capex: 250,  opex_pct: 0.020, lifetime: 25, unit: "€/kW" }, // lignite → synchronous condenser conversion
  };

  C.FUNDING = {
    jtf_western_macedonia_meur: 1600, // 2021–2027 allocation
  };

  C.DEMAND_ANCHORS = {
    electricity_twh_yr: 2.5,
    heat_gwh_yr: 400,
    peak_mw: 500,
    peak_heat_mwth: 150,
  };

  C.INTERCONNECTIONS = {
    grita_italy_mw: 500,
    bulgaria_mw: 600,
    north_macedonia_mw: 400,
    italy_premium_eur_mwh: 15,
  };

  // Fuel + carbon
  C.FUELS = {
    lignite:  { emission_factor_tco2_mwh: 1.10, fuel_cost_eur_mwh: 25 },  // approximate
    gas:      { emission_factor_tco2_mwh: 0.40, fuel_cost_eur_mwh: 70 },
    biomass:  { emission_factor_tco2_mwh: 0.05, fuel_cost_eur_mwh: 35 },
  };

  C.EU_CARBON_PRICE_DEFAULT_EUR_T = 85;

  // Jobs intensity — illustrative
  C.JOBS_PER_GW = {
    pv: 4500,
    wind: 3500,
    bess: 1200,        // per GWh installed
    biomass: 1500,
    electrolyser: 1800,
    retained_lignite_per_plant: 350,
  };

  // Uncertainty scenarios (multipliers applied to base profiles)
  C.SCENARIOS = {
    climate: {
      "RCP 2.6": { temp_offset_c: +0.8, wind_mult: 1.00, solar_mult: 1.00, demand_winter_mult: 0.95, demand_summer_mult: 1.05 },
      "RCP 4.5": { temp_offset_c: +1.5, wind_mult: 0.98, solar_mult: 1.01, demand_winter_mult: 0.92, demand_summer_mult: 1.12 },
      "RCP 8.5": { temp_offset_c: +3.0, wind_mult: 0.94, solar_mult: 1.02, demand_winter_mult: 0.85, demand_summer_mult: 1.30 },
    },
    gas_price: {
      "low":     { mult: 0.6 },
      "central": { mult: 1.0 },
      "high":    { mult: 1.7 },
      "shock":   { mult: 3.0 },
    },
  };

  // Presets
  C.PRESETS = {
    "Status quo": {
      pv_gw: 0.3,
      wind_gw: 0.2,
      bess_gwh: 0.1,
      electrolyser_gw: 0,
      dh_heat_pump_pct: 0,
      export_tax_pct: 0,
      climate: "RCP 4.5",
      gas_price: "central",
      cost_emissions_weight: 0.5,
      risk_aversion: 0.7,
      retained_lignite_units: 2,
      residual_lignite_mw: 1200, // Ag.D + Ptolemaida V partially loaded
    },
    "Self-sufficiency 2035": {
      pv_gw: 2.5,
      wind_gw: 0.6,
      bess_gwh: 1.25,
      electrolyser_gw: 0.2,
      dh_heat_pump_pct: 70,
      export_tax_pct: 0,
      climate: "RCP 4.5",
      gas_price: "central",
      cost_emissions_weight: 0.35,
      risk_aversion: 0.8,
      retained_lignite_units: 1,
      residual_lignite_mw: 0,
    },
    "Export hub 2040": {
      pv_gw: 4.5,
      wind_gw: 1.4,
      bess_gwh: 2.0,
      electrolyser_gw: 1.5,
      dh_heat_pump_pct: 50,
      export_tax_pct: 5,
      climate: "RCP 4.5",
      gas_price: "central",
      cost_emissions_weight: 0.35,
      risk_aversion: 0.6,
      retained_lignite_units: 1,
      residual_lignite_mw: 0,
    },
    "Robust baseline": {
      pv_gw: 2.0,
      wind_gw: 0.5,
      bess_gwh: 1.0,
      electrolyser_gw: 0.3,
      dh_heat_pump_pct: 50,
      export_tax_pct: 2,
      climate: "RCP 4.5",
      gas_price: "central",
      cost_emissions_weight: 0.4,
      risk_aversion: 0.9,
      retained_lignite_units: 1,
      residual_lignite_mw: 100,
    },
  };

  // Default state
  C.DEFAULT_STATE = { ...C.PRESETS["Status quo"] };

  // Augment defaults with any optional fields not present in the preset.
  Object.assign(C.DEFAULT_STATE, {
    // IPTO
    ipto_reinforcement_meur: 150,
    ipto_queue_acceleration_months: 6,
    ipto_flex_procurement_mw: 100,
    // Offtaker
    ppa_volume_twh_yr: 1.0,
    ppa_duration_yr: 15,
    go_premium_eur_mwh: 5,
    // Municipality / state extras
    jtf_share_export_pct: 30,
    ev_chargers: 100,
    // Uncertainties extras
    eu_carbon_price_eur_t: 85,
    demand_growth_2035_pct: 0,
    tech_cost_trajectory: "central",
    interconnection_delay_yr: 0,
    wildfire_frequency: "historical",
    climate_horizon: 2040,
    // Preferences extras
    emissions_weight: 0.5,
    jobs_weight: 0.3,
    local_impact_weight: 0.3,
    export_revenue_weight: 0.3,
    resilience_weight: 0.3,
  });

  // Annuity factor: capex × CRF(r, n)
  C.crf = function (r, n) {
    if (r === 0) return 1 / n;
    return (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  };

  window.KOZANI = window.KOZANI || {};
  window.KOZANI.constants = C;
})();

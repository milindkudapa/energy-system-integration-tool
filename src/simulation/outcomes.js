// Kozani — closed-form simulation layer
// Takes a `state` object + cached `profiles` and returns an `outcomes` object.
// All algebra; no LP, no iteration except a single forward pass for storage SOC.
// Target wall-clock: <50 ms for the full sweep.

(function () {
  const C = window.KOZANI.constants;

  // -------------------------------------------------------------------------
  // 1. Generation profile (hourly MW)
  // -------------------------------------------------------------------------
  function generation(state, profiles, climateMod) {
    const N = profiles.hours;
    const out = new Float32Array(N);
    const horizon = state.climate_horizon || 2040;
    const horizonShift = (horizon - 2040) / 30;
    const solarMult = 1 + ((climateMod.solar_mult ?? 1) - 1) * (1 + horizonShift);
    const windMult  = 1 + ((climateMod.wind_mult  ?? 1) - 1) * (1 + horizonShift);
    const pvMw   = state.pv_gw   * 1000;
    const wndMw  = state.wind_gw * 1000;
    const bioMw  = (state.biomass_mw || 0);
    const condenserMw = (state.retained_lignite_units || 0) * 660;
    const ligniteMw = residualLigniteMW(state);
    for (let h = 0; h < N; h++) {
      out[h] = pvMw  * profiles.solar_cf[h] * solarMult
             + wndMw * profiles.wind_cf[h]  * windMult
             + bioMw * 0.85
             + ligniteMw * 0.55;
    }
    return { hourly_mw: out, capacities: { pvMw, wndMw, bioMw, ligniteMw, condenserMw } };
  }

  // Residual operating lignite (NOT the condenser conversions).
  // MVP simplification: a single "residual_lignite_mw" slider isn't exposed, so 0.
  // Presets may set it; otherwise inferred from low new-build (status-quo proxy).
  function residualLigniteMW(state) {
    if (typeof state.residual_lignite_mw === "number") return state.residual_lignite_mw;
    return 0;
  }

  // -------------------------------------------------------------------------
  // 2. Demand profile (hourly MW) — electrified DH + EV
  // -------------------------------------------------------------------------
  function demand(state, profiles, climateMod) {
    const N = profiles.hours;
    const COP = 3.0;
    const dhFrac = (state.dh_heat_pump_pct || 0) / 100;
    const out = new Float32Array(N);
    const winterMult = climateMod.demand_winter_mult || 1;
    const summerMult = climateMod.demand_summer_mult || 1;
    const growth = 1 + (state.demand_growth_2035_pct || 0) / 100;
    // EVs: each charger ≈ 22 kW peak, avg ~3 kW = 0.003 MW continuous
    const evLoadMw = (state.ev_chargers || 0) * 0.003;
    for (let h = 0; h < N; h++) {
      const day = Math.floor(h / 24);
      const isWinter = (day < 80 || day > 300);
      const climMult = isWinter ? winterMult : summerMult;
      const heatElec = (profiles.heat_demand_mwth[h] * dhFrac) / COP;
      out[h] = ((profiles.elec_demand_mw[h] + heatElec) * climMult + evLoadMw) * growth;
    }
    return { hourly_mw: out };
  }

  // -------------------------------------------------------------------------
  // 3. Storage dispatch — single greedy pass over the year
  // -------------------------------------------------------------------------
  function storageDispatch(genArr, demArr, bessGWh, phsGWh) {
    const N = genArr.length;
    const E_cap = (bessGWh + phsGWh) * 1000; // MWh
    const P_cap = E_cap / 2; // C-rate ~0.5 — simple proxy for converter sizing
    const eta_rt = 0.88;
    const soc = new Float32Array(N);
    const flow = new Float32Array(N); // + = discharge, − = charge
    let s = E_cap * 0.5;
    for (let h = 0; h < N; h++) {
      const net = genArr[h] - demArr[h];
      if (net > 0) {
        // surplus -> charge
        const room = Math.min(P_cap, E_cap - s);
        const ch = Math.min(net, room);
        s += ch * Math.sqrt(eta_rt);
        flow[h] = -ch;
      } else {
        // deficit -> discharge
        const avail = Math.min(P_cap, s);
        const ds = Math.min(-net, avail);
        s -= ds / Math.sqrt(eta_rt);
        flow[h] = ds;
      }
      soc[h] = s;
    }
    return { soc, flow_mw: flow, e_cap_mwh: E_cap, p_cap_mw: P_cap };
  }

  // -------------------------------------------------------------------------
  // 4. Imports / exports / curtailment
  //    Exports allocate hourly across destinations in DESCENDING-PRICE order:
  //    Italy first (higher long-run premium), Bulgaria second. Total export
  //    cap is the sum of destination caps, scaled by IPTO reinforcement and
  //    interconnection delay.
  // -------------------------------------------------------------------------
  function balance(genArr, demArr, storFlow, importCapMw, exportDests) {
    const N = genArr.length;
    const imp = new Float32Array(N);
    const exp = new Float32Array(N);                              // total export per hour
    const expByDest = exportDests.map(() => new Float32Array(N)); // per-destination
    const curt = new Float32Array(N);
    let demandTot = 0, genTot = 0, impTot = 0, expTot = 0, curtTot = 0;
    const dPrices = exportDests.map((d) => d.prices);
    const dCaps   = exportDests.map((d) => d.cap_mw);
    const D = exportDests.length;
    // Reusable indices buffer for destination sort
    const idx = new Int8Array(D);
    for (let h = 0; h < N; h++) {
      const net = genArr[h] + storFlow[h] - demArr[h];
      demandTot += demArr[h];
      genTot += genArr[h];
      if (net < 0) {
        const got = Math.min(-net, importCapMw);
        imp[h] = got; impTot += got;
      } else if (net > 0) {
        // Sort destinations by price descending at this hour.
        for (let i = 0; i < D; i++) idx[i] = i;
        for (let i = 1; i < D; i++) {
          let j = i;
          while (j > 0 && dPrices[idx[j - 1]][h] < dPrices[idx[j]][h]) {
            const t = idx[j - 1]; idx[j - 1] = idx[j]; idx[j] = t; j--;
          }
        }
        let remaining = net;
        for (let i = 0; i < D; i++) {
          const di = idx[i];
          const send = Math.min(remaining, dCaps[di]);
          if (send > 0) {
            expByDest[di][h] = send;
            exp[h] += send;
            remaining -= send;
          }
        }
        expTot += exp[h];
        const c = remaining;
        if (c > 0) { curt[h] = c; curtTot += c; }
      }
    }
    return {
      hourly_import_mw: imp,
      hourly_export_mw: exp,
      hourly_export_by_dest_mw: expByDest,
      hourly_curtail_mw: curt,
      demand_mwh: demandTot,
      generation_mwh: genTot,
      imports_mwh: impTot,
      exports_mwh: expTot,
      curtailment_mwh: curtTot,
    };
  }

  // -------------------------------------------------------------------------
  // 5. Economics — annuitised capex + opex + fuel + imports − exports
  // -------------------------------------------------------------------------
  function economics(state, gen, bal, profiles) {
    const T = C.TECH_COSTS_2024;
    const r = (state.discount_rate || 0.05);
    const techMult = state.tech_cost_trajectory === "low" ? 0.75 :
                     state.tech_cost_trajectory === "high" ? 1.25 : 1.0;
    const capexAnnual =
        kw(state.pv_gw)      * T.pv.capex      * techMult * C.crf(r, T.pv.lifetime)
      + kw(state.wind_gw)    * T.wind.capex    * techMult * C.crf(r, T.wind.lifetime)
      + kwh(state.bess_gwh)  * T.bess.capex    * techMult * C.crf(r, T.bess.lifetime)
      + kw(state.electrolyser_gw) * T.electrolyser.capex * techMult * C.crf(r, T.electrolyser.lifetime)
      + (state.biomass_mw || 0) * 1000 * T.biomass.capex * C.crf(r, T.biomass.lifetime)
      + (state.retained_lignite_units || 0) * 660 * 1000 * T.condenser.capex * C.crf(r, T.condenser.lifetime);

    const opexAnnual =
        kw(state.pv_gw)      * T.pv.capex      * techMult * T.pv.opex_pct
      + kw(state.wind_gw)    * T.wind.capex    * techMult * T.wind.opex_pct
      + kwh(state.bess_gwh)  * T.bess.capex    * techMult * T.bess.opex_pct
      + kw(state.electrolyser_gw) * T.electrolyser.capex * techMult * T.electrolyser.opex_pct;

    // Residual fossil generation
    const ligniteMWh = gen.capacities.ligniteMw * 0.55 * profiles.hours;
    const fuelCost = ligniteMWh * C.FUELS.lignite.fuel_cost_eur_mwh;
    const carbonPrice = state.eu_carbon_price_eur_t ?? C.EU_CARBON_PRICE_DEFAULT_EUR_T;
    const carbonCost = ligniteMWh * C.FUELS.lignite.emission_factor_tco2_mwh * carbonPrice;

    let importCost = 0, exportRev = 0;
    const goPrem = state.go_premium_eur_mwh || 0;
    const tax = (state.export_tax_pct || 0) / 100;
    const expIt = bal.hourly_export_by_dest_mw ? bal.hourly_export_by_dest_mw[0] : null;
    const expBg = bal.hourly_export_by_dest_mw ? bal.hourly_export_by_dest_mw[1] : null;
    for (let h = 0; h < bal.hourly_import_mw.length; h++) {
      importCost += bal.hourly_import_mw[h] * profiles.price_gr_eur_mwh[h];
      if (expIt && expBg) {
        exportRev += expIt[h] * (profiles.price_it_eur_mwh[h] + goPrem) * (1 - tax);
        exportRev += expBg[h] * (profiles.price_bg_eur_mwh[h] + goPrem) * (1 - tax);
      } else {
        // backward-compat — should not occur after this refactor
        exportRev  += bal.hourly_export_mw[h] * (profiles.price_it_eur_mwh[h] + goPrem) * (1 - tax);
      }
    }
    const taxRevenue = 0; // computed below

    const totalCost = capexAnnual + opexAnnual + fuelCost + carbonCost + importCost - exportRev;
    return {
      capex_annual_eur: capexAnnual,
      opex_annual_eur: opexAnnual,
      fuel_cost_eur: fuelCost,
      carbon_cost_eur: carbonCost,
      import_cost_eur: importCost,
      export_revenue_eur: exportRev,
      system_cost_eur: totalCost,
      lignite_mwh: ligniteMWh,
    };
  }

  // -------------------------------------------------------------------------
  // 6. State export-tax revenue — sums over BOTH destinations.
  // -------------------------------------------------------------------------
  function exportTaxRevenue(state, bal, profiles) {
    const tax = (state.export_tax_pct || 0) / 100;
    if (tax <= 0) return 0;
    let r = 0;
    const expIt = bal.hourly_export_by_dest_mw ? bal.hourly_export_by_dest_mw[0] : null;
    const expBg = bal.hourly_export_by_dest_mw ? bal.hourly_export_by_dest_mw[1] : null;
    const goPrem = state.go_premium_eur_mwh || 0;
    for (let h = 0; h < bal.hourly_export_mw.length; h++) {
      if (expIt && expBg) {
        r += expIt[h] * (profiles.price_it_eur_mwh[h] + goPrem) * tax;
        r += expBg[h] * (profiles.price_bg_eur_mwh[h] + goPrem) * tax;
      } else {
        r += bal.hourly_export_mw[h] * (profiles.price_it_eur_mwh[h] + goPrem) * tax;
      }
    }
    return r;
  }

  // -------------------------------------------------------------------------
  // 7. Emissions
  // -------------------------------------------------------------------------
  function emissions(state, gen, bal, profiles) {
    const lig = gen.capacities.ligniteMw * 0.55 * profiles.hours; // MWh
    const tonsLignite = lig * C.FUELS.lignite.emission_factor_tco2_mwh;
    // imports carry a marginal grid factor (Greek mix proxy ~0.35 tCO2/MWh)
    const tonsImport = bal.imports_mwh * 0.35;
    return { tco2_yr: tonsLignite + tonsImport };
  }

  // -------------------------------------------------------------------------
  // 8. Jobs (linear)
  // -------------------------------------------------------------------------
  function jobs(state) {
    const J = C.JOBS_PER_GW;
    return Math.round(
        state.pv_gw   * J.pv
      + state.wind_gw * J.wind
      + state.bess_gwh* J.bess
      + state.electrolyser_gw * J.electrolyser
      + (state.biomass_mw || 0) / 1000 * J.biomass
      + (state.retained_lignite_units || 0) * J.retained_lignite_per_plant
    );
  }

  // -------------------------------------------------------------------------
  // 9. Local impact score (0–1, higher = better)
  // -------------------------------------------------------------------------
  function localImpactScore(state) {
    const zoneCap = state.zoning_ceiling_gw || 3.0;
    const used = state.pv_gw + state.wind_gw * 0.4;
    const zoneUtil = Math.min(1, used / zoneCap); // overshoot caps at 1
    const overshoot = Math.max(0, used - zoneCap) / Math.max(1e-6, zoneCap);
    // Mine reuse: presume PV deploys onto mine land first; reward higher PV.
    const mineReuse = Math.min(1, state.pv_gw / 3.0);
    const dhBonus = (state.dh_heat_pump_pct || 0) / 100 * 0.3;
    let score = 0.4 * (1 - overshoot) + 0.4 * mineReuse + 0.2 * dhBonus;
    score = Math.max(0, Math.min(1, score));
    return score;
  }

  // -------------------------------------------------------------------------
  // 10. H2 production (kt/yr)
  // -------------------------------------------------------------------------
  function h2Production(state, gen, bal, profiles) {
    if (!state.electrolyser_gw) return { kt_yr: 0, util: 0, lcoh_eur_kg: null };
    const cap = state.electrolyser_gw * 1000; // MW
    const eff = 0.7; // MWh_H2 / MWh_elec, LHV
    let mwhElec = 0;
    // soak up surplus (curtailment) + some at-the-margin
    for (let h = 0; h < bal.hourly_curtail_mw.length; h++) {
      const e = Math.min(cap, bal.hourly_curtail_mw[h]);
      mwhElec += e;
    }
    const mwhH2 = mwhElec * eff;
    const kgH2 = mwhH2 * 1000 / 33.3; // 33.3 kWh/kg LHV
    const ktyr = kgH2 / 1e6;
    const util = mwhElec / (cap * 8760);
    // LCoH approximate
    const capex = cap * 1000 * C.TECH_COSTS_2024.electrolyser.capex;
    const annual = capex * C.crf(0.05, 20) + capex * C.TECH_COSTS_2024.electrolyser.opex_pct;
    const elecCost = mwhElec * 30; // €/MWh surplus power proxy
    const lcoh = kgH2 > 0 ? (annual + elecCost) / kgH2 : null;
    return { kt_yr: ktyr, util, lcoh_eur_kg: lcoh };
  }

  // -------------------------------------------------------------------------
  // 11. Inertia floor check
  // -------------------------------------------------------------------------
  function inertia(state) {
    // synchronous machines: condenser conversions + biomass + assumed small hydro
    const synMw = (state.retained_lignite_units || 0) * 660
                + (state.biomass_mw || 0)
                + 100; // assumed small hydro baseline
    return { synchronous_mw: synMw, below_floor: synMw < 300 };
  }

  // -------------------------------------------------------------------------
  // 12. Top-level orchestrator
  // -------------------------------------------------------------------------
  function outcomes(state, profiles) {
    const clim = (C.SCENARIOS.climate[state.climate] || {});
    const gas = (C.SCENARIOS.gas_price[state.gas_price] || { mult: 1 });
    const gen = generation(state, profiles, clim);
    const dem = demand(state, profiles, clim);

    const stor = storageDispatch(gen.hourly_mw, dem.hourly_mw, state.bess_gwh || 0, state.phs_gwh || 0);
    const importCap = C.INTERCONNECTIONS.grita_italy_mw
                    + C.INTERCONNECTIONS.bulgaria_mw
                    + C.INTERCONNECTIONS.north_macedonia_mw;
    // IPTO reinforcement adds linear capacity per €25M, cap +500 MW.
    const reinforcementBonus = Math.min(500, (state.ipto_reinforcement_meur || 0) * 2);
    // Interconnection delay scales caps down for the projection horizon.
    const delayMult = Math.max(0.3, 1 - (state.interconnection_delay_yr || 0) / 10);
    // Reinforcement bonus splits between the two export destinations
    // proportionally to their nameplate capacity (Italy 500 / Bulgaria 600 → 5/11 and 6/11).
    const totalNameplate = C.INTERCONNECTIONS.grita_italy_mw + C.INTERCONNECTIONS.bulgaria_mw;
    const reinfIt = reinforcementBonus * (C.INTERCONNECTIONS.grita_italy_mw / totalNameplate);
    const reinfBg = reinforcementBonus * (C.INTERCONNECTIONS.bulgaria_mw    / totalNameplate);
    const effImportCap = (importCap + reinforcementBonus) * delayMult;
    const exportDests = [
      { name: "italy",    cap_mw: (C.INTERCONNECTIONS.grita_italy_mw + reinfIt) * delayMult, prices: profiles.price_it_eur_mwh },
      { name: "bulgaria", cap_mw: (C.INTERCONNECTIONS.bulgaria_mw    + reinfBg) * delayMult, prices: profiles.price_bg_eur_mwh },
    ];
    const bal = balance(gen.hourly_mw, dem.hourly_mw, stor.flow_mw, effImportCap, exportDests);

    const econ = economics(state, gen, bal, profiles);
    // Fuel cost adjusted by gas multiplier
    econ.fuel_cost_eur *= gas.mult;
    econ.system_cost_eur += econ.fuel_cost_eur * (gas.mult - 1);

    const emi = emissions(state, gen, bal, profiles);
    const jb  = jobs(state);
    const loc = localImpactScore(state);
    const h2  = h2Production(state, gen, bal, profiles);
    const ine = inertia(state);
    const taxRev = exportTaxRevenue(state, bal, profiles);

    const selfSuff = 1 - bal.imports_mwh / Math.max(1, bal.demand_mwh);
    // Per-destination annual export totals (TWh)
    let exp_italy_twh = 0, exp_bulgaria_twh = 0;
    if (bal.hourly_export_by_dest_mw) {
      const it = bal.hourly_export_by_dest_mw[0];
      const bg = bal.hourly_export_by_dest_mw[1];
      for (let h = 0; h < it.length; h++) {
        exp_italy_twh    += it[h];
        exp_bulgaria_twh += bg[h];
      }
      exp_italy_twh    /= 1e6;
      exp_bulgaria_twh /= 1e6;
    }
    return {
      profiles_meta: profiles.meta,
      capacities: gen.capacities,
      export_caps: { italy_mw: exportDests[0].cap_mw, bulgaria_mw: exportDests[1].cap_mw },
      hourly: {
        gen: gen.hourly_mw,
        dem: dem.hourly_mw,
        stor: stor.flow_mw,
        imp: bal.hourly_import_mw,
        exp: bal.hourly_export_mw,
        exp_italy: bal.hourly_export_by_dest_mw ? bal.hourly_export_by_dest_mw[0] : null,
        exp_bulgaria: bal.hourly_export_by_dest_mw ? bal.hourly_export_by_dest_mw[1] : null,
        curt: bal.hourly_curtail_mw,
        soc: stor.soc,
      },
      annual: {
        gen_twh: bal.generation_mwh / 1e6,
        dem_twh: bal.demand_mwh / 1e6,
        imp_twh: bal.imports_mwh / 1e6,
        exp_twh: bal.exports_mwh / 1e6,
        exp_italy_twh,
        exp_bulgaria_twh,
        curt_twh: bal.curtailment_mwh / 1e6,
      },
      economics: econ,
      emissions: emi,
      jobs: jb,
      local_impact: loc,
      self_sufficiency: selfSuff,
      h2,
      inertia: ine,
      export_tax_revenue_eur: taxRev,
      stor_meta: { e_cap_mwh: stor.e_cap_mwh, p_cap_mw: stor.p_cap_mw },
    };
  }

  // Robust ensemble across climate × gas combos
  function robustEnsemble(state, profiles, climates, gasPrices) {
    const out = [];
    for (const c of climates) {
      for (const g of gasPrices) {
        const s = { ...state, climate: c, gas_price: g };
        const o = outcomes(s, profiles);
        out.push({
          climate: c, gas_price: g,
          system_cost_eur: o.economics.system_cost_eur,
          self_sufficiency: o.self_sufficiency,
          emissions_tco2: o.emissions.tco2_yr,
        });
      }
    }
    return out;
  }

  function kw(gw)  { return gw * 1e6; }    // GW → kW
  function kwh(gwh){ return gwh * 1e6; }   // GWh → kWh

  window.KOZANI = window.KOZANI || {};
  window.KOZANI.simulation = {
    generation, demand, storageDispatch, balance, economics,
    exportTaxRevenue, emissions, jobs, localImpactScore, h2Production, inertia,
    outcomes, robustEnsemble,
  };
})();

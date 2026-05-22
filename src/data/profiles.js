// Kozani — procedural hourly profiles
// All 8,760-hour arrays generated deterministically at app mount.
// Seeded RNG so reloads produce identical traces.
// Calibrated to: PVGIS-like solar CF ≈ 0.19 at 40.3°N, regional wind CF ≈ 0.25,
// ENTSO-E-style demand shape, EURO-CORDEX temperature pattern for Western Macedonia.
// Profiles are illustrative — not from primary measurements.

(function () {
  const HOURS = 8760;
  const TAU = Math.PI * 2;

  // Deterministic Mulberry32 RNG
  function rng(seed) {
    let t = seed >>> 0;
    return function () {
      t = (t + 0x6D2B79F5) >>> 0;
      let r = t;
      r = Math.imul(r ^ (r >>> 15), r | 1);
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // AR(1) noise: x_t = phi * x_{t-1} + sigma * eps_t
  function ar1(n, phi, sigma, seed) {
    const r = rng(seed);
    const out = new Float32Array(n);
    let x = 0;
    for (let i = 0; i < n; i++) {
      // Box–Muller-ish: combine two uniforms for rough normal
      const u1 = Math.max(1e-6, r());
      const u2 = r();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(TAU * u2);
      x = phi * x + sigma * z;
      out[i] = x;
    }
    return out;
  }

  function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }

  // ----- Solar capacity factor ---------------------------------------------
  // seasonal(day) × diurnal(hour), scaled to annual mean ≈ 0.19.
  function solarProfile() {
    const out = new Float32Array(HOURS);
    const noise = ar1(HOURS, 0.5, 0.15, 1001);
    for (let h = 0; h < HOURS; h++) {
      const day = Math.floor(h / 24);
      const hour = h % 24;
      // peak day-of-year ≈ 172 (summer solstice)
      const seasonal = 0.55 + 0.45 * Math.cos((day - 172) / 365 * TAU);
      // diurnal: zero from ~6pm to ~6am, sinusoid otherwise
      const arg = ((hour - 12) / 12) * (Math.PI / 2);
      const diurnal = clamp(Math.cos(arg) * 1.05 - 0.05, 0, 1);
      // cloud variability via AR(1)
      const cloud = clamp(1 + 0.4 * noise[h], 0.2, 1.4);
      out[h] = clamp(seasonal * diurnal * cloud, 0, 1);
    }
    // Normalise to annual CF = 0.19
    rescaleToMean(out, 0.19);
    return out;
  }

  // ----- Wind capacity factor ----------------------------------------------
  // Mildly anti-correlated with solar; AR(1) persistence ~0.85; mean 0.25.
  function windProfile(solar) {
    const out = new Float32Array(HOURS);
    const persistent = ar1(HOURS, 0.85, 0.3, 2002);
    for (let h = 0; h < HOURS; h++) {
      const day = Math.floor(h / 24);
      // winter slightly windier
      const seasonal = 0.6 + 0.4 * Math.cos((day - 15) / 365 * TAU) * 0.5;
      const base = seasonal + 0.4 * persistent[h];
      // mild anti-correlation with solar
      const antiSolar = 1 - 0.25 * (solar[h] - 0.2);
      out[h] = clamp(base * antiSolar, 0, 1);
    }
    rescaleToMean(out, 0.25);
    return out;
  }

  // ----- Outdoor temperature -----------------------------------------------
  // Annual mean 13°C, amplitude 12°C, mild diurnal (~6°C), AR(1) noise.
  function temperatureProfile() {
    const out = new Float32Array(HOURS);
    const noise = ar1(HOURS, 0.9, 1.2, 3003);
    for (let h = 0; h < HOURS; h++) {
      const day = Math.floor(h / 24);
      const hour = h % 24;
      // coldest mid-January (day ≈ 15), hottest early August (day ≈ 215)
      const seasonal = 13 - 12 * Math.cos((day - 215) / 365 * TAU);
      const diurnal = -3 * Math.cos((hour - 15) / 24 * TAU);
      out[h] = seasonal + diurnal + noise[h];
    }
    return out;
  }

  // ----- Electricity demand (MW) -------------------------------------------
  // Peak ~500 MW, annual ~2.5 TWh; base + winter heat + summer cool +
  // daily double peak + weekday/weekend pattern.
  function electricityDemandProfile(temperature) {
    const out = new Float32Array(HOURS);
    for (let h = 0; h < HOURS; h++) {
      const day = Math.floor(h / 24);
      const hour = h % 24;
      const dow = (day + 4) % 7; // 0 = Mon assumption
      const isWeekend = dow >= 5;
      const T = temperature[h];
      // heating below 16 °C, cooling above 22 °C
      const heat = Math.max(0, 16 - T) * 4;   // MW per °C
      const cool = Math.max(0, T - 22) * 6;
      // double daily peak around 8h and 19h
      const dailyShape = 1
        + 0.35 * Math.exp(-Math.pow((hour - 8) / 2.5, 2))
        + 0.45 * Math.exp(-Math.pow((hour - 19) / 2.5, 2))
        - 0.20 * Math.exp(-Math.pow((hour - 4) / 2.0, 2));
      const base = 220 * dailyShape * (isWeekend ? 0.88 : 1.0);
      out[h] = base + heat + cool;
    }
    // Calibrate to ~2.5 TWh/yr
    rescaleToSum(out, 2.5e6); // MWh = TWh × 1e6
    return out;
  }

  // ----- District heat demand (MWth) ---------------------------------------
  // Degree-day model with 18 °C balance temperature; calibrated to 400 GWh/yr.
  function heatDemandProfile(temperature) {
    const out = new Float32Array(HOURS);
    for (let h = 0; h < HOURS; h++) {
      const T = temperature[h];
      out[h] = Math.max(0, 18 - T) * 8 + 5; // MWth; slope tuned, base of 5 MW
    }
    rescaleToSum(out, 400e3); // MWh_th = GWh × 1e3
    return out;
  }

  // ----- Day-ahead price (€/MWh) -------------------------------------------
  // Base + scarcity premium when residual demand high; mild midday-summer dip.
  function priceProfile(demand, solar, wind) {
    const out = new Float32Array(HOURS);
    const renewMW = 800; // proxy "typical" renewables in system
    for (let h = 0; h < HOURS; h++) {
      const day = Math.floor(h / 24);
      const hour = h % 24;
      const residual = demand[h] - renewMW * (0.6 * solar[h] + 0.4 * wind[h]);
      const summer = (day > 120 && day < 270);
      const midday = (hour >= 10 && hour <= 15);
      let p = 70 + 0.08 * Math.max(0, residual);
      if (summer && midday) p -= 12;
      out[h] = clamp(p, 20, 400);
    }
    rescaleToMean(out, 100);
    return out;
  }

  // ----- Italy price (€/MWh) — Greek price + €15 + stochastic --------------
  function italyPriceProfile(greekPrice) {
    const out = new Float32Array(HOURS);
    const noise = ar1(HOURS, 0.7, 8, 5005);
    for (let h = 0; h < HOURS; h++) {
      out[h] = greekPrice[h] + 15 + noise[h];
      if (out[h] < 10) out[h] = 10;
    }
    return out;
  }

  // Utilities
  function rescaleToMean(arr, target) {
    let s = 0;
    for (let i = 0; i < arr.length; i++) s += arr[i];
    const mean = s / arr.length;
    if (mean === 0) return;
    const k = target / mean;
    for (let i = 0; i < arr.length; i++) arr[i] *= k;
  }
  function rescaleToSum(arr, target) {
    let s = 0;
    for (let i = 0; i < arr.length; i++) s += arr[i];
    if (s === 0) return;
    const k = target / s;
    for (let i = 0; i < arr.length; i++) arr[i] *= k;
  }

  // Build everything once
  function build() {
    const solar = solarProfile();
    const wind = windProfile(solar);
    const temp = temperatureProfile();
    const elec = electricityDemandProfile(temp);
    const heat = heatDemandProfile(temp);
    const priceGr = priceProfile(elec, solar, wind);
    const priceIt = italyPriceProfile(priceGr);
    return {
      hours: HOURS,
      solar_cf: solar,
      wind_cf: wind,
      temperature_c: temp,
      elec_demand_mw: elec,
      heat_demand_mwth: heat,
      price_gr_eur_mwh: priceGr,
      price_it_eur_mwh: priceIt,
      meta: {
        solar_cf_annual: avg(solar),
        wind_cf_annual: avg(wind),
        temperature_c_annual: avg(temp),
        elec_twh_yr: sum(elec) / 1e6,
        heat_gwh_yr: sum(heat) / 1e3,
        price_gr_mean: avg(priceGr),
        price_it_mean: avg(priceIt),
      },
    };
  }
  function sum(a) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; }
  function avg(a) { return sum(a) / a.length; }

  window.KOZANI = window.KOZANI || {};
  window.KOZANI.profiles = { build, _internal: { rng, ar1 } };
})();

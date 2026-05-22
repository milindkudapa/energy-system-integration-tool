// Kozani — illustrative geographic geometry
// Approximate, hand-drawn polygons; not for spatial analysis.
// All coordinates are [lon, lat] (GeoJSON convention).

(function () {
  const G = {};

  // Regional boundary — Western Macedonia / Kozani area, ~20–30 vertices.
  G.region = {
    type: "Feature",
    properties: { name: "Kozani / Western Macedonia (illustrative)" },
    geometry: {
      type: "Polygon",
      coordinates: [[
        [21.20, 40.95], [21.35, 41.05], [21.55, 41.10], [21.75, 41.05],
        [21.95, 40.95], [22.10, 40.85], [22.18, 40.65], [22.15, 40.45],
        [22.05, 40.25], [21.95, 40.10], [21.78, 40.00], [21.55, 39.95],
        [21.35, 40.02], [21.18, 40.15], [21.05, 40.35], [21.00, 40.55],
        [21.05, 40.75], [21.20, 40.95]
      ]],
    },
  };

  // Settlements
  G.settlements = {
    type: "FeatureCollection",
    features: [
      pt("Kozani",      21.79, 40.30, { type: "city", pop: 41000 }),
      pt("Ptolemaida",  21.68, 40.51, { type: "city", pop: 30000 }),
      pt("Amyntaio",    21.69, 40.69, { type: "town", pop: 4000  }),
      pt("Florina",     21.41, 40.78, { type: "town", pop: 17000 }),
      pt("Siatista",    21.55, 40.26, { type: "town", pop: 5500  }),
    ],
  };

  // Retired / phase-out plant sites (point features carrying status)
  G.plants = {
    type: "FeatureCollection",
    features: [
      pt("Agios Dimitrios", 21.95, 40.40, { status: "phase-out", capacity_mw: 1587 }),
      pt("Ptolemaida V",    21.71, 40.50, { status: "operating", capacity_mw: 660  }),
      pt("Meliti",          21.71, 40.79, { status: "operating", capacity_mw: 330  }),
      pt("Kardia",          21.87, 40.44, { status: "retired",   capacity_mw: 1200 }),
      pt("Amyntaio",        21.66, 40.65, { status: "retired",   capacity_mw: 600  }),
    ],
  };

  // Mine extents — 4 simplified polygons (South Field, Kardia, Amyntaio, Ptolemaida pits)
  // Hand-drawn, illustrative only.
  G.mines = {
    type: "FeatureCollection",
    features: [
      poly("South Field", [
        [21.92, 40.36], [21.99, 40.36], [22.02, 40.34], [22.00, 40.30],
        [21.95, 40.28], [21.90, 40.30], [21.89, 40.33], [21.92, 40.36]
      ], { reclaim_ha: 3500 }),
      poly("Kardia pit", [
        [21.83, 40.46], [21.90, 40.47], [21.92, 40.44], [21.90, 40.41],
        [21.84, 40.41], [21.81, 40.43], [21.83, 40.46]
      ], { reclaim_ha: 2200 }),
      poly("Amyntaio pit", [
        [21.62, 40.67], [21.68, 40.68], [21.71, 40.66], [21.70, 40.62],
        [21.64, 40.61], [21.60, 40.63], [21.62, 40.67]
      ], { reclaim_ha: 2100 }),
      poly("Ptolemaida pit", [
        [21.66, 40.54], [21.72, 40.55], [21.76, 40.53], [21.75, 40.49],
        [21.69, 40.48], [21.64, 40.50], [21.66, 40.54]
      ], { reclaim_ha: 2200 }),
    ],
  };

  // Natura 2000 exclusion zones — 2 illustrative polygons.
  G.natura2000 = {
    type: "FeatureCollection",
    features: [
      poly("Vermio (illustrative)", [
        [22.05, 40.55], [22.15, 40.60], [22.18, 40.50], [22.12, 40.42],
        [22.04, 40.45], [22.02, 40.51], [22.05, 40.55]
      ], {}),
      poly("Vourinos (illustrative)", [
        [21.60, 40.15], [21.70, 40.18], [21.75, 40.12], [21.72, 40.05],
        [21.62, 40.04], [21.56, 40.09], [21.60, 40.15]
      ], {}),
    ],
  };

  // Substations — 6 points (400/150 kV).
  G.substations = {
    type: "FeatureCollection",
    features: [
      pt("Kardia SS",         21.87, 40.45, { kv: 400 }),
      pt("Ag. Dimitrios SS",  21.94, 40.39, { kv: 400 }),
      pt("Ptolemaida SS",     21.71, 40.51, { kv: 400 }),
      pt("Amyntaio SS",       21.67, 40.66, { kv: 150 }),
      pt("Meliti SS",         21.72, 40.79, { kv: 400 }),
      pt("Kozani SS",         21.80, 40.31, { kv: 150 }),
    ],
  };

  // District-heating network — schematic line segments only.
  G.district_heating = {
    type: "FeatureCollection",
    features: [
      line("DH trunk Kardia → Kozani", [[21.87, 40.44], [21.84, 40.38], [21.80, 40.31]]),
      line("DH trunk Ag.D. → Ptolemaida", [[21.94, 40.39], [21.85, 40.45], [21.74, 40.51]]),
    ],
  };

  // Interconnection corridors — schematic arrows out of region.
  G.interconnections = {
    type: "FeatureCollection",
    features: [
      line("GRITA → Italy (via Florina corridor)", [[21.80, 40.32], [21.30, 40.50], [20.30, 40.20], [18.50, 40.50]],
            { capacity_mw: 500, label: "GRITA / Italy" }),
      line("Greece ↔ Bulgaria",                    [[21.80, 40.32], [22.50, 41.00], [23.50, 41.40]],
            { capacity_mw: 600, label: "Bulgaria" }),
      line("Greece ↔ North Macedonia",             [[21.80, 40.32], [21.70, 41.00], [21.50, 41.50]],
            { capacity_mw: 400, label: "N. Macedonia" }),
    ],
  };

  // Helpers
  function pt(name, lon, lat, extra) {
    return { type: "Feature", properties: { name, ...(extra || {}) }, geometry: { type: "Point", coordinates: [lon, lat] } };
  }
  function poly(name, ring, extra) {
    return { type: "Feature", properties: { name, ...(extra || {}) }, geometry: { type: "Polygon", coordinates: [ring] } };
  }
  function line(name, coords, extra) {
    return { type: "Feature", properties: { name, ...(extra || {}) }, geometry: { type: "LineString", coordinates: coords } };
  }

  window.KOZANI = window.KOZANI || {};
  window.KOZANI.geography = G;
})();

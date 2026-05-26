// MapView — MapLibre + hardcoded GeoJSON.
// Free public raster style (no Mapbox tokens).
// Shows: regional boundary, mines, retired plants, substations, DH lines,
// Natura 2000 exclusions, settlements; capacity placement overlay sized to slider.

const { useEffect: _useEffect_map, useRef: _useRef_map } = React;

const MAP_STYLE = {
  version: 8,
  // OpenStreetMap tiles — CORS-enabled, no key required, OK for a research demo.
  sources: {
    "osm-raster": {
      type: "raster",
      tiles: [
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#F0EFEA" } },
    { id: "osm", type: "raster", source: "osm-raster",
      paint: { "raster-opacity": 0.55, "raster-saturation": -0.7, "raster-brightness-max": 0.95 } },
  ],
};

function MapView({ state, outcomes, mode }) {
  const ref = _useRef_map(null);
  const mapRef = _useRef_map(null);
  const G = window.KOZANI.geography;

  _useEffect_map(() => {
    if (!ref.current) return;
    if (mapRef.current) return; // init once

    const map = new maplibregl.Map({
      container: ref.current,
      style: MAP_STYLE,
      center: [21.79, 40.45],
      zoom: 8.4,
      attributionControl: { compact: true },
      cooperativeGestures: false,
    });
    mapRef.current = map;

    map.on("load", () => {
      // region
      map.addSource("region", { type: "geojson", data: G.region });
      map.addLayer({
        id: "region-fill", type: "fill", source: "region",
        paint: { "fill-color": "#0F766E", "fill-opacity": 0.04 },
      });
      map.addLayer({
        id: "region-line", type: "line", source: "region",
        paint: { "line-color": "#0F766E", "line-width": 1.5, "line-dasharray": [3, 2], "line-opacity": 0.55 },
      });

      // natura 2000
      map.addSource("natura", { type: "geojson", data: G.natura2000 });
      map.addLayer({
        id: "natura-fill", type: "fill", source: "natura",
        paint: { "fill-color": "#166534", "fill-opacity": 0.16 },
      });
      map.addLayer({
        id: "natura-line", type: "line", source: "natura",
        paint: { "line-color": "#166534", "line-width": 1, "line-opacity": 0.5 },
      });

      // mines
      map.addSource("mines", { type: "geojson", data: G.mines });
      map.addLayer({
        id: "mines-fill", type: "fill", source: "mines",
        paint: { "fill-color": "#A16207", "fill-opacity": 0.35 },
      });
      map.addLayer({
        id: "mines-line", type: "line", source: "mines",
        paint: { "line-color": "#78350F", "line-width": 0.6, "line-opacity": 0.6 },
      });

      // DH lines
      map.addSource("dh", { type: "geojson", data: G.district_heating });
      map.addLayer({
        id: "dh-line", type: "line", source: "dh",
        paint: { "line-color": "#B45309", "line-width": 1.6, "line-dasharray": [2, 1.5], "line-opacity": 0.7 },
      });

      // interconnections
      map.addSource("intercon", { type: "geojson", data: G.interconnections });
      map.addLayer({
        id: "intercon-line", type: "line", source: "intercon",
        paint: { "line-color": "#0F766E", "line-width": 1.2, "line-dasharray": [4, 3], "line-opacity": 0.55 },
      });

      // substations
      map.addSource("subs", { type: "geojson", data: G.substations });
      map.addLayer({
        id: "subs-pt", type: "circle", source: "subs",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "kv"], 150, 4, 400, 6],
          "circle-color": "#fff",
          "circle-stroke-color": "#18181B",
          "circle-stroke-width": 1.5,
        },
      });

      // settlements
      map.addSource("settle", { type: "geojson", data: G.settlements });
      map.addLayer({
        id: "settle-pt", type: "circle", source: "settle",
        paint: {
          "circle-radius": ["case", ["==", ["get", "type"], "city"], 5, 3],
          "circle-color": "#18181B",
        },
      });
      map.addLayer({
        id: "settle-label", type: "symbol", source: "settle",
        layout: {
          "text-field": ["get", "name"], "text-size": 11,
          "text-offset": [0.8, 0], "text-anchor": "left",
          "text-font": ["Noto Sans Regular"],
        },
        paint: { "text-color": "#18181B", "text-halo-color": "#FFFFFF", "text-halo-width": 1.2 },
      });

      // plants
      map.addSource("plants", { type: "geojson", data: G.plants });
      map.addLayer({
        id: "plants-pt", type: "circle", source: "plants",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "capacity_mw"], 300, 5, 1600, 11],
          "circle-color": [
            "match", ["get", "status"],
            "retired", "#71717A",
            "phase-out", "#B91C1C",
            "operating", "#44403C",
            "#71717A",
          ],
          "circle-opacity": 0.85,
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1.2,
        },
      });

      // PV placement overlay — empty source, updated by other effect
      map.addSource("pv-placement", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "pv-placement-pt", type: "circle", source: "pv-placement",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "gw"], 0, 0, 1, 18, 3, 30],
          "circle-color": "#D4A017",
          "circle-opacity": 0.55,
          "circle-stroke-color": "#92400E",
          "circle-stroke-width": 1,
        },
      });

      // BESS placement overlay
      map.addSource("bess-placement", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "bess-placement-pt", type: "circle", source: "bess-placement",
        paint: {
          "circle-radius": ["interpolate", ["linear"], ["get", "gwh"], 0, 0, 0.5, 8, 3, 18],
          "circle-color": "#8B5A2B",
          "circle-opacity": 0.7,
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 1.5,
        },
      });

      // Export flow arrows — one geojson source, two destination features (italy, bulgaria).
      // Each feature carries `mag` (line width ↔ export TWh to that dest) and `dest` (id).
      map.addSource("export-flow", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "export-flow-line", type: "line", source: "export-flow",
        paint: {
          "line-color": [
            "match", ["get", "dest"],
            "italy",    "#0F766E",
            "bulgaria", "#9333EA",
            "#0F766E",
          ],
          "line-width": ["interpolate", ["linear"], ["get", "mag"], 0, 0, 1, 2, 5, 6],
          "line-opacity": 0.85,
          "line-dasharray": [1, 2],
        },
      });

      // Marching-ants animation for export-flow-line
      const dashSeq = [
        [1, 2], [1.5, 1.5], [2, 1], [2, 0.5],
        [0.5, 2], [1, 2.5], [1.5, 2], [2, 1.5],
      ];
      let dashIdx = 0;
      map.__flowAnim = setInterval(() => {
        if (!map.getLayer || !map.getLayer("export-flow-line")) return;
        dashIdx = (dashIdx + 1) % dashSeq.length;
        try { map.setPaintProperty("export-flow-line", "line-dasharray", dashSeq[dashIdx]); }
        catch (e) {}
      }, 220);

      // popups
      ["plants-pt", "subs-pt", "settle-pt"].forEach((id) => {
        map.on("click", id, (e) => {
          const f = e.features && e.features[0];
          if (!f) return;
          const p = f.properties || {};
          const html = `<strong>${p.name}</strong><br/>${
            Object.entries(p).filter(([k]) => k !== "name").map(([k, v]) => `${k}: ${v}`).join("<br/>")
          }`;
          new maplibregl.Popup({ closeButton: false }).setLngLat(e.lngLat).setHTML(html).addTo(map);
        });
        map.on("mouseenter", id, () => map.getCanvas().style.cursor = "pointer");
        map.on("mouseleave", id, () => map.getCanvas().style.cursor = "");
      });

      // First-time placement update
      updatePlacements();
    });

    return () => {
      if (map.__flowAnim) clearInterval(map.__flowAnim);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update placement overlay whenever PV / BESS change
  function updatePlacements() {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    if (!map.getSource("pv-placement")) return;

    // Distribute PV proportionally over mines (by reclaim_ha share).
    const mines = G.mines.features;
    const totalHa = mines.reduce((s, m) => s + (m.properties.reclaim_ha || 0), 0);
    const totalGW = state.pv_gw;
    const features = mines.map((m) => {
      const share = (m.properties.reclaim_ha || 0) / Math.max(1, totalHa);
      const gw = totalGW * share;
      const c = polygonCentroid(m.geometry.coordinates[0]);
      return {
        type: "Feature",
        properties: { name: m.properties.name, gw, mw: gw * 1000 },
        geometry: { type: "Point", coordinates: c },
      };
    });
    map.getSource("pv-placement").setData({ type: "FeatureCollection", features });

    // BESS sites at major substations.
    const subs = G.substations.features.filter((s) => s.properties.kv === 400);
    const bessFeatures = subs.map((s, i) => {
      const c = s.geometry.coordinates;
      const gwh = state.bess_gwh / Math.max(1, subs.length);
      return {
        type: "Feature",
        properties: { name: s.properties.name, gwh },
        geometry: { type: "Point", coordinates: [c[0] + 0.012, c[1] + 0.008] },
      };
    });
    map.getSource("bess-placement").setData({ type: "FeatureCollection", features: bessFeatures });

    // Export flow arrows scaled by per-destination volume.
    if (mode === "export" && outcomes) {
      const itTwh = outcomes.annual.exp_italy_twh || 0;
      const bgTwh = outcomes.annual.exp_bulgaria_twh || 0;
      const magIt = Math.min(5, itTwh * 3 + (itTwh > 0 ? 0.2 : 0));
      const magBg = Math.min(5, bgTwh * 3 + (bgTwh > 0 ? 0.2 : 0));
      const interIt = G.interconnections.features[0]; // GRITA → Italy
      const interBg = G.interconnections.features[1]; // Greece ↔ Bulgaria
      const features = [];
      if (magIt > 0) features.push({
        type: "Feature",
        properties: { dest: "italy", mag: magIt, twh: itTwh },
        geometry: interIt.geometry,
      });
      if (magBg > 0) features.push({
        type: "Feature",
        properties: { dest: "bulgaria", mag: magBg, twh: bgTwh },
        geometry: interBg.geometry,
      });
      map.getSource("export-flow").setData({ type: "FeatureCollection", features });
    } else {
      map.getSource("export-flow").setData({ type: "FeatureCollection", features: [] });
    }
  }

  _useEffect_map(() => {
    const map = mapRef.current;
    if (!map) return;
    if (map.isStyleLoaded()) updatePlacements();
    else map.once("load", updatePlacements);
  }, [state.pv_gw, state.bess_gwh,
      outcomes && outcomes.annual.exp_italy_twh,
      outcomes && outcomes.annual.exp_bulgaria_twh,
      mode]);

  return (
    <div style={{ position: "relative", flex: 1 }}>
      <div ref={ref} className="map-wrap" />
      <div className="map-legend">
        <div className="title">Map layers</div>
        <div className="row"><span className="sw" style={{ background: "#A16207", opacity: 0.6 }} /> Mine reclamation</div>
        <div className="row"><span className="sw" style={{ background: "#166534", opacity: 0.6 }} /> Natura 2000</div>
        <div className="row"><span className="sw" style={{ background: "#D4A017" }} /> PV placement (sized to GW)</div>
        <div className="row"><span className="sw" style={{ background: "#8B5A2B" }} /> BESS at 400 kV subs</div>
        <div className="row"><span className="sw" style={{ background: "#B91C1C" }} /> Phase-out lignite</div>
        <div className="row"><span className="sw" style={{ background: "#71717A" }} /> Retired lignite</div>
        {mode === "export" ? (
          <React.Fragment>
            <div className="row"><span className="sw" style={{ background: "#0F766E" }} /> Export flow → Italy</div>
            <div className="row"><span className="sw" style={{ background: "#9333EA" }} /> Export flow → Bulgaria</div>
          </React.Fragment>
        ) : null}
      </div>
    </div>
  );
}

function polygonCentroid(ring) {
  let x = 0, y = 0;
  for (const p of ring) { x += p[0]; y += p[1]; }
  return [x / ring.length, y / ring.length];
}

window.MapView = MapView;

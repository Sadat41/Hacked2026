import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  ZoomControl,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import type { LatLngBounds } from "leaflet";
import { EDMONTON_CENTER } from "../config/layers";
import { BASEMAPS, type BasemapKey } from "../config/basemaps";
import BasemapSwitcher, { getSavedBasemap } from "./BasemapSwitcher";
import "leaflet/dist/leaflet.css";

const PIPE_API = "https://data.edmonton.ca/resource/bh8y-pn5j.json";
const MANHOLE_API = "https://data.edmonton.ca/resource/6waz-yxqq.json";
const BATCH_SIZE = 50000;

const PIPE_TYPE_META: Record<
  string,
  { color: string; dash: number[]; weight: number; label: string; style: string }
> = {
  STORM: { color: "#38bdf8", dash: [], weight: 2, label: "Storm", style: "Solid" },
  SANITARY: { color: "#a855f7", dash: [8, 4], weight: 2, label: "Sanitary", style: "Dashed" },
  COMBINED: { color: "#f97316", dash: [2, 4], weight: 2, label: "Combined", style: "Dotted" },
  "FND DRAIN": { color: "#22d3ee", dash: [], weight: 1.2, label: "Fnd Drain", style: "Thin solid" },
  WATER: { color: "#3b82f6", dash: [], weight: 2, label: "Water", style: "Solid" },
};

const AGE_COLORS: Record<string, string> = {
  "110-119": "#e11d48",
  "100-109": "#dc2626",
  "90-99": "#ef4444",
  "80-89": "#7c3aed",
  "70-79": "#c026d3",
  "60-69": "#2563eb",
  "50-59": "#3b82f6",
  "40-49": "#0ea5e9",
  "30-39": "#06b6d4",
  "20-29": "#0891b2",
  "10-19": "#0d9488",
  "0-9": "#10b981",
  Unknown: "#6b7280",
};

const AGE_GROUPS = [
  "110-119", "100-109", "90-99", "80-89", "70-79", "60-69",
  "50-59", "40-49", "30-39", "20-29", "10-19", "0-9", "Unknown",
];

const CURRENT_YEAR = new Date().getFullYear();

function getAgeGroup(yearConst: number | null): string {
  if (!yearConst || yearConst <= 0) return "Unknown";
  const age = CURRENT_YEAR - yearConst;
  if (age < 0) return "Unknown";
  if (age >= 120) return "110-119";
  const decade = Math.floor(age / 10) * 10;
  return `${decade}-${decade + 9}`;
}

function pipeStyle(
  viewMode: "age" | "type",
  feature?: GeoJSON.Feature,
): L.PathOptions {
  const pType = feature?.properties?.type as string;
  const yrRaw = feature?.properties?.year_const;
  const yr = yrRaw ? parseInt(yrRaw, 10) : null;

  if (viewMode === "type") {
    const meta = PIPE_TYPE_META[pType];
    return {
      color: meta?.color ?? "#888",
      weight: meta?.weight ?? 2,
      opacity: 0.85,
      dashArray: meta?.dash?.length ? meta.dash.join(" ") : undefined,
    };
  }
  return { color: AGE_COLORS[getAgeGroup(yr)] ?? "#888", weight: 2, opacity: 0.85 };
}

interface AggRow { type: string; year_const: string; cnt: string }
type ViewMode = "age" | "type";

interface PipeIndexed {
  type: string;
  year_const: string | undefined;
  geometry: GeoJSON.MultiLineString;
}

interface ManholeRaw {
  type: string;
  year_const?: string;
  latitude: string;
  longitude: string;
  road_name?: string;
}

interface PipeRaw {
  type: string;
  year_const?: string;
  geometry_line?: GeoJSON.MultiLineString;
}

function InvalidateSize() {
  const map = useMap();
  useEffect(() => { setTimeout(() => map.invalidateSize(), 100); }, [map]);
  return null;
}

/* ── Imperative pipe layer: created ONCE, never destroyed on pan/zoom ── */
function PipeLayer({
  pipes,
  viewMode,
  visibleTypes,
}: {
  pipes: PipeIndexed[];
  viewMode: ViewMode;
  visibleTypes: Record<string, boolean>;
}) {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);
  const rendererRef = useRef<L.Canvas | null>(null);
  const popupRef = useRef<L.Popup | null>(null);
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;

  const geoData = useMemo((): GeoJSON.FeatureCollection => {
    const features: GeoJSON.Feature[] = [];
    for (const p of pipes) {
      if (!visibleTypes[p.type]) continue;
      features.push({
        type: "Feature",
        geometry: p.geometry,
        properties: { type: p.type, year_const: p.year_const },
      });
    }
    return { type: "FeatureCollection", features };
  }, [pipes, visibleTypes]);

  useEffect(() => {
    if (layerRef.current) {
      map.removeLayer(layerRef.current);
      layerRef.current = null;
    }
    if (geoData.features.length === 0) return;

    if (!rendererRef.current) rendererRef.current = L.canvas({ padding: 0.5 });
    if (!popupRef.current)
      popupRef.current = L.popup({ className: "hydrogrid-popup", maxWidth: 280 });

    const popup = popupRef.current;
    const opts: L.GeoJSONOptions & { renderer?: L.Renderer } = {
      style: (f) => pipeStyle(viewModeRef.current, f as GeoJSON.Feature),
      renderer: rendererRef.current!,
      onEachFeature: (feature, lyr) => {
        lyr.on("click", (e: L.LeafletMouseEvent) => {
          const p = feature.properties ?? {};
          const yr = p.year_const || "Unknown";
          const age = p.year_const ? CURRENT_YEAR - parseInt(p.year_const, 10) : "?";
          popup
            .setLatLng(e.latlng)
            .setContent(
              `<div style="font-family:monospace;font-size:12px;max-width:240px">
                <div style="font-weight:700;margin-bottom:4px;border-bottom:1px solid rgba(255,255,255,0.2);padding-bottom:3px">${p.type ?? "Pipe"}</div>
                <table style="border-collapse:collapse">
                  <tr><td style="padding:1px 8px 1px 0;opacity:0.6">Year</td><td>${yr}</td></tr>
                  <tr><td style="padding:1px 8px 1px 0;opacity:0.6">Age</td><td>${age} yrs</td></tr>
                </table>
              </div>`,
            )
            .openOn(map);
        });
      },
    };
    const layer = L.geoJSON(geoData as never, opts as never);
    layer.addTo(map);
    layerRef.current = layer;

    return () => {
      if (layerRef.current) {
        map.removeLayer(layerRef.current);
        layerRef.current = null;
      }
    };
  }, [geoData, map]);

  // View mode switch → cheap restyle, no layer recreation
  useEffect(() => {
    layerRef.current?.setStyle((f) =>
      pipeStyle(viewMode, f as GeoJSON.Feature),
    );
  }, [viewMode]);

  return null;
}

/* ── Imperative manhole layer: zoom 13+ only ── */
function ManholeLayer({
  manholes,
  viewMode,
  visible,
}: {
  manholes: ManholeRaw[];
  viewMode: ViewMode;
  visible: boolean;
}) {
  const map = useMap();
  const groupRef = useRef<L.LayerGroup | null>(null);
  const rendererRef = useRef<L.Canvas | null>(null);
  const popupRef = useRef<L.Popup | null>(null);

  useEffect(() => {
    if (groupRef.current) {
      map.removeLayer(groupRef.current);
      groupRef.current = null;
    }
    if (!visible || manholes.length === 0) return;

    if (!rendererRef.current) rendererRef.current = L.canvas({ padding: 0.5 });
    if (!popupRef.current)
      popupRef.current = L.popup({ className: "hydrogrid-popup", maxWidth: 240 });

    const popup = popupRef.current;
    const group = L.layerGroup();

    for (const m of manholes) {
      const lat = parseFloat(m.latitude);
      const lng = parseFloat(m.longitude);
      if (isNaN(lat) || isNaN(lng)) continue;
      const yr = m.year_const ? parseInt(m.year_const, 10) : null;
      const ag = getAgeGroup(yr);
      const color = viewMode === "type" ? "#94a3b8" : (AGE_COLORS[ag] ?? "#94a3b8");

      const marker = L.circleMarker([lat, lng], {
        radius: 3,
        color: "#e2e8f0",
        weight: 0.5,
        fillColor: color,
        fillOpacity: 0.8,
        renderer: rendererRef.current,
      });
      marker.on("click", (e) => {
        popup
          .setLatLng(e.latlng)
          .setContent(
            `<div style="font-family:monospace;font-size:12px;max-width:200px">
              <div style="font-weight:700;margin-bottom:4px">Manhole — ${m.type}</div>
              <div>Year: ${m.year_const || "Unknown"}</div>
              ${m.road_name ? `<div>Road: ${m.road_name}</div>` : ""}
            </div>`,
          )
          .openOn(map);
      });
      group.addLayer(marker);
    }

    group.addTo(map);
    groupRef.current = group;

    return () => {
      if (groupRef.current) {
        map.removeLayer(groupRef.current);
        groupRef.current = null;
      }
    };
  }, [manholes, viewMode, visible, map]);

  return null;
}

/* ── Viewport tracker (only for manhole loading) ── */
function ViewportTracker({ onViewport }: { onViewport: (b: LatLngBounds, z: number) => void }) {
  const map = useMapEvents({
    moveend: () => onViewport(map.getBounds(), map.getZoom()),
    zoomend: () => onViewport(map.getBounds(), map.getZoom()),
  });
  useEffect(() => { onViewport(map.getBounds(), map.getZoom()); }, [map, onViewport]);
  return null;
}

/* ── Data fetching ── */
async function fetchAllPipes(
  onProgress: (loaded: number) => void,
  signal: AbortSignal,
): Promise<PipeIndexed[]> {
  const all: PipeIndexed[] = [];
  let offset = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (signal.aborted) return all;
    const url = `${PIPE_API}?$select=type,year_const,geometry_line&$limit=${BATCH_SIZE}&$offset=${offset}&$order=:id`;
    const res = await fetch(url, { signal });
    const batch: PipeRaw[] = await res.json();
    for (const p of batch) {
      if (!p.geometry_line?.coordinates?.[0]?.[0]) continue;
      all.push({ type: p.type, year_const: p.year_const, geometry: p.geometry_line });
    }
    onProgress(all.length);
    if (batch.length < BATCH_SIZE) break;
    offset += BATCH_SIZE;
  }
  return all;
}

/* ── Main component ── */
export default function DrainageWaterView() {
  const [viewMode, setViewMode] = useState<ViewMode>("age");
  const [basemap, setBasemap] = useState<BasemapKey>(getSavedBasemap);

  const [pipeStats, setPipeStats] = useState<AggRow[]>([]);
  const [manholeStats, setManholeStats] = useState<AggRow[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  const [allPipes, setAllPipes] = useState<PipeIndexed[]>([]);
  const [pipesLoaded, setPipesLoaded] = useState(0);
  const [pipesReady, setPipesReady] = useState(false);

  const [zoom, setZoom] = useState(12);
  const [manholes, setManholes] = useState<ManholeRaw[]>([]);
  const [manholesLoading, setManholesLoading] = useState(false);

  const [visibleTypes, setVisibleTypes] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const t of Object.keys(PIPE_TYPE_META)) initial[t] = true;
    initial["MANHOLE"] = true;
    return initial;
  });

  const manholeAbortRef = useRef<AbortController | null>(null);
  const vpDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Load stats
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatsLoading(true);
      try {
        const [pRes, mRes] = await Promise.all([
          fetch(`${PIPE_API}?$select=type,year_const,count(*) as cnt&$group=type,year_const&$limit=50000`),
          fetch(`${MANHOLE_API}?$select=type,year_const,count(*) as cnt&$group=type,year_const&$limit=50000`),
        ]);
        if (cancelled) return;
        setPipeStats(await pRes.json());
        setManholeStats(await mRes.json());
      } catch { /* ignore */ }
      if (!cancelled) setStatsLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  // Load ALL pipes once
  useEffect(() => {
    const controller = new AbortController();
    fetchAllPipes((n) => setPipesLoaded(n), controller.signal)
      .then((indexed) => {
        if (!controller.signal.aborted) {
          setAllPipes(indexed);
          setPipesReady(true);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  // Debounced viewport handler — only for manholes
  const handleViewport = useCallback((bounds: LatLngBounds, z: number) => {
    clearTimeout(vpDebounceRef.current);
    vpDebounceRef.current = setTimeout(() => {
      const roundedZoom = Math.round(z);
      setZoom(roundedZoom);

      if (roundedZoom < 13) {
        setManholes([]);
        return;
      }

      manholeAbortRef.current?.abort();
      const controller = new AbortController();
      manholeAbortRef.current = controller;

      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const where = `latitude > ${sw.lat} AND latitude < ${ne.lat} AND longitude > ${sw.lng} AND longitude < ${ne.lng}`;
      const limit = roundedZoom >= 15 ? 10000 : 4000;

      setManholesLoading(true);
      fetch(
        `${MANHOLE_API}?$where=${encodeURIComponent(where)}&$select=type,year_const,latitude,longitude,road_name&$limit=${limit}`,
        { signal: controller.signal },
      )
        .then((r) => r.json())
        .then((data: ManholeRaw[]) => { if (!controller.signal.aborted) setManholes(data); })
        .catch(() => {})
        .finally(() => { if (!controller.signal.aborted) setManholesLoading(false); });
    }, 250);
  }, []);

  const { ageData, typeData, totalPipes, totalManholes } = useMemo(() => {
    const ageMap: Record<string, { pipes: number; manholes: number }> = {};
    for (const g of AGE_GROUPS) ageMap[g] = { pipes: 0, manholes: 0 };
    const typeMap: Record<string, { pipes: number; manholes: number }> = {};
    for (const t of Object.keys(PIPE_TYPE_META)) typeMap[t] = { pipes: 0, manholes: 0 };
    let tp = 0, tm = 0;

    for (const row of pipeStats) {
      const cnt = parseInt(row.cnt, 10) || 0;
      const ag = getAgeGroup(parseInt(row.year_const, 10) || 0);
      if (ageMap[ag]) ageMap[ag].pipes += cnt;
      if (typeMap[row.type]) typeMap[row.type].pipes += cnt;
      tp += cnt;
    }
    for (const row of manholeStats) {
      const cnt = parseInt(row.cnt, 10) || 0;
      const ag = getAgeGroup(parseInt(row.year_const, 10) || 0);
      if (ageMap[ag]) ageMap[ag].manholes += cnt;
      if (typeMap[row.type]) typeMap[row.type].manholes += cnt;
      tm += cnt;
    }
    return { ageData: ageMap, typeData: typeMap, totalPipes: tp, totalManholes: tm };
  }, [pipeStats, manholeStats]);

  const bm = BASEMAPS[basemap];
  const maxBarPipes = useMemo(() => {
    const data = viewMode === "age" ? ageData : typeData;
    return Math.max(1, ...Object.values(data).map((d) => d.pipes));
  }, [viewMode, ageData, typeData]);

  const toggleType = (t: string) =>
    setVisibleTypes((prev) => ({ ...prev, [t]: !prev[t] }));

  const barGroups = viewMode === "age" ? AGE_GROUPS : Object.keys(PIPE_TYPE_META);
  const barData = viewMode === "age" ? ageData : typeData;
  const barColors = viewMode === "age"
    ? AGE_COLORS
    : Object.fromEntries(Object.entries(PIPE_TYPE_META).map(([k, v]) => [k, v.color]));

  const showManholes = visibleTypes["MANHOLE"] && zoom >= 13;

  const loadingMsg = !pipesReady
    ? `Loading pipes... ${pipesLoaded.toLocaleString()}`
    : manholesLoading
      ? "Loading manholes..."
      : null;

  return (
    <div className="dw-view">
      <aside className="dw-sidebar">
        <div className="dw-sidebar-header">
          <h2>Edmonton Drainage &amp; Regional Water</h2>
          {statsLoading ? (
            <p className="dw-subtitle">Loading statistics...</p>
          ) : (
            <p className="dw-subtitle">
              Total: <strong>{totalPipes.toLocaleString()}</strong> pipe segments &bull;{" "}
              <strong>{totalManholes.toLocaleString()}</strong> manholes
            </p>
          )}
        </div>

        <div className="dw-section">
          <label className="dw-label">View By</label>
          <div className="dw-toggle-row">
            <button className={`dw-toggle-btn ${viewMode === "age" ? "active" : ""}`} onClick={() => setViewMode("age")}>Age</button>
            <button className={`dw-toggle-btn ${viewMode === "type" ? "active" : ""}`} onClick={() => setViewMode("type")}>Type</button>
          </div>
        </div>

        <div className="dw-section dw-chart-section">
          <div className="dw-chart-header-labels">
            <span className="dw-chart-axis-label">{viewMode === "age" ? "Age (years)" : "Type"}</span>
            <span className="dw-chart-axis-right">
              <span>Pipes</span>
              <span>Manholes</span>
            </span>
          </div>
          <div className="dw-bar-list">
            {barGroups.map((group) => {
              const d = barData[group] ?? { pipes: 0, manholes: 0 };
              const pct = (d.pipes / maxBarPipes) * 100;
              return (
                <div key={group} className="dw-bar-row">
                  <span className="dw-bar-label">{group}</span>
                  <div className="dw-bar-track">
                    <div className="dw-bar-fill" style={{ width: `${Math.max(pct, 0.5)}%`, backgroundColor: barColors[group] ?? "#888" }} />
                  </div>
                  <span className="dw-bar-value">{d.pipes.toLocaleString()}</span>
                  <span className="dw-bar-value">{d.manholes.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="dw-section">
          <label className="dw-label">Legend &amp; Visibility</label>
          <div className="dw-legend">
            {Object.entries(PIPE_TYPE_META).map(([key, meta]) => (
              <button key={key} className={`dw-legend-item ${visibleTypes[key] ? "active" : ""}`} onClick={() => toggleType(key)}>
                <svg width="32" height="10" viewBox="0 0 32 10">
                  <line x1="0" y1="5" x2="32" y2="5" stroke={meta.color} strokeWidth={meta.weight} strokeDasharray={meta.dash.length ? meta.dash.join(" ") : undefined} />
                </svg>
                <span className="dw-legend-label">{meta.label} &mdash; {meta.style}</span>
              </button>
            ))}
            <button className={`dw-legend-item ${visibleTypes["MANHOLE"] ? "active" : ""}`} onClick={() => toggleType("MANHOLE")}>
              <svg width="32" height="10" viewBox="0 0 32 10">
                <circle cx="16" cy="5" r="4" fill="#94a3b8" stroke="#e2e8f0" strokeWidth="1" />
              </svg>
              <span className="dw-legend-label">Manhole</span>
            </button>
          </div>
          <p className="dw-note">Manholes appear at zoom 13+. Click legend to toggle layers.</p>
        </div>

        <div className="dw-section dw-footer">
          <p>
            Data:{" "}
            <a href="https://data.edmonton.ca" target="_blank" rel="noopener noreferrer">Edmonton Open Data</a>
            {" / "}
            <a href="https://www.epcor.com" target="_blank" rel="noopener noreferrer">EPCOR</a>
          </p>
        </div>
      </aside>

      <div className={`dw-map-outer ${bm.isDark ? "theme-dark" : "theme-light"}`}>
        {loadingMsg && <div className="dw-map-loading">{loadingMsg}</div>}
        <MapContainer center={EDMONTON_CENTER} zoom={12} className="map-container" zoomControl={false} preferCanvas>
          <ZoomControl position="bottomright" />
          <InvalidateSize />
          <ViewportTracker onViewport={handleViewport} />
          <TileLayer key={basemap} attribution={bm.attr} url={bm.url} {...("maxZoom" in bm ? { maxZoom: bm.maxZoom } : {})} />
          {"labelsUrl" in bm && <TileLayer key={basemap + "-labels"} url={bm.labelsUrl as string} zIndex={650} />}

          {pipesReady && (
            <PipeLayer pipes={allPipes} viewMode={viewMode} visibleTypes={visibleTypes} />
          )}

          <ManholeLayer manholes={manholes} viewMode={viewMode} visible={showManholes} />
        </MapContainer>
        <BasemapSwitcher active={basemap} onChange={setBasemap} />
      </div>
    </div>
  );
}

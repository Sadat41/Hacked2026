import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { downloadCSV, downloadPNG } from "../utils/export";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
  useMapEvents,
} from "react-leaflet";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Brush,
} from "recharts";
import type { LatLngBounds } from "leaflet";
import { ALBERTA_CENTER } from "../config/layers";
import { BASEMAPS, type BasemapKey } from "../config/basemaps";
import BasemapSwitcher, { getSavedBasemap } from "./BasemapSwitcher";
import "leaflet/dist/leaflet.css";

const WEATHER_API =
  import.meta.env.DEV ? "/weatherapi" : "https://api.weather.gc.ca";

interface HydroStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  drainageArea: number | null;
  status: string;
  schedule: string;
  dataType: string;
  contributor: string;
}

interface MonthlyMean {
  month: string;
  level: number | null;
  discharge: number | null;
}

interface AnnualPeak {
  year: string;
  peakDischarge: number | null;
  peakLevel: number | null;
  dischDate: string;
  levelDate: string;
}

type ChartMode = "monthly" | "peaks";

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatMonthTick(v: string): string {
  const year = v.slice(2, 4);
  const monthIdx = parseInt(v.slice(5, 7), 10) - 1;
  return `${MONTH_ABBR[monthIdx] ?? v.slice(5, 7)} '${year}`;
}

function FlyTo({ lat, lng, zoom }: { lat: number; lng: number; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], zoom ?? 10, { duration: 1.2 });
  }, [map, lat, lng, zoom]);
  return null;
}

const MIN_STATION_ZOOM = 7;

function MapViewState({
  onViewChange,
}: {
  onViewChange: (bounds: LatLngBounds, zoom: number) => void;
}) {
  const map = useMapEvents({
    moveend: () => onViewChange(map.getBounds(), map.getZoom()),
    zoomend: () => onViewChange(map.getBounds(), map.getZoom()),
  });
  useEffect(() => {
    onViewChange(map.getBounds(), map.getZoom());
  }, [map, onViewChange]);
  return null;
}

export default function HydrometricView() {
  const [stations, setStations] = useState<HydroStation[]>([]);
  const [selectedStation, setSelectedStation] = useState<HydroStation | null>(null);
  const [stationSearch, setStationSearch] = useState("");
  const [chartMode, setChartMode] = useState<ChartMode>("monthly");
  const [monthlyData, setMonthlyData] = useState<MonthlyMean[]>([]);
  const [peaksData, setPeaksData] = useState<AnnualPeak[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stationsLoading, setStationsLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [basemap, setBasemap] = useState<BasemapKey>(getSavedBasemap);
  const [mapBounds, setMapBounds] = useState<LatLngBounds | null>(null);
  const [mapZoom, setMapZoom] = useState(5);
  const abortRef = useRef<AbortController>(undefined);
  const bm = BASEMAPS[basemap];

  const handleViewChange = useCallback((bounds: LatLngBounds, zoom: number) => {
    setMapBounds(bounds);
    setMapZoom(zoom);
  }, []);

  useEffect(() => {
    async function loadStations() {
      try {
        const res = await fetch(
          `${WEATHER_API}/collections/hydrometric-stations/items?f=json&limit=1500&PROV_TERR_STATE_LOC=AB`
        );
        const data = await res.json();
        const list: HydroStation[] = data.features
          .map((f: any) => {
            const p = f.properties;
            return {
              id: p.STATION_NUMBER,
              name: p.STATION_NAME,
              lat: f.geometry.coordinates[1],
              lng: f.geometry.coordinates[0],
              drainageArea: p.DRAINAGE_AREA_GROSS ?? null,
              status: p.STATION_STATUS ?? "",
              schedule: p.STATION_OPERATION_SCHEDULE ?? "",
              dataType: p.DATA_TYPE ?? "",
              contributor: p.STATION_CONTRIBUTOR ?? "",
            };
          })
          .sort((a: HydroStation, b: HydroStation) => a.name.localeCompare(b.name));
        setStations(list);
      } catch {
        setError("Failed to load hydrometric stations");
      } finally {
        setStationsLoading(false);
      }
    }
    loadStations();
  }, []);

  const fetchMonthlyData = useCallback(async (station: HydroStation) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    try {
      const url = `${WEATHER_API}/collections/hydrometric-monthly-mean/items?f=json&limit=2000&STATION_NUMBER=${station.id}&sortby=DATE`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const records: MonthlyMean[] = json.features.map((f: any) => ({
        month: f.properties.DATE?.slice(0, 7) ?? "",
        level: f.properties.MONTHLY_MEAN_LEVEL,
        discharge: f.properties.MONTHLY_MEAN_DISCHARGE,
      }));
      records.sort((a, b) => a.month.localeCompare(b.month));
      setMonthlyData(records);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPeaksData = useCallback(async (station: HydroStation) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);

    try {
      const url = `${WEATHER_API}/collections/hydrometric-annual-peaks/items?f=json&limit=2000&STATION_NUMBER=${station.id}&sortby=DATE`;
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      const byYear: Record<string, AnnualPeak> = {};
      for (const f of json.features) {
        const p = f.properties;
        const year = p.DATE?.slice(0, 4) ?? "";
        if (!year) continue;
        if (!byYear[year]) {
          byYear[year] = { year, peakDischarge: null, peakLevel: null, dischDate: "", levelDate: "" };
        }
        if (p.DATA_TYPE === "Q" || p.DATA_TYPE_EN === "Flow") {
          byYear[year].peakDischarge = p.PEAK;
          byYear[year].dischDate = p.DATE?.slice(0, 10) ?? "";
        } else if (p.DATA_TYPE === "H" || p.DATA_TYPE_EN === "Level") {
          byYear[year].peakLevel = p.PEAK;
          byYear[year].levelDate = p.DATE?.slice(0, 10) ?? "";
        }
      }
      const peaks = Object.values(byYear).sort((a, b) => a.year.localeCompare(b.year));
      setPeaksData(peaks);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  function selectStation(s: HydroStation) {
    setSelectedStation(s);
    setStationSearch("");
    setPanelOpen(true);
    setChartMode("monthly");
    fetchMonthlyData(s);
  }

  useEffect(() => {
    if (!selectedStation) return;
    if (chartMode === "monthly") fetchMonthlyData(selectedStation);
    else if (chartMode === "peaks") fetchPeaksData(selectedStation);
  }, [chartMode, selectedStation, fetchMonthlyData, fetchPeaksData]);

  const filteredStations = useMemo(() => {
    if (!stationSearch) return [];
    const q = stationSearch.toLowerCase();
    return stations.filter(
      (s) => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)
    );
  }, [stationSearch, stations]);

  const visibleStations = useMemo(() => {
    if (stationSearch) return filteredStations;
    if (mapZoom < MIN_STATION_ZOOM || !mapBounds) return [];
    return stations.filter((s) => mapBounds.contains([s.lat, s.lng]));
  }, [stationSearch, filteredStations, stations, mapZoom, mapBounds]);

  const tooltipStyle = {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 8,
    color: "#e2e8f0",
    fontSize: 12,
  };

  function renderChartContent() {
    if (loading) {
      return (
        <div className="precip-empty-charts">
          <div className="precip-spinner" />
          <p>Loading data...</p>
        </div>
      );
    }
    if (error) {
      return (
        <div className="precip-empty-charts">
          <p className="precip-error">{error}</p>
        </div>
      );
    }

    if (chartMode === "monthly") {
      if (monthlyData.length === 0) {
        return (
          <div className="precip-empty-charts">
            <p>No monthly data available for this station.</p>
          </div>
        );
      }

      const avgDischarge = monthlyData.reduce((s, r) => s + (r.discharge ?? 0), 0) / (monthlyData.filter(r => r.discharge != null).length || 1);

      return (
        <>
          <div className="precip-stats">
            <div className="stat-card">
              <span className="stat-value">{monthlyData.length}</span>
              <span className="stat-label">Months</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{avgDischarge.toFixed(1)}</span>
              <span className="stat-label">Avg (m³/s)</span>
            </div>
          </div>

          <div className="precip-chart-section">
            <h4>Monthly Mean Discharge (m³/s)</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="month"
                  stroke="#64748b"
                  tick={{ fontSize: 10 }}
                  minTickGap={40}
                  tickFormatter={formatMonthTick}
                />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit=" m³/s" />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(val: number | undefined) => [`${val?.toFixed(2) ?? "N/A"} m³/s`]}
                />
                <Bar dataKey="discharge" fill="#2dd4bf" name="Mean Discharge" radius={[2, 2, 0, 0]} />
                <Legend />
                {monthlyData.length > 60 && (
                  <Brush dataKey="month" height={24} stroke="#475569" fill="#0f172a" tickFormatter={formatMonthTick} />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="precip-chart-section">
            <h4>Monthly Mean Water Level (m)</h4>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="month"
                  stroke="#64748b"
                  tick={{ fontSize: 10 }}
                  minTickGap={40}
                  tickFormatter={formatMonthTick}
                />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit=" m" />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(val: number | undefined) => [`${val?.toFixed(3) ?? "N/A"} m`]}
                />
                <Line type="monotone" dataKey="level" stroke="#38bdf8" name="Mean Level" dot={false} strokeWidth={1.5} />
                <Legend />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      );
    }

    if (chartMode === "peaks") {
      if (peaksData.length === 0) {
        return (
          <div className="precip-empty-charts">
            <p>No annual peak data available.</p>
          </div>
        );
      }

      const maxPeak = Math.max(...peaksData.map(p => p.peakDischarge ?? 0), 0);

      return (
        <>
          <div className="precip-stats">
            <div className="stat-card">
              <span className="stat-value">{peaksData.length}</span>
              <span className="stat-label">Years</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{maxPeak.toFixed(0)}</span>
              <span className="stat-label">Record Peak (m³/s)</span>
            </div>
          </div>

          <div className="precip-chart-section">
            <h4>Annual Peak Discharge (m³/s)</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={peaksData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="year" stroke="#64748b" tick={{ fontSize: 10 }} minTickGap={30} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit=" m³/s" />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(val: number | undefined, name?: string) => [
                    `${val?.toFixed(1) ?? "N/A"} ${name?.includes("Level") ? "m" : "m³/s"}`,
                  ]}
                />
                <Bar dataKey="peakDischarge" fill="#f59e0b" name="Peak Discharge" radius={[2, 2, 0, 0]} />
                <Legend />
                {peaksData.length > 40 && (
                  <Brush dataKey="year" height={24} stroke="#475569" fill="#0f172a" />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="precip-chart-section">
            <h4>Annual Peak Water Level (m)</h4>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={peaksData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="year" stroke="#64748b" tick={{ fontSize: 10 }} minTickGap={30} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit=" m" />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(val: number | undefined) => [`${val?.toFixed(3) ?? "N/A"} m`]}
                />
                <Bar dataKey="peakLevel" fill="#38bdf8" name="Peak Level" radius={[2, 2, 0, 0]} />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      );
    }

    return null;
  }

  return (
    <div className="precip-view">
      {/* Sidebar */}
      <div className="precip-sidebar">
        <div className="precip-sidebar-header">
          <h2>River Flow</h2>
          <p className="precip-subtitle">
            Hydrometric data &middot; Environment Canada
          </p>
        </div>

        <div className="precip-section">
          <label className="precip-label">Search Station</label>
          <input
            type="text"
            className="precip-input"
            placeholder="Type station name or ID..."
            value={stationSearch}
            onChange={(e) => setStationSearch(e.target.value)}
          />
          {stationSearch && (
            <div className="station-list">
              {filteredStations.slice(0, 40).map((s) => (
                <button
                  key={s.id}
                  className={`station-item ${selectedStation?.id === s.id ? "active" : ""}`}
                  onClick={() => selectStation(s)}
                >
                  <div className="station-item-left">
                    <span className="station-name">{s.name}</span>
                    <span className="station-dates">
                      {s.status} &middot; {s.schedule}
                    </span>
                  </div>
                  <span className="station-meta">{s.id}</span>
                </button>
              ))}
              {filteredStations.length === 0 && (
                <div className="station-loading">No stations found</div>
              )}
            </div>
          )}
        </div>

        {selectedStation && (
          <div className="precip-section">
            <label className="precip-label">Selected</label>
            <div className="precip-selected-station">
              <strong>{selectedStation.name}</strong>
              <span>{selectedStation.id}</span>
              <span>
                {selectedStation.lat.toFixed(3)}N, {Math.abs(selectedStation.lng).toFixed(3)}W
              </span>
              {selectedStation.drainageArea && (
                <span>
                  Drainage: {selectedStation.drainageArea.toLocaleString()} km²
                </span>
              )}
              <span>Status: {selectedStation.status}</span>
              <div className="station-badges">
                <span className="station-badge">Flow</span>
                <span className="station-badge">Level</span>
              </div>
            </div>
            <button className="precip-open-chart-btn" onClick={() => setPanelOpen(true)}>
              View Charts
            </button>
          </div>
        )}

        {!selectedStation && !stationsLoading && (
          <div className="precip-section">
            <p className="precip-hint">
              {mapZoom < MIN_STATION_ZOOM
                ? <>Zoom into the map to see stations, or search above.<br /><strong>{stations.length}</strong> hydrometric stations across Alberta.</>
                : <>Click a station on the map or search above.<br /><strong>{visibleStations.length}</strong> of {stations.length} stations in view.</>
              }
            </p>
          </div>
        )}
        {stationsLoading && (
          <div className="precip-section">
            <div className="precip-hint">Loading stations...</div>
          </div>
        )}

        <div className="precip-section precip-footer-section">
          <p className="precip-hint" style={{ fontSize: 11, color: "#475569" }}>
            Data: <a href="https://api.weather.gc.ca" target="_blank" rel="noopener noreferrer" style={{ color: "#2dd4bf", textDecoration: "none" }}>Environment Canada</a>
            {" "}&middot;{" "}
            <a href="https://wateroffice.ec.gc.ca" target="_blank" rel="noopener noreferrer" style={{ color: "#2dd4bf", textDecoration: "none" }}>Water Office</a>
          </p>
        </div>
      </div>

      {/* Full map */}
      <div className={`precip-main ${bm.isDark ? "theme-dark" : "theme-light"}`}>
        <MapContainer
          center={ALBERTA_CENTER}
          zoom={11}
          className="precip-map-full"
          zoomControl={true}
        >
          <MapViewState onViewChange={handleViewChange} />
          <TileLayer key={basemap} attribution={bm.attr} url={bm.url} />
          {"labelsUrl" in bm && (
            <TileLayer key={basemap + "-labels"} url={bm.labelsUrl as string} zIndex={650} />
          )}
          {selectedStation && (
            <FlyTo lat={selectedStation.lat} lng={selectedStation.lng} />
          )}

          {visibleStations.map((s) => (
            <CircleMarker
              key={s.id}
              center={[s.lat, s.lng]}
              radius={selectedStation?.id === s.id ? 8 : 5}
              pathOptions={{
                color: selectedStation?.id === s.id ? "#2dd4bf" : "#14b8a6",
                fillColor: selectedStation?.id === s.id ? "#2dd4bf" : "#14b8a6",
                fillOpacity: selectedStation?.id === s.id ? 1 : 0.6,
                weight: selectedStation?.id === s.id ? 2 : 1,
              }}
              eventHandlers={{ click: () => selectStation(s) }}
            >
              <Popup className="hydrogrid-popup">
                <div style={{ fontFamily: "system-ui", fontSize: 13 }}>
                  <strong>{s.name}</strong>
                  <br />
                  {s.id} &middot; {s.status}
                  {s.drainageArea && <><br />Drainage: {s.drainageArea.toLocaleString()} km²</>}
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
        <BasemapSwitcher active={basemap} onChange={setBasemap} />

        {!stationSearch && mapZoom < MIN_STATION_ZOOM && !selectedStation && (
          <div className="precip-zoom-hint">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
            </svg>
            Zoom in to see hydrometric stations
          </div>
        )}

        {/* Floating chart panel */}
        {panelOpen && selectedStation && (
          <div className="chart-panel">
            <div className="chart-panel-header">
              <div className="chart-panel-title">
                <h3>{selectedStation.name}</h3>
                <span className="chart-panel-sub">
                  {selectedStation.id}
                  {selectedStation.drainageArea ? ` · ${selectedStation.drainageArea.toLocaleString()} km²` : ""}
                </span>
              </div>
              <div className="chart-panel-controls">
                <div className="precip-toggle-row">
                  <button
                    className={`precip-btn ${chartMode === "monthly" ? "active" : ""}`}
                    onClick={() => setChartMode("monthly")}
                  >
                    Monthly
                  </button>
                  <button
                    className={`precip-btn ${chartMode === "peaks" ? "active" : ""}`}
                    onClick={() => setChartMode("peaks")}
                  >
                    Peaks
                  </button>
                </div>
                <button className="chart-panel-close" onClick={() => setPanelOpen(false)} title="Close">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </button>
              </div>
              {monthlyData.length > 0 && (
                <div className="export-bar">
                  <button className="export-btn" onClick={() => downloadCSV(monthlyData as unknown as Record<string, unknown>[], `hydrometric_${selectedStation?.name || "data"}.csv`)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                    CSV
                  </button>
                  <button className="export-btn" onClick={() => { const el = document.querySelector(".chart-panel-body"); if (el) downloadPNG(el as HTMLElement, `hydrometric_${selectedStation?.name || "chart"}.png`); }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                    PNG
                  </button>
                </div>
              )}
            </div>

            <div className="chart-panel-body">
              {renderChartContent()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

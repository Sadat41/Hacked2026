import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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

interface Station {
  id: string;
  name: string;
  lat: number;
  lng: number;
  elevation: string;
  firstDate: string;
  lastDate: string;
  dlyFirst: string;
  dlyLast: string;
  mlyFirst: string;
  mlyLast: string;
  hasDaily: boolean;
  hasMonthly: boolean;
}

interface DailyRecord {
  date: string;
  precip: number | null;
  rain: number | null;
  snow: number | null;
  snowDepth: number | null;
  meanTemp: number | null;
}

interface MonthlyRecord {
  month: string;
  precip: number | null;
  normalPrecip: number | null;
  snowfall: number | null;
  meanTemp: number | null;
  daysWithPrecip: number | null;
}

type ViewMode = "daily" | "monthly";

const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatTimeTick(v: string, mode: ViewMode): string {
  if (mode === "daily") {
    // "YYYY-MM-DD" → "MMM DD 'YY"
    const year = v.slice(2, 4);
    const monthIdx = parseInt(v.slice(5, 7), 10) - 1;
    const day = v.slice(8, 10);
    return `${MONTH_ABBR[monthIdx] ?? v.slice(5, 7)} ${day} '${year}`;
  }
  // Monthly: "YYYY-MM" → "Jan '96"
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

export default function PrecipitationView() {
  const [stations, setStations] = useState<Station[]>([]);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [stationSearch, setStationSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("monthly");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [dailyData, setDailyData] = useState<DailyRecord[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyRecord[]>([]);
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
          `${WEATHER_API}/collections/climate-stations/items?f=json&limit=1500&ENG_PROV_NAME=ALBERTA`
        );
        const data = await res.json();
        const list: Station[] = data.features
          .map((f: any) => {
            const p = f.properties;
            return {
              id: p.CLIMATE_IDENTIFIER,
              name: p.STATION_NAME,
              lat: f.geometry.coordinates[1],
              lng: f.geometry.coordinates[0],
              elevation: p.ELEVATION ?? "",
              firstDate: p.FIRST_DATE?.slice(0, 10) ?? "",
              lastDate: p.LAST_DATE?.slice(0, 10) ?? "",
              dlyFirst: p.DLY_FIRST_DATE?.slice(0, 10) ?? "",
              dlyLast: p.DLY_LAST_DATE?.slice(0, 10) ?? "",
              mlyFirst: p.MLY_FIRST_DATE?.slice(0, 10) ?? "",
              mlyLast: p.MLY_LAST_DATE?.slice(0, 10) ?? "",
              hasDaily: !!p.DLY_FIRST_DATE,
              hasMonthly: !!p.MLY_FIRST_DATE,
            };
          })
          .filter((s: Station) => s.hasDaily || s.hasMonthly)
          .sort((a: Station, b: Station) => a.name.localeCompare(b.name));
        setStations(list);
      } catch {
        setError("Failed to load station list");
      } finally {
        setStationsLoading(false);
      }
    }
    loadStations();
  }, []);

  const fetchData = useCallback(
    async (station: Station, mode: ViewMode, from: string, to: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setLoading(true);
      setError(null);

      try {
        if (mode === "daily") {
          const url = `${WEATHER_API}/collections/climate-daily/items?f=json&limit=2000&CLIMATE_IDENTIFIER=${station.id}&sortby=LOCAL_DATE&datetime=${from}/${to}&properties=STATION_NAME,LOCAL_DATE,TOTAL_PRECIPITATION,TOTAL_RAIN,TOTAL_SNOW,SNOW_ON_GROUND,MEAN_TEMPERATURE`;
          const res = await fetch(url, { signal: controller.signal });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          const records: DailyRecord[] = json.features.map((f: any) => ({
            date: f.properties.LOCAL_DATE?.slice(0, 10) ?? "",
            precip: f.properties.TOTAL_PRECIPITATION,
            rain: f.properties.TOTAL_RAIN,
            snow: f.properties.TOTAL_SNOW,
            snowDepth: f.properties.SNOW_ON_GROUND,
            meanTemp: f.properties.MEAN_TEMPERATURE,
          }));
          records.sort((a, b) => a.date.localeCompare(b.date));
          setDailyData(records);
        } else {
          const url = `${WEATHER_API}/collections/climate-monthly/items?f=json&limit=2000&CLIMATE_IDENTIFIER=${station.id}&sortby=LOCAL_DATE&datetime=${from}/${to}`;
          const res = await fetch(url, { signal: controller.signal });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const json = await res.json();
          const records: MonthlyRecord[] = json.features.map((f: any) => ({
            month: f.properties.LOCAL_DATE?.slice(0, 7) ?? "",
            precip: f.properties.TOTAL_PRECIPITATION,
            normalPrecip: f.properties.NORMAL_PRECIPITATION,
            snowfall: f.properties.TOTAL_SNOWFALL,
            meanTemp: f.properties.MEAN_TEMPERATURE,
            daysWithPrecip: f.properties.DAYS_WITH_PRECIP_GE_1MM,
          }));
          records.sort((a, b) => a.month.localeCompare(b.month));
          setMonthlyData(records);
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!selectedStation || !startDate || !endDate) return;
    fetchData(selectedStation, viewMode, startDate, endDate);
  }, [selectedStation, viewMode, startDate, endDate, fetchData]);

  function selectStation(s: Station) {
    setSelectedStation(s);
    setStationSearch("");
    setPanelOpen(true);

    const mode = s.hasMonthly ? "monthly" : "daily";
    setViewMode(mode);
    applyFullRange(s);
  }

  function applyFullRange(s: Station) {
    const allFirsts = [s.firstDate, s.dlyFirst, s.mlyFirst].filter(Boolean);
    const allLasts = [s.lastDate, s.dlyLast, s.mlyLast].filter(Boolean);
    setStartDate(allFirsts.sort()[0] || s.firstDate);
    setEndDate(allLasts.sort().reverse()[0] || s.lastDate);
  }

  const filteredStations = useMemo(() => {
    if (!stationSearch) return [];
    const q = stationSearch.toLowerCase();
    return stations.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
    );
  }, [stationSearch, stations]);

  const visibleStations = useMemo(() => {
    if (stationSearch) return filteredStations;
    if (mapZoom < MIN_STATION_ZOOM || !mapBounds) return [];
    return stations.filter(
      (s) => mapBounds.contains([s.lat, s.lng])
    );
  }, [stationSearch, filteredStations, stations, mapZoom, mapBounds]);

  const data = viewMode === "daily" ? dailyData : monthlyData;
  const totalPrecip = data.reduce((sum, r) => sum + ((r as any).precip ?? 0), 0);
  const maxPrecip = Math.max(...data.map((r) => (r as any).precip ?? 0), 0);

  const tooltipStyle = {
    background: "#1e293b",
    border: "1px solid #334155",
    borderRadius: 8,
    color: "#e2e8f0",
    fontSize: 12,
  };

  return (
    <div className="precip-view">
      {/* Sidebar */}
      <div className="precip-sidebar">
        <div className="precip-sidebar-header">
          <h2>Precipitation Explorer</h2>
          <p className="precip-subtitle">
            Historical climate data &middot; Environment Canada
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
                      {s.firstDate.slice(0, 4)}&ndash;{s.lastDate.slice(0, 4)}
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
              <span>{selectedStation.id} &middot; {selectedStation.elevation}m</span>
              <span>
                {selectedStation.lat.toFixed(3)}N, {Math.abs(selectedStation.lng).toFixed(3)}W
              </span>
              <span>
                Data: {selectedStation.firstDate} &rarr; {selectedStation.lastDate}
              </span>
              <div className="station-badges">
                {selectedStation.hasDaily && <span className="station-badge">Daily</span>}
                {selectedStation.hasMonthly && <span className="station-badge">Monthly</span>}
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
                ? <>Zoom into the map to see stations, or search above.<br /><strong>{stations.length}</strong> stations available across Alberta.</>
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
            Data: <a href="https://api.weather.gc.ca" target="_blank" rel="noopener noreferrer" style={{ color: "#38bdf8", textDecoration: "none" }}>Environment Canada</a>
            {" "}&middot;{" "}
            <a href="https://climate.weather.gc.ca" target="_blank" rel="noopener noreferrer" style={{ color: "#38bdf8", textDecoration: "none" }}>Climate Services</a>
          </p>
        </div>
      </div>

      {/* Full map */}
      <div className={`precip-main ${bm.isDark ? "theme-dark" : "theme-light"}`}>
        <MapContainer
          center={ALBERTA_CENTER}
          zoom={5}
          className="precip-map-full"
          zoomControl={true}
        >
          <MapViewState onViewChange={handleViewChange} />
          <TileLayer
            key={basemap}
            attribution={bm.attr}
            url={bm.url}
          />
          {"labelsUrl" in bm && (
            <TileLayer
              key={basemap + "-labels"}
              url={bm.labelsUrl as string}
              zIndex={650}
            />
          )}
          {selectedStation && (
            <FlyTo lat={selectedStation.lat} lng={selectedStation.lng} />
          )}

          {/* Climate stations (viewport-filtered) */}
          {visibleStations.map((s) => (
            <CircleMarker
              key={s.id}
              center={[s.lat, s.lng]}
              radius={selectedStation?.id === s.id ? 8 : 5}
              pathOptions={{
                color: selectedStation?.id === s.id ? "#38bdf8" : "#3b82f6",
                fillColor: selectedStation?.id === s.id ? "#38bdf8" : "#3b82f6",
                fillOpacity: selectedStation?.id === s.id ? 1 : 0.6,
                weight: selectedStation?.id === s.id ? 2 : 1,
              }}
              eventHandlers={{ click: () => selectStation(s) }}
            >
              <Popup className="hydrogrid-popup">
                <div style={{ fontFamily: "system-ui", fontSize: 13 }}>
                  <strong>{s.name}</strong>
                  <br />
                  {s.id} &middot; {s.elevation}m
                  <br />
                  Data: {s.firstDate} &rarr; {s.lastDate}
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
        <BasemapSwitcher active={basemap} onChange={setBasemap} />

        {/* Zoom hint overlay */}
        {!stationSearch && mapZoom < MIN_STATION_ZOOM && !selectedStation && (
          <div className="precip-zoom-hint">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
            </svg>
            Zoom in to see weather stations
          </div>
        )}

        {/* Floating chart panel */}
        {panelOpen && selectedStation && (
          <div className="chart-panel">
            <div className="chart-panel-header">
              <div className="chart-panel-title">
                <h3>{selectedStation.name}</h3>
                <span className="chart-panel-sub">
                  {selectedStation.id} &middot; {selectedStation.elevation}m
                </span>
              </div>
              <div className="chart-panel-controls">
                <div className="precip-toggle-row">
                  {selectedStation.hasDaily && (
                    <button
                      className={`precip-btn ${viewMode === "daily" ? "active" : ""}`}
                      onClick={() => {
                        setViewMode("daily");
                        applyFullRange(selectedStation);
                      }}
                    >
                      Daily
                    </button>
                  )}
                  {selectedStation.hasMonthly && (
                    <button
                      className={`precip-btn ${viewMode === "monthly" ? "active" : ""}`}
                      onClick={() => {
                        setViewMode("monthly");
                        applyFullRange(selectedStation);
                      }}
                    >
                      Monthly
                    </button>
                  )}
                </div>
                <div className="precip-date-row">
                  <input
                    type="date"
                    className="precip-input sm"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                  <span className="precip-date-sep">&rarr;</span>
                  <input
                    type="date"
                    className="precip-input sm"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
                <button className="chart-panel-close" onClick={() => setPanelOpen(false)} title="Close">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                </button>
              </div>
            </div>

            <div className="chart-panel-body">
              {loading ? (
                <div className="precip-empty-charts">
                  <div className="precip-spinner" />
                  <p>Loading data...</p>
                </div>
              ) : error ? (
                <div className="precip-empty-charts">
                  <p className="precip-error">{error}</p>
                </div>
              ) : data.length === 0 ? (
                <div className="precip-empty-charts">
                  <p>No data for this period. Try adjusting the dates.</p>
                </div>
              ) : (
                <>
                  <div className="precip-stats">
                    <div className="stat-card">
                      <span className="stat-value">{data.length}</span>
                      <span className="stat-label">Records</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-value">{totalPrecip.toFixed(1)}</span>
                      <span className="stat-label">Total (mm)</span>
                    </div>
                    <div className="stat-card">
                      <span className="stat-value">{maxPrecip.toFixed(1)}</span>
                      <span className="stat-label">Max (mm)</span>
                    </div>
                  </div>

                  <div className="precip-chart-section">
                    <h4>Precipitation Depth (mm)</h4>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis
                          dataKey={viewMode === "daily" ? "date" : "month"}
                          stroke="#64748b"
                          tick={{ fontSize: 10 }}
                          minTickGap={40}
                          tickFormatter={(v: string) => formatTimeTick(v, viewMode)}
                        />
                        <YAxis stroke="#64748b" tick={{ fontSize: 10 }} unit="mm" />
                        <Tooltip
                          contentStyle={tooltipStyle}
                          formatter={(val: number | undefined) => [
                            `${val?.toFixed(1) ?? "N/A"} mm`,
                          ]}
                        />
                        <Bar dataKey="precip" fill="#3b82f6" name="Precipitation" radius={[2, 2, 0, 0]} />
                        {viewMode === "monthly" && (
                          <Bar dataKey="normalPrecip" fill="#475569" name="30yr Normal" radius={[2, 2, 0, 0]} />
                        )}
                        <Legend />
                        {data.length > 60 && (
                          <Brush
                            dataKey={viewMode === "daily" ? "date" : "month"}
                            height={24}
                            stroke="#475569"
                            fill="#0f172a"
                            tickFormatter={(v: string) => formatTimeTick(v, viewMode)}
                          />
                        )}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="precip-chart-section">
                    <h4>Temperature (&deg;C) &amp; Snow</h4>
                    <ResponsiveContainer width="100%" height={180}>
                      <LineChart data={data}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis
                          dataKey={viewMode === "daily" ? "date" : "month"}
                          stroke="#64748b"
                          tick={{ fontSize: 10 }}
                          minTickGap={40}
                          tickFormatter={(v: string) => formatTimeTick(v, viewMode)}
                        />
                        <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Line
                          type="monotone"
                          dataKey="meanTemp"
                          stroke="#f59e0b"
                          name="Mean Temp (°C)"
                          dot={false}
                          strokeWidth={1.5}
                        />
                        <Line
                          type="monotone"
                          dataKey={viewMode === "daily" ? "snowDepth" : "snowfall"}
                          stroke="#e2e8f0"
                          name={viewMode === "daily" ? "Snow Depth (cm)" : "Snowfall (cm)"}
                          dot={false}
                          strokeWidth={1.5}
                        />
                        <Legend />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

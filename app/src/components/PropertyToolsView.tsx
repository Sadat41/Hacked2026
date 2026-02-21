import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from "react-leaflet";
import { EDMONTON_CENTER } from "../config/layers";
import { BASEMAPS, type BasemapKey } from "../config/basemaps";
import BasemapSwitcher, { getSavedBasemap } from "./BasemapSwitcher";
import "leaflet/dist/leaflet.css";

const EDMONTON_API = "https://data.edmonton.ca/resource";

interface PropertyResult {
  accountNumber: string;
  houseNumber: string;
  streetName: string;
  address: string;
  lat: number;
  lng: number;
  lotSize: string;
  totalGrossArea: string;
  zoning: string;
  yearBuilt: string;
  legalDescription: string;
  neighbourhood: string;
  ward: string;
  garage: boolean;
  assessedValue?: string;
  taxClass?: string;
}

function fmtArea(val: string): string {
  if (!val) return "N/A";
  const n = parseFloat(val);
  if (isNaN(n) || n === 0) return "N/A";
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })} m²`;
}

function fmtCurrency(val: string | undefined): string {
  if (!val) return "N/A";
  const n = parseInt(val);
  if (isNaN(n)) return val;
  return `$${n.toLocaleString()}`;
}

function parseSearchInput(raw: string): { houseNumber: string; street: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d+)\s+(.+)/);
  if (match) return { houseNumber: match[1], street: match[2] };
  return null;
}

function buildSearchUrl(q: string): string {
  const parsed = parseSearchInput(q);
  const params = new URLSearchParams();
  params.set("$limit", "15");

  if (parsed) {
    const streetUpper = parsed.street.toUpperCase().replace(/'/g, "''");
    params.set(
      "$where",
      `house_number='${parsed.houseNumber}' AND upper(street_name) LIKE '%${streetUpper}%' AND latitude IS NOT NULL`
    );
  } else {
    params.set("$q", q);
    params.set("$where", "latitude IS NOT NULL");
  }

  return `${EDMONTON_API}/dkk9-cj3x.json?${params.toString()}`;
}

function FlyTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 17, { duration: 1.2 });
  }, [map, lat, lng]);
  return null;
}

export default function PropertyToolsView() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PropertyResult[]>([]);
  const [selected, setSelected] = useState<PropertyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [basemap, setBasemap] = useState<BasemapKey>(getSavedBasemap);
  const abortRef = useRef<AbortController>(undefined);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const bm = BASEMAPS[basemap];

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setSearched(true);
    setSelected(null);

    try {
      const url = buildSearchUrl(trimmed);
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      const mapped: PropertyResult[] = data.map((item: Record<string, unknown>) => ({
        accountNumber: (item.account_number as string) || "",
        houseNumber: (item.house_number as string) || "",
        streetName: (item.street_name as string) || "",
        address: `${item.house_number || ""} ${item.street_name || ""}`.trim(),
        lat: parseFloat(item.latitude as string),
        lng: parseFloat(item.longitude as string),
        lotSize: (item.lot_size as string) || "",
        totalGrossArea: (item.total_gross_area as string) || "",
        zoning: (item.zoning as string) || "",
        yearBuilt: (item.year_built as string) || "",
        legalDescription: (item.legal_description as string) || "",
        neighbourhood: (item.neighbourhood as string) || "",
        ward: (item.ward as string) || "",
        garage: item.garage === true || item.garage === "true",
      }));

      setResults(mapped);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInput = useCallback(
    (val: string) => {
      setQuery(val);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => runSearch(val), 350);
    },
    [runSearch]
  );

  const selectProperty = useCallback(async (r: PropertyResult) => {
    setSelected(r);

    if (!r.assessedValue) {
      try {
        const res = await fetch(
          `${EDMONTON_API}/q7d6-ambg.json?${new URLSearchParams({
            $where: `account_number='${r.accountNumber}'`,
            $limit: "1",
          }).toString()}`
        );
        const data = await res.json();
        if (data[0]) {
          setSelected((prev) =>
            prev?.accountNumber === r.accountNumber
              ? {
                  ...prev,
                  assessedValue: data[0].assessed_value || "",
                  taxClass: data[0].tax_class || "",
                }
              : prev
          );
        }
      } catch { /* ignore */ }
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      clearTimeout(debounceRef.current);
      runSearch(query);
    }
  };

  const visibleMarkers = useMemo(() => {
    if (selected) return [selected];
    return results.filter((r) => !isNaN(r.lat) && !isNaN(r.lng));
  }, [results, selected]);

  return (
    <div className="prop-view">
      {/* Sidebar */}
      <div className="prop-sidebar">
        <div className="prop-sidebar-header">
          <h2>Property Lookup</h2>
          <p className="prop-subtitle">
            Edmonton property assessment &middot; Open Data
          </p>
        </div>

        <div className="prop-section">
          <label className="prop-label">Address Search</label>
          <div className="prop-search-row">
            <input
              type="text"
              className="prop-input"
              placeholder="e.g. 4719 111A Street"
              value={query}
              onChange={(e) => handleInput(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button className="prop-search-btn" onClick={() => { clearTimeout(debounceRef.current); runSearch(query); }} disabled={loading}>
              {loading ? (
                <div className="prop-spinner-sm" />
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              )}
            </button>
          </div>
          <p className="prop-hint">
            Enter house number and street name, then press Enter or click search.
          </p>
        </div>

        {/* Results list */}
        {searched && !selected && (
          <div className="prop-section">
            <label className="prop-label">
              Results {results.length > 0 && <span className="prop-count">{results.length}</span>}
            </label>
            {loading ? (
              <div className="prop-loading">
                <div className="prop-spinner" />
                <span>Searching...</span>
              </div>
            ) : results.length === 0 ? (
              <p className="prop-empty">No properties found. Try a different address.</p>
            ) : (
              <div className="prop-results">
                {results.map((r) => (
                  <button
                    key={r.accountNumber}
                    className="prop-result-card"
                    onClick={() => selectProperty(r)}
                  >
                    <div className="prop-result-addr">{r.address}</div>
                    <div className="prop-result-meta">
                      {r.lotSize ? fmtArea(r.lotSize) : ""}
                      {r.zoning ? ` · ${r.zoning}` : ""}
                      {r.neighbourhood ? ` · ${r.neighbourhood}` : ""}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Selected property detail */}
        {selected && (
          <div className="prop-section prop-detail-section">
            <div className="prop-detail-header">
              <button className="prop-back-btn" onClick={() => setSelected(null)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5" />
                  <path d="M12 19l-7-7 7-7" />
                </svg>
                Back to results
              </button>
            </div>
            <div className="prop-detail-card">
              <h3 className="prop-detail-addr">{selected.address}</h3>
              <div className="prop-detail-grid">
                <div className="prop-detail-item highlight">
                  <span className="prop-detail-label">Lot Area</span>
                  <span className="prop-detail-value lg">{fmtArea(selected.lotSize)}</span>
                </div>
                <div className="prop-detail-item">
                  <span className="prop-detail-label">Building Area</span>
                  <span className="prop-detail-value">{fmtArea(selected.totalGrossArea)}</span>
                </div>
                <div className="prop-detail-item highlight">
                  <span className="prop-detail-label">Assessed Value</span>
                  <span className="prop-detail-value lg">
                    {selected.assessedValue ? fmtCurrency(selected.assessedValue) : (
                      <span className="prop-loading-inline">Loading...</span>
                    )}
                  </span>
                </div>
                <div className="prop-detail-item">
                  <span className="prop-detail-label">Tax Class</span>
                  <span className="prop-detail-value">{selected.taxClass || "—"}</span>
                </div>
              </div>

              <div className="prop-detail-table">
                <div className="prop-detail-row">
                  <span className="prop-detail-label">Zoning</span>
                  <span className="prop-detail-value">{selected.zoning || "N/A"}</span>
                </div>
                <div className="prop-detail-row">
                  <span className="prop-detail-label">Year Built</span>
                  <span className="prop-detail-value">{selected.yearBuilt || "N/A"}</span>
                </div>
                <div className="prop-detail-row">
                  <span className="prop-detail-label">Legal Description</span>
                  <span className="prop-detail-value sm">{selected.legalDescription || "N/A"}</span>
                </div>
                <div className="prop-detail-row">
                  <span className="prop-detail-label">Neighbourhood</span>
                  <span className="prop-detail-value">{selected.neighbourhood}</span>
                </div>
                <div className="prop-detail-row">
                  <span className="prop-detail-label">Ward</span>
                  <span className="prop-detail-value">{selected.ward}</span>
                </div>
                <div className="prop-detail-row">
                  <span className="prop-detail-label">Garage</span>
                  <span className="prop-detail-value">{selected.garage ? "Yes" : "No"}</span>
                </div>
                <div className="prop-detail-row">
                  <span className="prop-detail-label">Account #</span>
                  <span className="prop-detail-value sm">{selected.accountNumber}</span>
                </div>
                <div className="prop-detail-row">
                  <span className="prop-detail-label">Coordinates</span>
                  <span className="prop-detail-value sm">{selected.lat.toFixed(6)}, {selected.lng.toFixed(6)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {!searched && (
          <div className="prop-section">
            <div className="prop-info-card">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
                <line x1="9" y1="6" x2="9" y2="6.01" />
                <line x1="15" y1="6" x2="15" y2="6.01" />
                <line x1="9" y1="10" x2="9" y2="10.01" />
                <line x1="15" y1="10" x2="15" y2="10.01" />
                <line x1="9" y1="14" x2="9" y2="14.01" />
                <line x1="15" y1="14" x2="15" y2="14.01" />
                <line x1="9" y1="18" x2="15" y2="18" />
              </svg>
              <div>
                <strong>Property Assessment Lookup</strong>
                <p>
                  Search any Edmonton address to view lot area, assessed value, zoning, year built,
                  and legal description. Data from City of Edmonton Open Data.
                </p>
                <p>
                  Lot area and building area are essential for engineering calculations
                  like rainfall volume, stormwater runoff, and permeation estimates
                  during construction planning.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="prop-section prop-footer">
          <p>
            Data:{" "}
            <a href="https://data.edmonton.ca" target="_blank" rel="noopener noreferrer">
              Edmonton Open Data
            </a>
          </p>
          <p className="footer-credit">HackED 2026 - University of Alberta</p>
        </div>
      </div>

      {/* Map */}
      <div className={`prop-main ${bm.isDark ? "theme-dark" : "theme-light"}`}>
        <MapContainer
          center={EDMONTON_CENTER}
          zoom={11}
          className="prop-map"
          zoomControl={true}
        >
          <TileLayer key={basemap} attribution={bm.attr} url={bm.url} />
          {"labelsUrl" in bm && (
            <TileLayer
              key={basemap + "-labels"}
              url={bm.labelsUrl as string}
              zIndex={650}
            />
          )}
          {selected && <FlyTo lat={selected.lat} lng={selected.lng} />}
          {visibleMarkers.map((r) => (
            <CircleMarker
              key={r.accountNumber}
              center={[r.lat, r.lng]}
              radius={selected?.accountNumber === r.accountNumber ? 10 : 6}
              pathOptions={{
                color: selected?.accountNumber === r.accountNumber ? "#a855f7" : "#d946ef",
                fillColor: selected?.accountNumber === r.accountNumber ? "#a855f7" : "#d946ef",
                fillOpacity: selected?.accountNumber === r.accountNumber ? 0.9 : 0.5,
                weight: selected?.accountNumber === r.accountNumber ? 3 : 1.5,
              }}
              eventHandlers={{ click: () => selectProperty(r) }}
            >
              <Popup className="hydrogrid-popup" maxWidth={360}>
                <div style={{ fontFamily: "system-ui", fontSize: 13, maxWidth: 320 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, borderBottom: "2px solid #a855f7", paddingBottom: 4 }}>
                    {r.address}
                  </div>
                  <table style={{ borderCollapse: "collapse" }}>
                    <tbody>
                      <tr><td style={{ fontWeight: 600, padding: "2px 8px 2px 0", opacity: 0.65 }}>Lot Area</td><td style={{ fontWeight: 700 }}>{fmtArea(r.lotSize)}</td></tr>
                      <tr><td style={{ fontWeight: 600, padding: "2px 8px 2px 0", opacity: 0.65 }}>Building Area</td><td>{fmtArea(r.totalGrossArea)}</td></tr>
                      <tr><td style={{ fontWeight: 600, padding: "2px 8px 2px 0", opacity: 0.65 }}>Zoning</td><td>{r.zoning || "N/A"}</td></tr>
                      <tr><td style={{ fontWeight: 600, padding: "2px 8px 2px 0", opacity: 0.65 }}>Year Built</td><td>{r.yearBuilt || "N/A"}</td></tr>
                      <tr><td style={{ fontWeight: 600, padding: "2px 8px 2px 0", opacity: 0.65 }}>Neighbourhood</td><td>{r.neighbourhood}</td></tr>
                    </tbody>
                  </table>
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
        <BasemapSwitcher active={basemap} onChange={setBasemap} />
      </div>
    </div>
  );
}

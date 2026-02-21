import { useEffect, useState, useRef, lazy, Suspense } from "react";
import MapView from "./components/MapView";
import Sidebar from "./components/Sidebar";
import PropertyToolsView from "./components/PropertyToolsView";
import { useMapData } from "./hooks/useMapData";
import logoSvg from "./assets/logo.svg";
import "./App.css";

const PrecipitationView = lazy(() => import("./components/PrecipitationView"));
const HydrometricView = lazy(() => import("./components/HydrometricView"));
type ActiveView = "layers" | "flood" | "precipitation" | "hydrometric" | "property";
type FloodSubView = "flood" | "hydrometric" | "precipitation";
type UiTheme = "terminal" | "dark" | "accessible";

const FLOOD_SUB_OPTIONS: { key: FloodSubView; label: string }[] = [
  { key: "flood", label: "Flood Hazard" },
  { key: "hydrometric", label: "River Flow" },
  { key: "precipitation", label: "Precipitation Explorer" },
];

const LS_THEME_KEY = "hydrogrid-ui-theme";

export default function App() {
  const { layers, toggleLayer, loadVisibleLayers, onMapMove } = useMapData();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState<ActiveView>("layers");
  const [floodDropdownOpen, setFloodDropdownOpen] = useState(false);
  const [uiTheme, setUiTheme] = useState<UiTheme>(() => {
    try { return (localStorage.getItem(LS_THEME_KEY) as UiTheme) || "terminal"; }
    catch { return "terminal"; }
  });
  const floodDropdownRef = useRef<HTMLDivElement>(null);

  const THEME_CYCLE: UiTheme[] = ["terminal", "dark", "accessible"];
  const THEME_LABELS: Record<UiTheme, string> = { terminal: "Terminal", dark: "Dark", accessible: "Accessible" };

  function cycleUiTheme() {
    const idx = THEME_CYCLE.indexOf(uiTheme);
    const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    setUiTheme(next);
    try { localStorage.setItem(LS_THEME_KEY, next); } catch { /* ignore */ }
  }

  useEffect(() => {
    loadVisibleLayers();
  }, [loadVisibleLayers]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (floodDropdownRef.current && !floodDropdownRef.current.contains(e.target as Node)) {
        setFloodDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isFloodView = activeView === "flood" || activeView === "hydrometric" || activeView === "precipitation";
  const activeFloodLabel = FLOOD_SUB_OPTIONS.find((o) => o.key === activeView)?.label ?? "Flood Hazard";

  function selectFloodSub(key: FloodSubView) {
    setActiveView(key);
    setFloodDropdownOpen(false);
  }

  return (
    <div className="app" data-ui-theme={uiTheme}>
      <nav className="tab-bar">
        <div className="tab-brand">
          <img src={logoSvg} alt="" width="22" height="22" className="tab-logo" />
          HydroGrid
        </div>

        <div className="tab-buttons">
          {/* Map Layers — simple tab */}
          <button
            className={`tab-btn ${activeView === "layers" ? "active" : ""}`}
            onClick={() => {
              setActiveView("layers");
              setFloodDropdownOpen(false);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
              <line x1="8" y1="2" x2="8" y2="18" />
              <line x1="16" y1="6" x2="16" y2="22" />
            </svg>
            Map Layers
          </button>

          {/* Flood Hazard dropdown */}
          <div className="tab-dropdown-wrap" ref={floodDropdownRef}>
            <button
              className={`tab-btn ${isFloodView ? "active" : ""}`}
              onClick={() => {
                if (!isFloodView) {
                  setActiveView("flood");
                } else {
                  setFloodDropdownOpen((p) => !p);
                }
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" />
                <path d="M8 16l-2.3 2.3" />
                <path d="M12 12l-2.3 2.3" />
                <path d="M16 16l-2.3 2.3" />
                <path d="M12 20l-2.3 2.3" />
              </svg>
              {isFloodView ? activeFloodLabel : "Flood Hazard"}
              <svg
                width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={`tab-chevron ${floodDropdownOpen ? "open" : ""}`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {floodDropdownOpen && (
              <div className="tab-dropdown">
                {FLOOD_SUB_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    className={`tab-dropdown-item ${activeView === opt.key ? "active" : ""}`}
                    onClick={() => selectFloodSub(opt.key)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            className={`tab-btn ${activeView === "property" ? "active" : ""}`}
            onClick={() => {
              setActiveView("property");
              setFloodDropdownOpen(false);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
              <line x1="9" y1="6" x2="9" y2="6.01" />
              <line x1="15" y1="6" x2="15" y2="6.01" />
              <line x1="9" y1="10" x2="9" y2="10.01" />
              <line x1="15" y1="10" x2="15" y2="10.01" />
              <line x1="9" y1="14" x2="9" y2="14.01" />
              <line x1="15" y1="14" x2="15" y2="14.01" />
              <line x1="9" y1="18" x2="15" y2="18" />
            </svg>
            Property Lookup
          </button>

          <button className="tab-theme-btn" onClick={cycleUiTheme} title="Cycle theme">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            {THEME_LABELS[uiTheme]}
          </button>
        </div>
      </nav>

      <div className="app-content">
        {activeView === "layers" && (
          <>
            <Sidebar
              layers={layers}
              onToggle={toggleLayer}
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              categoryFilter={["infrastructure", "environment", "energy"]}
            />
            {!sidebarOpen && (
              <button
                className="sidebar-open-btn"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open sidebar"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            )}
            <MapView layers={layers} onMapMove={onMapMove} sidebarOpen={sidebarOpen} />
          </>
        )}
        {activeView === "flood" && (
          <>
            <Sidebar
              layers={layers}
              onToggle={toggleLayer}
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              categoryFilter={["flood"]}
            />
            {!sidebarOpen && (
              <button
                className="sidebar-open-btn"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open sidebar"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            )}
            <MapView layers={layers} onMapMove={onMapMove} sidebarOpen={sidebarOpen} />
          </>
        )}
        {activeView === "hydrometric" && (
          <Suspense fallback={<div className="precip-overlay-loading">Loading...</div>}>
            <HydrometricView />
          </Suspense>
        )}
        {activeView === "precipitation" && (
          <Suspense fallback={<div className="precip-overlay-loading">Loading...</div>}>
            <PrecipitationView />
          </Suspense>
        )}
        {activeView === "property" && <PropertyToolsView />}
      </div>
    </div>
  );
}

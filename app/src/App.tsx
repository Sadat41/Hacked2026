import { useEffect, useState, useRef, lazy, Suspense, useCallback } from "react";
import MapView from "./components/MapView";
import Sidebar from "./components/Sidebar";
import PropertyToolsView from "./components/PropertyToolsView";
const LandingPage = lazy(() => import("./components/LandingPage"));
import { useMapData } from "./hooks/useMapData";
import { BASEMAPS, type BasemapKey } from "./config/basemaps";
import { downloadPNG } from "./utils/export";
import logoSvg from "./assets/logo.svg";
import "./App.css";

const PrecipitationView = lazy(() => import("./components/PrecipitationView"));
const HydrometricView = lazy(() => import("./components/HydrometricView"));
const EngineeringView = lazy(() => import("./components/EngineeringView"));
const StormSimulationView = lazy(() => import("./components/StormSimulationView"));
const CostAnalysisView = lazy(() => import("./components/CostAnalysisView"));
const DrainageWaterView = lazy(() => import("./components/DrainageWaterView"));
type ActiveView = "layers" | "drainage" | "flood" | "precipitation" | "hydrometric" | "property" | "engineering" | "simulation" | "cost";
type FloodSubView = "flood" | "hydrometric" | "precipitation";
type EngSubView = "engineering" | "simulation" | "cost";
type UiTheme = "terminal" | "dark" | "accessible";

const FLOOD_SUB_OPTIONS: { key: FloodSubView; label: string }[] = [
  { key: "flood", label: "Flood Hazard" },
  { key: "hydrometric", label: "River Flow" },
  { key: "precipitation", label: "Precipitation Explorer" },
];

const ENG_SUB_OPTIONS: { key: EngSubView; label: string }[] = [
  { key: "engineering", label: "Drainage Design" },
  { key: "simulation", label: "Storm Simulation" },
  { key: "cost", label: "Cost Analysis" },
];

const LS_THEME_KEY = "hydrogrid-ui-theme";
const LS_WELCOME_KEY = "hydrogrid-welcome-done";
const SCALE_OPTIONS = [80, 90, 100, 110, 120, 130, 140];

function getAutoScale(): number {
  const w = window.innerWidth;
  if (w <= 768) return 100;
  if (w >= 1920) return 120;
  return Math.round(100 + ((w - 768) / (1920 - 768)) * 20);
}

const UI_THEME_OPTIONS: { key: UiTheme; label: string; desc: string; preview: string }[] = [
  { key: "terminal", label: "Terminal", desc: "Green-on-black hacker style", preview: "linear-gradient(135deg, #060d06, #0a150a)" },
  { key: "dark", label: "Dark", desc: "Modern dark blue UI", preview: "linear-gradient(135deg, #0f172a, #1e293b)" },
  { key: "accessible", label: "Accessible", desc: "Light, high-contrast (WCAG AAA)", preview: "linear-gradient(135deg, #f5f7fa, #ffffff)" },
];

export default function App() {
  const { layers, toggleLayer, loadVisibleLayers, onMapMove } = useMapData();
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);
  const [activeView, setActiveView] = useState<ActiveView>("layers");
  const [floodDropdownOpen, setFloodDropdownOpen] = useState(false);
  const [engDropdownOpen, setEngDropdownOpen] = useState(false);
  const [uiTheme, setUiTheme] = useState<UiTheme>(() => {
    try { return (localStorage.getItem(LS_THEME_KEY) as UiTheme) || "terminal"; }
    catch { return "terminal"; }
  });
  const [uiScale, setUiScale] = useState(getAutoScale);
  const [scaleManual, setScaleManual] = useState(false);
  const [scaleOpen, setScaleOpen] = useState(false);
  const scaleRef = useRef<HTMLDivElement>(null);
  const floodDropdownRef = useRef<HTMLDivElement>(null);
  const engDropdownRef = useRef<HTMLDivElement>(null);

  const [showLanding, setShowLanding] = useState(true);
  const [showWelcome, setShowWelcome] = useState(() => {
    try { return !localStorage.getItem(LS_WELCOME_KEY); }
    catch { return true; }
  });
  const [welcomeMap, setWelcomeMap] = useState<BasemapKey>("dark");
  const [welcomeTheme, setWelcomeTheme] = useState<UiTheme>("terminal");
  const [mapKey, setMapKey] = useState(0);

  // Suppress the old basemap first-visit prompt immediately
  useEffect(() => {
    if (showWelcome) {
      try { localStorage.setItem("hydrogrid-basemap-seen", "1"); } catch { /* */ }
    }
  }, [showWelcome]);

  function finishWelcome() {
    setUiTheme(welcomeTheme);
    try {
      localStorage.setItem(LS_THEME_KEY, welcomeTheme);
      localStorage.setItem("hydrogrid-basemap", welcomeMap);
      localStorage.setItem("hydrogrid-basemap-seen", "1");
      localStorage.setItem(LS_WELCOME_KEY, "1");
    } catch { /* ignore */ }
    setShowWelcome(false);
    setMapKey(k => k + 1);
  }

  const THEME_CYCLE: UiTheme[] = ["terminal", "dark", "accessible"];
  const THEME_LABELS: Record<UiTheme, string> = { terminal: "Terminal", dark: "Dark", accessible: "Accessible" };

  function cycleUiTheme() {
    const idx = THEME_CYCLE.indexOf(uiTheme);
    const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
    setUiTheme(next);
    try { localStorage.setItem(LS_THEME_KEY, next); } catch { /* ignore */ }
  }

  function changeScale(s: number) {
    setUiScale(s);
    setScaleManual(true);
    setScaleOpen(false);
  }

  function resetAutoScale() {
    setScaleManual(false);
    setUiScale(getAutoScale());
    setScaleOpen(false);
  }

  useEffect(() => {
    if (scaleManual) return;
    function onResize() { setUiScale(getAutoScale()); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [scaleManual]);

  const handleExport = useCallback(() => {
    const app = document.querySelector(".app") as HTMLElement | null;
    if (app) downloadPNG(app, `hydrogrid_${activeView}.png`);
  }, [activeView]);

  useEffect(() => {
    loadVisibleLayers();
  }, [loadVisibleLayers]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (floodDropdownRef.current && !floodDropdownRef.current.contains(e.target as Node)) {
        setFloodDropdownOpen(false);
      }
      if (engDropdownRef.current && !engDropdownRef.current.contains(e.target as Node)) {
        setEngDropdownOpen(false);
      }
      if (scaleRef.current && !scaleRef.current.contains(e.target as Node)) {
        setScaleOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isFloodView = activeView === "flood" || activeView === "hydrometric" || activeView === "precipitation";
  const activeFloodLabel = FLOOD_SUB_OPTIONS.find((o) => o.key === activeView)?.label ?? "Flood Hazard";

  const isEngView = activeView === "engineering" || activeView === "simulation" || activeView === "cost";
  const activeEngLabel = ENG_SUB_OPTIONS.find((o) => o.key === activeView)?.label ?? "Site Analysis";

  function selectFloodSub(key: FloodSubView) {
    setActiveView(key);
    setFloodDropdownOpen(false);
  }

  function selectEngSub(key: EngSubView) {
    setActiveView(key);
    setEngDropdownOpen(false);
  }

  return (
    <div className="app" data-ui-theme={uiTheme} style={{ "--ui-scale": uiScale / 100 } as React.CSSProperties}>
      {showLanding && (
        <Suspense fallback={<div className="landing" style={{background:"#000"}} />}>
          <LandingPage onLaunch={() => setShowLanding(false)} />
        </Suspense>
      )}
      
      {!showLanding && showWelcome && (
        <div className="welcome-overlay">
          <div className="welcome-modal">
            <div className="welcome-header">
              <img src={logoSvg} alt="" width="28" height="28" />
              <div>
                <h2 className="welcome-title">Welcome to HydroGrid</h2>
                <p className="welcome-sub">Edmonton Hydrology &amp; Infrastructure Platform</p>
              </div>
            </div>

            <div className="welcome-section">
              <label className="welcome-section-label">Map Style</label>
              <div className="welcome-grid">
                {(Object.keys(BASEMAPS) as BasemapKey[]).map((key) => (
                  <button key={key} className={`welcome-tile ${welcomeMap === key ? "active" : ""}`} onClick={() => setWelcomeMap(key)}>
                    <span className="basemap-first-preview" data-basemap={key} />
                    <span className="welcome-tile-label">{BASEMAPS[key].label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="welcome-section">
              <label className="welcome-section-label">UI Theme</label>
              <div className="welcome-grid welcome-grid-themes">
                {UI_THEME_OPTIONS.map((t) => (
                  <button key={t.key} className={`welcome-tile ${welcomeTheme === t.key ? "active" : ""}`} onClick={() => setWelcomeTheme(t.key)}>
                    <span className="welcome-theme-preview" style={{ background: t.preview }} />
                    <span className="welcome-tile-label">{t.label}</span>
                    <span className="welcome-tile-desc">{t.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <button className="welcome-go-btn" onClick={finishWelcome}>Get Started</button>
          </div>
        </div>
      )}


      {!showLanding && (
        <>
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
                  setEngDropdownOpen(false);
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
                  <line x1="8" y1="2" x2="8" y2="18" />
                  <line x1="16" y1="6" x2="16" y2="22" />
                </svg>
                Map Layers
              </button>

              {/* Drainage & Water tab */}
              <button
                className={`tab-btn ${activeView === "drainage" ? "active" : ""}`}
                onClick={() => {
                  setActiveView("drainage");
                  setFloodDropdownOpen(false);
                  setEngDropdownOpen(false);
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 16c1.5-1.5 3-2 4.5-2s3 .5 4.5 2c1.5 1.5 3 2 4.5 2s3-.5 4.5-2" />
                  <path d="M2 12c1.5-1.5 3-2 4.5-2s3 .5 4.5 2c1.5 1.5 3 2 4.5 2s3-.5 4.5-2" />
                  <path d="M12 2v6" />
                  <path d="M9 5l3-3 3 3" />
                </svg>
                Drainage &amp; Water
              </button>

              {/* Flood Hazard dropdown */}
              <div className="tab-dropdown-wrap" ref={floodDropdownRef}>
                <button
                  className={`tab-btn ${isFloodView ? "active" : ""}`}
                  onClick={() => {
                    setEngDropdownOpen(false);
                    if (!isFloodView) {
                      setActiveView("flood");
                    }
                    setFloodDropdownOpen((p) => !p);
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
                  setEngDropdownOpen(false);
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

              {/* Site Analysis dropdown */}
              <div className="tab-dropdown-wrap" ref={engDropdownRef}>
                <button
                  className={`tab-btn ${isEngView ? "active" : ""}`}
                  onClick={() => {
                    setFloodDropdownOpen(false);
                    if (!isEngView) {
                      setActiveView("engineering");
                    }
                    setEngDropdownOpen((p) => !p);
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 16c1.5-1.5 3-2 4.5-2s3 .5 4.5 2c1.5 1.5 3 2 4.5 2s3-.5 4.5-2" />
                    <path d="M2 12c1.5-1.5 3-2 4.5-2s3 .5 4.5 2c1.5 1.5 3 2 4.5 2s3-.5 4.5-2" />
                    <path d="M12 2v6" />
                    <path d="M9 5l3-3 3 3" />
                  </svg>
                  {isEngView ? activeEngLabel : "Site Analysis"}
                  <svg
                    width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className={`tab-chevron ${engDropdownOpen ? "open" : ""}`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {engDropdownOpen && (
                  <div className="tab-dropdown">
                    {ENG_SUB_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        className={`tab-dropdown-item ${activeView === opt.key ? "active" : ""}`}
                        onClick={() => selectEngSub(opt.key)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button className="tab-theme-btn tab-export-btn" onClick={handleExport} title="Export current view as PNG" style={{ marginLeft: "auto" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </button>

              <div className="tab-dropdown-wrap tab-scale-wrap" ref={scaleRef}>
                <button className="tab-theme-btn" onClick={() => setScaleOpen(o => !o)} title="UI Scale">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    <line x1="11" y1="8" x2="11" y2="14" />
                    <line x1="8" y1="11" x2="14" y2="11" />
                  </svg>
                </button>
                {scaleOpen && (
                  <div className="tab-dropdown">
                    <button className={`tab-dropdown-item ${!scaleManual ? "active" : ""}`} onClick={resetAutoScale}>
                      Auto ({getAutoScale()}%)
                    </button>
                    {SCALE_OPTIONS.map(s => (
                      <button key={s} className={`tab-dropdown-item ${scaleManual && uiScale === s ? "active" : ""}`} onClick={() => changeScale(s)}>
                        {s}%
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button className="tab-theme-btn tab-theme-cycle" onClick={cycleUiTheme} title="Cycle theme">
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
                <MapView key={mapKey} layers={layers} onMapMove={onMapMove} sidebarOpen={sidebarOpen} />
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
                <MapView key={mapKey} layers={layers} onMapMove={onMapMove} sidebarOpen={sidebarOpen} />
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
            {activeView === "drainage" && (
              <Suspense fallback={<div className="precip-overlay-loading">Loading...</div>}>
                <DrainageWaterView />
              </Suspense>
            )}
            {activeView === "property" && <PropertyToolsView />}
            {activeView === "engineering" && (
              <Suspense fallback={<div className="precip-overlay-loading">Loading...</div>}>
                <EngineeringView />
              </Suspense>
            )}
            {activeView === "simulation" && (
              <Suspense fallback={<div className="precip-overlay-loading">Loading...</div>}>
                <StormSimulationView />
              </Suspense>
            )}
            {activeView === "cost" && (
              <Suspense fallback={<div className="precip-overlay-loading">Loading...</div>}>
                <CostAnalysisView />
              </Suspense>
            )}
          </div>
        </>
      )}
    </div>
  );
}
